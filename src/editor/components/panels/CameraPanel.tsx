"use client";

import { Video } from "lucide-react";
import { useEditor } from "../../store";
import { useRuntime } from "../../runtime";
import { sceneClock } from "../../lib/clock";
import { CAMERA_CHANNELS, keyStateOf, sampleCamera } from "../../lib/keyframes";
import { Button, Row, Section, Slider, Vec3Field } from "../ui";
import { useClockTick } from "../useClockTick";

/**
 * The camera as a thing in the scene: where it stands, what it looks at, the
 * lens on it and where that lens is focused. Each of those can be keyed, so a
 * camera move is a key here and a key there. The rest of the lens (aperture,
 * bokeh) stays in Scene: it is the picture's grammar, not a move.
 */
export function CameraPanel() {
  const camera = useEditor((s) => s.project.camera);
  const focalLength = useEditor((s) => s.project.staging.focalLength);
  const focusDistance = useEditor((s) => s.project.staging.focusDistance);
  const depthOfField = useEditor((s) => s.project.staging.depthOfField);
  const setCamera = useEditor((s) => s.setCamera);
  const setStaging = useEditor((s) => s.setStaging);
  const toggleKeys = useEditor((s) => s.toggleKeys);
  const viewMode = useEditor((s) => s.viewMode);
  const setViewMode = useEditor((s) => s.setViewMode);
  const tick = useClockTick();

  // Keyed channels show what their keys say right now.
  const shown = sampleCamera(camera.keys, tick.time, camera, focalLength, focusDistance);
  const keying = (channel: keyof typeof CAMERA_CHANNELS) => ({
    keyState: keyStateOf(camera.keys, CAMERA_CHANNELS[channel], tick.time),
    onKey: () => toggleKeys({ kind: "camera", channels: CAMERA_CHANNELS[channel] }, sceneClock.clipTime),
  });
  const place = (position: [number, number, number], target: [number, number, number]) => {
    setCamera(position, target);
    // The orbit controls hold their own copy of the target; a reset resyncs them.
    useRuntime.getState().requestCameraReset();
  };

  return (
    <>
      <div className="flex items-center gap-2 border-b border-white/5 px-3 py-3">
        <Video size={15} strokeWidth={1.75} className="text-[var(--accent)]" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-neutral-100">Camera</div>
          <div className="text-[11px] text-neutral-500">The eye the picture is taken through</div>
        </div>
      </div>

      <Section title="Placement">
        <Vec3Field label="Position" value={shown.position} onChange={(position) => place(position, shown.target)} {...keying("position")} />
        <Vec3Field label="Looks at" value={shown.target} onChange={(target) => place(shown.position, target)} {...keying("target")} />
        <Row label="">
          <div className="flex flex-wrap gap-1">
            {viewMode !== "camera" ? (
              <Button variant="ghost" onClick={() => setViewMode("camera")} title="Look through the camera (0)">
                Look through
              </Button>
            ) : (
              <Button variant="ghost" onClick={() => setViewMode("free")} title="Step out and see the camera in the set (0)">
                See it in the set
              </Button>
            )}
            <Button
              variant="ghost"
              onClick={() => {
                const free = useRuntime.getState().freeView;
                place(free.camera.position.toArray() as [number, number, number], free.target.toArray() as [number, number, number]);
                setViewMode("camera");
              }}
              title="Move the camera to the free view's point of view"
              disabled={viewMode === "camera"}
            >
              Shoot from here
            </Button>
          </div>
        </Row>
        <p className="text-[11px] leading-relaxed text-neutral-500">
          In the free view the camera is drawn in the set: click it and drag it with the gizmo. Orbiting in the camera view
          moves it too. Key Position and Looks at, and a camera move plays between the keys.
        </p>
      </Section>

      <Section title="Lens">
        <Slider
          label="Focal length"
          value={shown.focal}
          min={14}
          max={200}
          step={1}
          format={(v) => `${Math.round(v)} mm`}
          onChange={(focalLength) => setStaging({ focalLength })}
          {...keying("focal")}
        />
        <Slider
          label="Focus"
          value={shown.focus}
          min={0.02}
          max={60}
          step={0.01}
          logarithmic
          format={(v) => (v < 1 ? `${(v * 100).toFixed(0)} cm` : `${v.toFixed(2)} m`)}
          onChange={(focusDistance) => setStaging({ focusDistance })}
          {...keying("focus")}
        />
        <p className="text-[11px] leading-relaxed text-neutral-500">
          {depthOfField
            ? "A keyed focal length is a zoom; a keyed focus is a pull, from one subject to another. Aperture and bokeh are in Scene."
            : "Depth of field is off in Scene, so focus has no effect on the picture yet; a keyed focal length still zooms."}
        </p>
      </Section>
    </>
  );
}
