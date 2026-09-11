"use client";

import { LOOK_ID, useEditor } from "../../store";
import { EffectStack } from "./EffectsPanel";

/**
 * The finish over the whole picture. It has its own tab because it is a
 * different act from treating one image: a look changes the print, not a
 * subject, and it is the last thing a designer reaches for before export.
 */
export function LookPanel() {
  const look = useEditor((s) => s.project.staging.look);
  const covers = useEditor((s) => s.project.objects.filter((o) => o.kind === "cover").length);

  return (
    <>
      <p className="border-b border-white/5 px-3 py-3 text-[11px] leading-relaxed text-neutral-500">
        Effects over the whole picture once it is finished: type, objects and media alike, after depth of field.
        This is what turns a render into a print, a screen or a photograph.
        {covers > 0 && (
          <>
            {" "}
            An effect meant for one image or video only belongs on that cover, under its Effects tab.
          </>
        )}
      </p>
      <EffectStack
        ownerId={LOOK_ID}
        effects={look}
        title="Look"
        hint="Nothing yet. Try Colour halftone with Grain for a print, Bloom with Aberration for a photograph, or Pixelate with Scanlines for a screen."
        showcase
      />
    </>
  );
}
