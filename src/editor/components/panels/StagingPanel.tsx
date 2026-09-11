"use client";

import * as THREE from "three";
import { useEffect, useRef, useState } from "react";
import { Upload } from "lucide-react";
import { useEditor } from "../../store";
import { LightsSection } from "./LightsSection";
import { importEnvironmentFile, listImportedEnvironments } from "../../lib/hdri";
import { deleteAsset, type AssetMeta } from "../../lib/assets";
import { useRuntime } from "../../runtime";
import { DEFAULT_CAMERA, ENVIRONMENTS } from "../../presets/scene";
import { focusField } from "../../lib/postFx";
import { Button, ColorField, Row, Section, SelectField, Slider, Toggle } from "../ui";

export function StagingPanel() {
  const selectedId = useEditor((s) => s.selectedId);
  const objects = useRuntime((s) => s.objects);
  const st = useEditor((s) => s.project.staging);
  const setStaging = useEditor((s) => s.setStaging);
  const requestCameraReset = useRuntime((s) => s.requestCameraReset);
  const setCamera = useEditor((s) => s.setCamera);

  const setFocusPicking = useRuntime((s) => s.setFocusPicking);
  const focusPicking = useRuntime((s) => s.focusPicking);

  const focusTarget = selectedId ? objects[selectedId] : undefined;
  const canFocus = !!focusTarget;

  const [imported, setImported] = useState<AssetMeta[]>([]);
  const [envError, setEnvError] = useState<string | null>(null);
  const hdriRef = useRef<HTMLInputElement>(null);
  const refreshEnvironments = () => {
    listImportedEnvironments().then(setImported).catch(() => setImported([]));
  };
  useEffect(refreshEnvironments, []);
  const importedCurrent = imported.find((a) => `asset:${a.id}` === st.environment);

  const field = focusField({
    focus: st.focusDistance,
    aperture: st.aperture,
    focalLength: st.focalLength,
    worldMm: st.sceneScale,
  });

  /** Prints a world distance the way a lens barrel would, in real units. */
  const asLength = (v: number) => {
    const mm = v * st.sceneScale;
    if (!isFinite(mm)) return "inf";
    if (mm < 1) return `${mm.toFixed(2)}mm`;
    if (mm < 10) return `${mm.toFixed(1)}mm`;
    if (mm < 1000) return `${(mm / 10).toFixed(1)}cm`;
    return `${(mm / 1000).toFixed(2)}m`;
  };

  const magnification =
    field.magnification >= 1
      ? `${field.magnification.toFixed(1)}:1`
      : `1:${(1 / Math.max(0.0001, field.magnification)).toFixed(1)}`;
  // A lens cannot focus closer than its own focal length, whatever the barrel says.
  const tooClose = st.focusDistance * st.sceneScale <= st.focalLength * 1.02;

  /** Reads the distance from the camera to the selected object and focuses there. */
  const focusOnSelection = () => {
    const camera = useRuntime.getState().camera;
    if (!camera || !focusTarget) return;
    const centre = new THREE.Box3().setFromObject(focusTarget).getCenter(new THREE.Vector3());
    setStaging({ focusDistance: camera.position.distanceTo(centre) }, false);
  };

  return (
    <>
      <Section
        title="Environment"
        right={
          <Button variant="ghost" onClick={() => hdriRef.current?.click()} title="Import a .hdr or .exr map" className="flex items-center gap-1">
            <Upload size={12} strokeWidth={1.75} />
            Import
          </Button>
        }
      >
        <SelectField
          label="Map"
          value={st.environment}
          options={[
            ...ENVIRONMENTS.map((e) => ({ value: e.id as string, label: e.name })),
            ...imported.map((a) => ({ value: `asset:${a.id}`, label: `${a.name} · yours` })),
          ]}
          onChange={(environment) => setStaging({ environment }, false)}
        />
        <input
          ref={hdriRef}
          type="file"
          accept=".hdr,.exr,.jpg,.jpeg,.png"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            setEnvError(null);
            try {
              const meta = await importEnvironmentFile(file);
              refreshEnvironments();
              setStaging({ environment: `asset:${meta.id}` }, false);
            } catch (err) {
              setEnvError(err instanceof Error ? err.message : "Could not import that map");
            }
          }}
        />
        {envError && <p className="text-[11px] text-red-300">{envError}</p>}
        {importedCurrent && (
          <Row label="">
            <Button
              variant="ghost"
              onClick={async () => {
                await deleteAsset(importedCurrent.id);
                setStaging({ environment: "studio" }, false);
                refreshEnvironments();
              }}
            >
              Remove this map from your library
            </Button>
          </Row>
        )}
        <Slider label="Intensity" value={st.envIntensity} min={0} max={4} onChange={(envIntensity) => setStaging({ envIntensity })} />
        <Slider
          label="Rotation"
          value={st.envRotation}
          min={-Math.PI}
          max={Math.PI}
          step={0.01}
          format={(v) => `${Math.round((v * 180) / Math.PI)}°`}
          onChange={(envRotation) => setStaging({ envRotation })}
        />
        <Toggle label="Show as bg" value={st.envAsBackground} onChange={(envAsBackground) => setStaging({ envAsBackground }, false)} />
        {st.envAsBackground && (
          <Slider label="Bg blur" value={st.envBlur} min={0} max={1} onChange={(envBlur) => setStaging({ envBlur })} />
        )}
      </Section>

      <Section title="Background">
        <Toggle label="Transparent" value={st.transparent} onChange={(transparent) => setStaging({ transparent }, false)} />
        {!st.transparent && (
          <ColorField label="Color" value={st.background} onChange={(background) => setStaging({ background })} />
        )}
      </Section>

      <LightsSection />

      <Section title="Shadows">
        <Toggle label="Cast" value={st.castShadows} onChange={(castShadows) => setStaging({ castShadows }, false)} />
        {st.castShadows && (
          <>
            <Toggle label="On the floor" value={st.shadowCatcher} onChange={(shadowCatcher) => setStaging({ shadowCatcher }, false)} />
            <p className="text-[11px] leading-relaxed text-neutral-500">
              Each light that casts throws a real shadow onto the objects and, if the floor is on, onto an invisible
              ground at the floor height. Softness is set per light.
            </p>
          </>
        )}
        <Toggle label="Contact" value={st.shadows} onChange={(shadows) => setStaging({ shadows }, false)} />
        {st.shadows && (
          <Slider label="Blur" value={st.shadowBlur} min={0} max={10} step={0.1} onChange={(shadowBlur) => setStaging({ shadowBlur })} />
        )}
        {(st.shadows || st.castShadows) && (
          <>
            <Slider label="Floor" value={st.floorY} min={-5} max={2} onChange={(floorY) => setStaging({ floorY })} />
            <Slider label="Opacity" value={st.shadowOpacity} min={0} max={1} onChange={(shadowOpacity) => setStaging({ shadowOpacity })} />
          </>
        )}
      </Section>

      <Section title="Lens">
        <Slider
          label="Focal length"
          value={st.focalLength}
          min={12}
          max={200}
          step={1}
          format={(v) => `${Math.round(v)}mm`}
          onChange={(focalLength) => setStaging({ focalLength })}
        />
        <p className="text-[11px] leading-relaxed text-neutral-500">
          {st.focalLength < 24
            ? "Wide: exaggerated perspective, good for drama."
            : st.focalLength > 85
              ? "Long: flattened perspective, the packshot look."
              : "Standard: close to how the eye reads a scene."}
        </p>
        <Row label="">
          <Button
            variant="ghost"
            onClick={() => {
              setCamera([...DEFAULT_CAMERA.position], [...DEFAULT_CAMERA.target]);
              requestCameraReset();
            }}
          >
            Reset camera
          </Button>
        </Row>
      </Section>

      <Section title="Depth of field">
        <Toggle
          label="Enabled"
          value={st.depthOfField}
          onChange={(depthOfField) => setStaging({ depthOfField }, false)}
        />
        {st.depthOfField && (
          <>
            <Slider
              label="Focus"
              value={st.focusDistance}
              min={0.02}
              max={60}
              step={0.005}
              logarithmic
              format={() => asLength(st.focusDistance)}
              onChange={(focusDistance) => setStaging({ focusDistance })}
            />
            <Row label="">
              <div className="flex gap-2">
                <Button
                  variant={focusPicking ? "default" : "ghost"}
                  onClick={() => setFocusPicking(!focusPicking)}
                >
                  {focusPicking ? "Click in the frame" : "Pull focus"}
                </Button>
                <Button variant="ghost" onClick={focusOnSelection} disabled={!canFocus}>
                  On selection
                </Button>
              </div>
            </Row>
            <Slider
              label="Aperture"
              value={st.aperture}
              min={0.8}
              max={22}
              step={0.1}
              format={(v) => `f/${v.toFixed(1)}`}
              onChange={(aperture) => setStaging({ aperture })}
            />
            <Slider
              label="Max blur"
              value={st.maxBlur}
              min={2}
              max={60}
              step={1}
              format={(v) => `${Math.round(v)}px`}
              onChange={(maxBlur) => setStaging({ maxBlur })}
            />
            <Slider
              label="Subject size"
              value={st.sceneScale}
              min={2}
              max={400}
              step={1}
              logarithmic
              format={(v) => (v < 10 ? `${v.toFixed(1)}mm/u` : `${(v / 10).toFixed(1)}cm/u`)}
              onChange={(sceneScale) => setStaging({ sceneScale })}
            />
            <SelectField
              label="Iris"
              value={String(st.blades)}
              options={[
                { value: "0", label: "Round" },
                { value: "5", label: "5 blades" },
                { value: "6", label: "6 blades" },
                { value: "7", label: "7 blades" },
                { value: "8", label: "8 blades" },
                { value: "9", label: "9 blades" },
              ]}
              onChange={(v) => setStaging({ blades: parseInt(v, 10) }, false)}
            />
            {st.blades > 0 && (
              <Slider
                label="Iris angle"
                value={st.bladeAngle}
                min={0}
                max={180}
                step={1}
                format={(v) => `${Math.round(v)}°`}
                onChange={(bladeAngle) => setStaging({ bladeAngle })}
              />
            )}
            <Slider
              label="Highlights"
              value={st.bokehHighlight}
              min={0}
              max={2}
              step={0.05}
              format={(v) => (v === 0 ? "Off" : `${v.toFixed(2)}x`)}
              onChange={(bokehHighlight) => setStaging({ bokehHighlight })}
            />
            <div className="mt-1 rounded border border-neutral-800 bg-neutral-950 px-2 py-1.5 font-mono text-[10px] leading-relaxed text-neutral-400">
              <div className="flex justify-between">
                <span>sharp from</span>
                <span className="text-neutral-200">
                  {asLength(field.near)} to {asLength(field.far)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>depth</span>
                <span className="text-neutral-200">{asLength(field.far - field.near)}</span>
              </div>
              <div className="flex justify-between">
                <span>magnification</span>
                <span className="text-neutral-200">
                  {magnification}
                  {field.magnification >= 0.5 ? " macro" : ""}
                </span>
              </div>
              <div className="flex justify-between">
                <span>hyperfocal</span>
                <span className="text-neutral-200">{asLength(field.hyperfocal)}</span>
              </div>
              {tooClose && (
                <div className="mt-1 text-amber-400">closer than a {Math.round(st.focalLength)}mm lens can focus</div>
              )}
            </div>
            <p className="text-[11px] leading-relaxed text-neutral-500">
              Subject size sets what a scene unit measures, so a small subject shot from close up gives the paper-thin
              field of a macro lens. Lower the aperture for a shallower one, and a longer focal length blurs more at the
              same aperture, exactly as on a real camera. Blades give the bokeh the polygon an iris cuts, and highlights
              control how hard bright spots gather into discs.
            </p>
          </>
        )}
      </Section>
    </>
  );
}
