"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Cloud, CloudUpload, Link2, LogOut, UserRound } from "lucide-react";
import { currentFormat, useEditor } from "../../store";
import {
  saveCloudProject,
  setCloudShare,
  shareUrl,
  signInWithEmail,
  signInWithGoogle,
  signOut,
  supabase,
  useCloud,
  watchAuth,
} from "../../lib/cloud";
import { renderImage } from "../../lib/export";
import { Button } from "../ui";

/** A small picture of the project for its cloud tile. */
async function projectThumbnail(): Promise<string | null> {
  try {
    const project = useEditor.getState().project;
    const format = currentFormat(project);
    const scale = 480 / Math.max(format.width, format.height);
    const blob = await renderImage({
      width: Math.round(format.width * scale),
      height: Math.round(format.height * scale),
      type: "image/jpeg",
      quality: 0.8,
      transparent: false,
    });
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** Saves the current project to the cloud, creating its row the first time, and remembers the id. */
export async function saveToCloud(): Promise<string> {
  const project = useEditor.getState().project;
  const id = await saveCloudProject(project, await projectThumbnail());
  if (!project.cloudId) useEditor.getState().setCloudId(id);
  return id;
}

/**
 * Who is signed in, and what the cloud holds for this project: save, share,
 * sign out. Signed out, it is the way in, by Google or by a link sent by email.
 */
export function AccountMenu() {
  const user = useCloud((s) => s.user);
  const ready = useCloud((s) => s.ready);
  const saving = useCloud((s) => s.saving);
  const savedAt = useCloud((s) => s.savedAt);
  const cloudError = useCloud((s) => s.error);
  const cloudId = useEditor((s) => s.project.cloudId);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shareSlug, setShareSlug] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(watchAuth, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);

  // The share state lives on the row; read it when the menu opens.
  useEffect(() => {
    if (!open || !cloudId || !user) return;
    supabase
      .from("relief_projects")
      .select("share_slug")
      .eq("id", cloudId)
      .maybeSingle()
      .then(({ data }) => setShareSlug((data as { share_slug: string | null } | null)?.share_slug ?? null));
  }, [open, cloudId, user]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      setError(
        /provider is not enabled/i.test(message)
          ? "Google sign-in is not switched on for this Relief yet. The email link works in the meantime."
          : message,
      );
    } finally {
      setBusy(false);
    }
  };

  const label = !ready ? "…" : user ? (user.email?.split("@")[0] ?? "Account") : "Sign in";
  const status = saving ? "Saving…" : cloudError ? "Not saved" : cloudId && savedAt ? "Saved" : cloudId ? "In the cloud" : null;

  return (
    <div className="relative" ref={box}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={user ? "Your account, your cloud copy, sharing" : "Sign in to keep projects in the cloud and share them"}
        className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition ${
          open ? "bg-white/15 text-neutral-100" : "bg-white/10 text-neutral-100 hover:bg-white/15"
        }`}
      >
        {user ? <Cloud size={13} strokeWidth={1.75} /> : <UserRound size={13} strokeWidth={1.75} />}
        {label}
        {status && <span className={`text-[10px] ${cloudError ? "text-red-300" : "text-neutral-400"}`}>· {status}</span>}
      </button>

      {open && (
        <div className="absolute right-0 top-9 z-30 w-72 rounded-lg border border-white/10 bg-neutral-900 p-3 text-xs text-neutral-300 shadow-2xl">
          {!user ? (
            <>
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Sign in</div>
              <Button variant="primary" className="w-full" disabled={busy} onClick={() => run(signInWithGoogle)}>
                Continue with Google
              </Button>
              <div className="my-3 flex items-center gap-2 text-[10px] uppercase tracking-wider text-neutral-600">
                <span className="h-px flex-1 bg-white/10" />
                or
                <span className="h-px flex-1 bg-white/10" />
              </div>
              {sent ? (
                <p className="text-[11px] leading-relaxed text-neutral-400">
                  A link is on its way to <span className="text-neutral-200">{email}</span>. Open it on this device and you are in.
                </p>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!email.includes("@")) return;
                    run(async () => {
                      await signInWithEmail(email.trim());
                      setSent(true);
                    });
                  }}
                  className="flex flex-col gap-2"
                >
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@studio.com"
                    className="w-full rounded-md bg-white/5 px-2.5 py-1.5 text-xs text-neutral-100 outline-none placeholder:text-neutral-600 focus:bg-white/10"
                  />
                  <Button variant="default" className="w-full" disabled={busy || !email.includes("@")}>
                    Send me a sign-in link
                  </Button>
                </form>
              )}
              <p className="mt-3 text-[11px] leading-relaxed text-neutral-500">
                An account keeps your projects in the cloud and lets you share a scene by link. Your imported files stay on this
                device.
              </p>
            </>
          ) : (
            <>
              <div className="mb-2 truncate text-[11px] text-neutral-400">{user.email}</div>
              <Button
                variant="primary"
                className="flex w-full items-center justify-center gap-1.5"
                disabled={busy || saving}
                onClick={() => run(async () => void (await saveToCloud()))}
              >
                <CloudUpload size={13} strokeWidth={1.75} />
                {cloudId ? "Save to the cloud now" : "Save this project to the cloud"}
              </Button>
              {cloudId && (
                <p className="mt-1.5 text-[11px] leading-relaxed text-neutral-500">
                  This project is in the cloud and saves itself a few seconds after each change. Your projects are listed under
                  Scenes.
                </p>
              )}
              {cloudId && (
                <div className="mt-3 border-t border-white/5 pt-3">
                  <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                    <Link2 size={12} strokeWidth={1.75} />
                    Share
                  </div>
                  {shareSlug ? (
                    <>
                      <div className="flex items-center gap-1">
                        <input
                          readOnly
                          value={shareUrl(shareSlug)}
                          onFocus={(e) => e.currentTarget.select()}
                          className="min-w-0 flex-1 rounded-md bg-white/5 px-2 py-1 text-[11px] text-neutral-200 outline-none"
                        />
                        <Button
                          variant="default"
                          onClick={() =>
                            run(async () => {
                              await navigator.clipboard.writeText(shareUrl(shareSlug));
                              setCopied(true);
                              setTimeout(() => setCopied(false), 1500);
                            })
                          }
                        >
                          {copied ? <Check size={12} strokeWidth={1.75} /> : "Copy"}
                        </Button>
                      </div>
                      <p className="mt-1.5 text-[11px] leading-relaxed text-neutral-500">
                        Anyone with the link opens a copy of this scene in Relief. Their changes stay theirs.
                      </p>
                      <Button
                        variant="ghost"
                        className="mt-1"
                        onClick={() =>
                          run(async () => {
                            await setCloudShare(cloudId, false);
                            setShareSlug(null);
                          })
                        }
                      >
                        Stop sharing
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="default"
                      className="w-full"
                      disabled={busy}
                      onClick={() =>
                        run(async () => {
                          await saveToCloud();
                          setShareSlug(await setCloudShare(cloudId, true));
                        })
                      }
                    >
                      Create a share link
                    </Button>
                  )}
                </div>
              )}
              <div className="mt-3 border-t border-white/5 pt-2">
                <Button variant="ghost" className="flex items-center gap-1.5" disabled={busy} onClick={() => run(signOut)}>
                  <LogOut size={12} strokeWidth={1.75} />
                  Sign out
                </Button>
              </div>
            </>
          )}
          {(error || cloudError) && <p className="mt-2 text-[11px] text-red-300">{error ?? cloudError}</p>}
        </div>
      )}
    </div>
  );
}
