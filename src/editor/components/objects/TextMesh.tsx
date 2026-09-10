"use client";

import { use, type ComponentProps } from "react";
import { Center, Text3D } from "@react-three/drei";
import type { TextObject } from "../../types";
import { fontById } from "../../presets/fonts";
import { loadTypeface } from "../../lib/ttf";
import { ObjectMaterial } from "./ObjectMaterial";

type Text3DFont = ComponentProps<typeof Text3D>["font"];

/** Suspends until the TTF is converted; must be rendered inside a Suspense boundary. */
export function TextMesh({ obj }: { obj: TextObject }) {
  const font = fontById(obj.fontId);
  const data = use(loadTypeface(font.url)) as unknown as Text3DFont;

  const text =
    obj.textCase === "upper"
      ? obj.text.toUpperCase()
      : obj.textCase === "lower"
        ? obj.text.toLowerCase()
        : obj.text;

  const cacheKey = [
    text,
    font.id,
    obj.size,
    obj.depth,
    obj.letterSpacing,
    obj.lineHeight,
    obj.bevelEnabled,
    obj.bevelThickness,
    obj.bevelSize,
    obj.bevelSegments,
    obj.curveSegments,
  ].join("|");

  return (
    <Center cacheKey={cacheKey}>
      <Text3D
        font={data}
        size={obj.size}
        height={obj.depth}
        letterSpacing={obj.letterSpacing}
        lineHeight={obj.lineHeight}
        bevelEnabled={obj.bevelEnabled}
        bevelThickness={obj.bevelThickness}
        bevelSize={obj.bevelSize}
        bevelSegments={obj.bevelSegments}
        curveSegments={obj.curveSegments}
        castShadow
        receiveShadow
      >
        {text || " "}
        <ObjectMaterial params={obj.material} />
      </Text3D>
    </Center>
  );
}
