"use client";

import { use, useEffect, useMemo } from "react";
import * as THREE from "three";
import type { ModelObject, PartInfo } from "../../types";
import { effectiveMaterial } from "../../store";
import { useRuntime } from "../../runtime";
import { objectPresetById, type GeneratedPart } from "../../presets/objects";
import { loadModel } from "../../lib/model";
import { ObjectMaterial } from "./ObjectMaterial";

type RenderPart = GeneratedPart & { sourceMaterial?: THREE.Material | null };

/** Publishes the object's mesh list so the layers and material panels can target parts. */
function usePublishParts(objectId: string, parts: RenderPart[]) {
  const setParts = useRuntime((s) => s.setParts);
  const infos = useMemo<PartInfo[]>(() => parts.map((p) => ({ id: p.id, name: p.name })), [parts]);
  useEffect(() => {
    setParts(objectId, infos);
  }, [objectId, infos, setParts]);
}

function Parts({ obj, parts }: { obj: ModelObject; parts: RenderPart[] }) {
  usePublishParts(obj.id, parts);
  const scale = obj.size / 2;
  return (
    <group scale={scale}>
      {parts.map((part) => {
        const { material } = effectiveMaterial(obj, part.id);
        const useSource = obj.useSourceMaterials && part.sourceMaterial;
        return (
          <mesh
            key={part.id}
            geometry={part.geometry}
            userData={{ partId: part.id }}
            castShadow
            receiveShadow
          >
            {useSource ? (
              <primitive object={part.sourceMaterial as THREE.Material} attach="material" />
            ) : (
              <ObjectMaterial params={material} />
            )}
          </mesh>
        );
      })}
    </group>
  );
}

function ProceduralModel({ obj }: { obj: ModelObject }) {
  if (obj.source.type !== "procedural") throw new Error("Not a procedural model");
  const { presetId, params } = obj.source;

  const parts = useMemo(() => {
    const preset = objectPresetById(presetId);
    if (!preset) throw new Error(`Unknown object "${presetId}"`);
    const merged: Record<string, number> = {};
    for (const def of preset.params) merged[def.key] = params[def.key] ?? def.default;
    return preset.build(merged);
  }, [presetId, params]);

  // Procedural geometries are built per object, so this component owns them.
  useEffect(() => () => parts.forEach((p) => p.geometry.dispose()), [parts]);

  return <Parts obj={obj} parts={parts} />;
}

function AssetModel({ obj }: { obj: ModelObject }) {
  if (obj.source.type !== "asset") throw new Error("Not an imported model");
  const model = use(loadModel(obj.source.assetId));
  return <Parts obj={obj} parts={model.parts} />;
}

export function ModelMesh({ obj }: { obj: ModelObject }) {
  return obj.source.type === "procedural" ? <ProceduralModel obj={obj} /> : <AssetModel obj={obj} />;
}
