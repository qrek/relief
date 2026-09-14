"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { loadSharedProject } from "@/editor/lib/cloud";
import { useEditor } from "@/editor/store";

/**
 * A share link: the scene is fetched as a copy, put in the editor, and the
 * visitor lands on the editor with it. Their changes are their own.
 */
export default function SharedScenePage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const [state, setState] = useState<string>("Opening the scene…");

  useEffect(() => {
    let cancelled = false;
    loadSharedProject(params.slug)
      .then((shared) => {
        if (cancelled) return;
        if (!shared) {
          setState("This link does not open anything: the scene may no longer be shared.");
          return;
        }
        useEditor.getState().loadProject(shared.project);
        router.replace("/");
      })
      .catch((err) => {
        if (!cancelled) setState(err instanceof Error ? err.message : "Could not open this scene");
      });
    return () => {
      cancelled = true;
    };
  }, [params.slug, router]);

  return <div className="grid h-screen w-screen place-items-center bg-neutral-950 text-sm text-neutral-500">{state}</div>;
}
