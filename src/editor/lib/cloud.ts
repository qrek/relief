import { createClient, type User } from "@supabase/supabase-js";
import { create } from "zustand";
import type { Project } from "../types";

/**
 * The account and the cloud copy of a project, on Supabase. The keys below
 * are the public ones: they only open what row-level security allows, which
 * is a person's own rows and the rows that were deliberately shared. The
 * imported files (models, media, fonts) stay in the browser's own library for
 * now; a cloud project carries the scene, not the bytes it points at.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://mrqhesvdazroyqqcwprh.supabase.co";
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "sb_publishable_-mOWxULkUk-KBO9Wz4rF9Q_I1m3pHO1";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const TABLE = "relief_projects";

export type CloudProject = {
  id: string;
  name: string;
  format: string | null;
  thumbnail: string | null;
  share_slug: string | null;
  updated_at: string;
};

type CloudState = {
  user: User | null;
  /** Until the first answer from the auth server, nothing is known. */
  ready: boolean;
  saving: boolean;
  savedAt: number | null;
  error: string | null;
  setError: (error: string | null) => void;
};

export const useCloud = create<CloudState>((set) => ({
  user: null,
  ready: false,
  saving: false,
  savedAt: null,
  error: null,
  setError: (error) => set({ error }),
}));

let watching = false;
/** Starts following the session; safe to call more than once. */
export function watchAuth() {
  if (watching || typeof window === "undefined") return;
  watching = true;
  supabase.auth.getSession().then(({ data }) => useCloud.setState({ user: data.session?.user ?? null, ready: true }));
  supabase.auth.onAuthStateChange((_event, session) => {
    useCloud.setState({ user: session?.user ?? null, ready: true });
  });
}

const origin = () => (typeof window === "undefined" ? "" : window.location.origin);

export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: origin() } });
  if (error) throw error;
}

/** A magic link by email: no password to invent, no password to forget. */
export async function signInWithEmail(email: string) {
  const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: origin() } });
  if (error) throw error;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function listCloudProjects(): Promise<CloudProject[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("id, name, format, thumbnail, share_slug, updated_at")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as CloudProject[];
}

/** Writes the project; a new row when it has no cloud id yet. Returns the row id. */
export async function saveCloudProject(project: Project, thumbnail: string | null): Promise<string> {
  const user = useCloud.getState().user;
  if (!user) throw new Error("Sign in to save to the cloud");
  const row = {
    owner: user.id,
    name: project.name || "Untitled",
    data: project,
    format: project.formatId,
    ...(thumbnail ? { thumbnail } : {}),
  };
  useCloud.setState({ saving: true, error: null });
  try {
    if (project.cloudId) {
      const { error } = await supabase.from(TABLE).update(row).eq("id", project.cloudId);
      if (error) throw error;
      useCloud.setState({ savedAt: Date.now() });
      return project.cloudId;
    }
    const { data, error } = await supabase.from(TABLE).insert(row).select("id").single();
    if (error) throw error;
    useCloud.setState({ savedAt: Date.now() });
    return (data as { id: string }).id;
  } catch (err) {
    useCloud.setState({ error: err instanceof Error ? err.message : "Could not save" });
    throw err;
  } finally {
    useCloud.setState({ saving: false });
  }
}

export async function loadCloudProject(id: string): Promise<Project> {
  const { data, error } = await supabase.from(TABLE).select("data").eq("id", id).single();
  if (error) throw error;
  return { ...(data as { data: Project }).data, cloudId: id };
}

export async function deleteCloudProject(id: string) {
  const { error } = await supabase.from(TABLE).delete().eq("id", id);
  if (error) throw error;
}

/** Turns sharing on (a fresh slug) or off (no slug). Returns the slug. */
export async function setCloudShare(id: string, on: boolean): Promise<string | null> {
  const slug = on ? Math.random().toString(36).slice(2, 12) : null;
  const { error } = await supabase.from(TABLE).update({ share_slug: slug }).eq("id", id);
  if (error) throw error;
  return slug;
}

export function shareUrl(slug: string): string {
  return `${origin()}/s/${slug}`;
}

/** What a share link opens: the scene as a copy, so the visitor works on their own. */
export async function loadSharedProject(slug: string): Promise<{ name: string; project: Project } | null> {
  const { data, error } = await supabase.from(TABLE).select("name, data").eq("share_slug", slug).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as { name: string; data: Project };
  return { name: row.name, project: { ...row.data, cloudId: null } };
}
