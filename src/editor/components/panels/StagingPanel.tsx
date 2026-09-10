"use client";

import * as THREE from "three";
import { useEditor } from "../../store";
import { useRuntime } from "../../runtime";
import { DEFAULT_CAMERA, ENVIRONMENTS } from "../../presets/scene";
import { Button, ColorField, Row, Section, SelectField, Slider, Toggle } from "../ui";

export function StagingPanel() {
  const selectedId = useEditor((s) => s.selectedId);
  const objects = useRuntime((s) => s.objects);
  const st = useEditor((s) => s.project.staging);
  const setStaging = useEditor((s) => s.setStaging);
  const requestCameraReset = useRuntime((s) => s.requestCameraReset);
  const setCamera = useEditor((s) => s.setCamera);

  const focusTarget = selectedId ? objects[selectedId] : undefined;
  const canFocus = !!focusTarget;

  /** Reads the distance from the camera to the selected object and focuses there. */
  const focusOnSelection = () => {
    const camera = useRuntime.getState().camera;
    if (!camera || !focusTarget) return;
    const centre = new THREE.Box3().setFromObject(focusTarget).getCenter(new THREE.Vector3());
    setStaging({ focusDistance: camera.position.distanceTo(centre) }, false);
  };

  return (
    <>
      <Section title="Environment">
        <SelectField
          label="HDRI"
          value={st.environment}
          options={ENVIRONMENTS.map((e) => ({ value: e.id, label: e.name }))}
          onChange={(environment) => setStaging({ environment }, false)}
        />
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

      <Section title="Light">
        <ColorField label="Color" value={st.lightColor} onChange={(lightColor) => setStaging({ lightColor })} />
        <Slider label="Intensity" value={st.lightIntensity} min={0} max={8} onChange={(lightIntensity) => setStaging({ lightIntensity })} />
        <Slider label="Azimuth" value={st.lightAzimuth} min={-180} max={180} step={1} format={(v) => `${Math.round(v)}°`} onChange={(lightAzimuth) => setStaging({ lightAzimuth })} />
        <Slider label="Elevation" value={st.lightElevation} min={-10} max={90} step={1} format={(v) => `${Math.round(v)}°`} onChange={(lightElevation) => setStaging({ lightElevation })} />
      </Section>

      <Section title="Shadows">
        <Toggle label="Enabled" value={st.shadows} onChange={(shadows) => setStaging({ shadows }, false)} />
        {st.shadows && (
          <>
            <Slider label="Floor" value={st.floorY} min={-5} max={2} onChange={(floorY) => setStaging({ floorY })} />
            <Slider label="Opacity" value={st.shadowOpacity} min={0} max={1} onChange={(shadowOpacity) => setStaging({ shadowOpacity })} />
            <Slider label="Blur" value={st.shadowBlur} min={0} max={10} step={0.1} onChange={(shadowBlur) => setStaging({ shadowBlur })} />
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
              min={0.5}
              max={40}
              step={0.05}
              format={(v) => `${v.toFixed(2)}m`}
              onChange={(focusDistance) => setStaging({ focusDistance })}
            />
            <Row label="">
              <Button variant="default" onClick={focusOnSelection} disabled={!canFocus}>
                {canFocus ? "Focus on selection" : "Select an object to focus"}
              </Button>
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
            <p className="text-[11px] leading-relaxed text-neutral-500">
              Lower the aperture for a shallower field. A longer focal length blurs more at the same aperture, exactly
              as it would on a camera. Blades give the bokeh the polygon a real iris cuts.
            </p>
          </>
        )}
      </Section>
    </>
  );
}
