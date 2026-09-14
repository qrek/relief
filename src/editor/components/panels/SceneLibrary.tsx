"use client";

import { useEffect, useState } from "react";
import { currentFormat, newId, normalizeProject, useEditor } from "../../store";
import { TEMPLATES, type TemplateDef } from "../../presets/templates";
import { assetUrl, deleteAsset, getTemplateData, listAssets, putTemplate, type AssetMeta } from "../../lib/assets";
import { renderImage } from "../../lib/export";
import { Button } from "../ui";
import { X } from "lucide-react";
import { deleteCloudProject, listCloudProjects, loadCloudProject, useCloud, type CloudProject } from "../../lib/cloud";
import { saveToCloud } from "./AccountMenu";

type SavedScene = AssetMeta & { url: string };

/** Scenes the designer saved to start from again later. */
export function SceneLibrary({ onClose }: { onClose: () => void }) {
  const project = useEditor((s) => s.project);
  const loadProject = useEditor((s) => s.loadProject);
  const [scenes, setScenes] = useState<SavedScene[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const user = useCloud((s) => s.user);
  const [cloud, setCloud] = useState<CloudProject[]>([]);
  const refreshCloud = () => {
    // Signed out, the shelf is simply not shown; the list is only read for a user.
    if (!user) return;
    listCloudProjects()
      .then(setCloud)
      .catch((e) => setError(e instanceof Error ? e.message : "Could not read your cloud projects"));
  };
  useEffect(refreshCloud, [user]);

  const openCloud = async (row: CloudProject) => {
    if (!confirm(`Open "${row.name}"? The current scene is replaced.`)) return;
    try {
      loadProject(normalizeProject(await loadCloudProject(row.id)));
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open this project");
    }
  };

  const refresh = () => {
    listAssets("template")
      .then((metas) => Promise.all(metas.map(async (m) => ({ ...m, url: await assetUrl(m.id) }))))
      .then(setScenes)
      .catch((e) => setError(e instanceof Error ? e.message : "Could not read your saved scenes"));
  };

  useEffect(refresh, []);

  const saveCurrent = async () => {
    setBusy(true);
    setError(null);
    try {
      // Keep the project's own shape so the tile shows which format it targets.
      const format = currentFormat(project);
      const scale = 480 / Math.max(format.width, format.height);
      const preview = await renderImage({
        width: Math.round(format.width * scale),
        height: Math.round(format.height * scale),
        type: "image/jpeg",
        quality: 0.85,
        transparent: false,
      });
      await putTemplate(project.name || "Untitled", JSON.stringify(project), preview);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save this scene");
    } finally {
      setBusy(false);
    }
  };

  const openTemplate = (tpl: TemplateDef) => {
    if (!confirm(`Start from "${tpl.name}"? The current scene is replaced.`)) return;
    loadProject(normalizeProject({ ...tpl.project, id: newId(), name: tpl.name }));
    onClose();
  };

  const open = async (scene: SavedScene) => {
    const json = await getTemplateData(scene.id);
    if (!json) {
      setError("This saved scene has no data");
      return;
    }
    if (!confirm("Open this scene? The current one is replaced.")) return;
    loadProject(normalizeProject(JSON.parse(json)));
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex h-full max-h-[600px] w-full max-w-[820px] flex-col overflow-hidden rounded-xl border border-white/10 bg-neutral-900 shadow-2xl"
      >
        <div className="flex items-center gap-3 border-b border-white/5 px-4 py-3">
          <h2 className="text-sm font-semibold text-neutral-100">Scenes</h2>
          <span className="text-[11px] text-neutral-500">Keep a scene you like and start from it again.</span>
          <div className="flex-1" />
          <Button variant="default" onClick={saveCurrent} disabled={busy}>
            {busy ? "Saving…" : "Save current scene"}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Templates</h3>
          <div className="mb-6 grid grid-cols-3 gap-3">
            {TEMPLATES.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                onClick={() => openTemplate(tpl)}
                title={tpl.blurb}
                className="flex w-full flex-col gap-2 rounded-lg p-2 text-left hover:bg-white/10"
              >
                <span className="grid aspect-square w-full place-items-center overflow-hidden rounded-md bg-black/50 p-1 ring-1 ring-white/5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={tpl.thumbnail} alt="" className="h-full w-full object-contain" />
                </span>
                <span className="truncate text-xs font-medium text-neutral-200">{tpl.name}</span>
                <span className="line-clamp-2 text-[10.5px] leading-snug text-neutral-500">{tpl.blurb}</span>
              </button>
            ))}
          </div>

          {user && (
            <>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">In the cloud</h3>
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    setError(null);
                    try {
                      await saveToCloud();
                      refreshCloud();
                    } catch (e) {
                      setError(e instanceof Error ? e.message : "Could not save to the cloud");
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {project.cloudId ? "Save now" : "Save this project to the cloud"}
                </Button>
              </div>
              {cloud.length === 0 ? (
                <p className="mb-6 p-4 text-center text-[11px] leading-relaxed text-neutral-500">
                  Nothing in the cloud yet. Save this project and it follows you to any browser.
                </p>
              ) : (
                <div className="mb-6 grid grid-cols-3 gap-3">
                  {cloud.map((row) => (
                    <div key={row.id} className="group relative">
                      <button
                        type="button"
                        onClick={() => openCloud(row)}
                        className={`flex w-full flex-col gap-2 rounded-lg p-2 text-left hover:bg-white/10 ${
                          row.id === project.cloudId ? "ring-1 ring-[var(--accent-edge)]" : ""
                        }`}
                      >
                        <span className="grid aspect-square w-full place-items-center overflow-hidden rounded-md bg-black/50 p-1 ring-1 ring-white/5">
                          {row.thumbnail ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={row.thumbnail} alt="" className="h-full w-full object-contain" />
                          ) : (
                            <span className="text-[10px] text-neutral-600">No preview</span>
                          )}
                        </span>
                        <span className="truncate text-xs font-medium text-neutral-200">{row.name}</span>
                        <span className="text-[10.5px] text-neutral-500">
                          {row.share_slug ? "Shared · " : ""}
                          {new Date(row.updated_at).toLocaleDateString()}
                        </span>
                      </button>
                      <button
                        type="button"
                        title="Delete from the cloud"
                        onClick={async () => {
                          if (!confirm(`Delete "${row.name}" from the cloud?`)) return;
                          await deleteCloudProject(row.id);
                          if (row.id === project.cloudId) useEditor.getState().setCloudId(null);
                          refreshCloud();
                        }}
                        className="absolute right-3 top-3 grid h-6 w-6 place-items-center rounded bg-black/70 text-neutral-400 opacity-0 hover:text-red-300 group-hover:opacity-100"
                      >
                        <X size={13} strokeWidth={1.75} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Your scenes</h3>
          {scenes.length === 0 ? (
            <p className="p-8 text-center text-[11px] leading-relaxed text-neutral-500">
              Nothing saved yet.
              <br />
              Build a scene you like, then use Save current scene to keep it.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {scenes.map((scene) => (
                <div key={scene.id} className="group relative">
                  <button
                    type="button"
                    onClick={() => open(scene)}
                    className="flex w-full flex-col gap-2 rounded-lg p-2 text-left hover:bg-white/10"
                  >
                    <span className="grid aspect-square w-full place-items-center overflow-hidden rounded-md bg-black/50 p-1 ring-1 ring-white/5">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={scene.url} alt="" className="h-full w-full object-contain" />
                    </span>
                    <span className="truncate text-xs font-medium text-neutral-200">{scene.name}</span>
                  </button>
                  <button
                    type="button"
                    title="Delete"
                    onClick={async () => {
                      await deleteAsset(scene.id);
                      refresh();
                    }}
                    className="absolute right-3 top-3 grid h-6 w-6 place-items-center rounded bg-black/70 text-neutral-400 opacity-0 hover:text-red-300 group-hover:opacity-100"
                  >
                    <X size={13} strokeWidth={1.75} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {error && <div className="border-t border-white/5 px-4 py-2 text-[11px] text-red-300">{error}</div>}
      </div>
    </div>
  );
}
