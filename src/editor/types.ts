export type Vec3 = [number, number, number];

export type Transform = {
  position: Vec3;
  /** radians */
  rotation: Vec3;
  scale: Vec3;
};

/** Artwork printed onto a surface, wrapped by the object's own UVs. */
export type Artwork = {
  assetId: string | null;
  /** How many times the artwork repeats around the surface. */
  repeat: number;
  scale: number;
  offsetX: number;
  offsetY: number;
  /** Radians. */
  rotation: number;
  /** Fills the rest of the surface with the material colour when false. */
  tile: boolean;
};

export type MaterialParams = {
  color: string;
  artwork: Artwork;
  roughness: number;
  metalness: number;
  clearcoat: number;
  clearcoatRoughness: number;
  transmission: number;
  thickness: number;
  ior: number;
  iridescence: number;
  sheen: number;
  sheenColor: string;
  emissive: string;
  emissiveIntensity: number;
  opacity: number;
  flatShading: boolean;
  envMapIntensity: number;
};

export type MaterialPreset = {
  id: string;
  name: string;
  category: string;
  params: Partial<MaterialParams>;
};

export type BevelParams = {
  bevelEnabled: boolean;
  bevelThickness: number;
  bevelSize: number;
  bevelSegments: number;
  curveSegments: number;
};

export type MotionPreset = "none" | "spin" | "tumble" | "float" | "orbit" | "swing" | "pulse";

/** Looping movement applied on top of an object's transform. */
export type Motion = {
  preset: MotionPreset;
  /** Cycles per second, so one period is 1/speed seconds. */
  speed: number;
  amount: number;
  /** 0 = X, 1 = Y, 2 = Z. */
  axis: number;
  /** Fraction of a cycle, used to desynchronise several objects. */
  phase: number;
};

/** A material override for one mesh of a multi-layer object. */
export type PartMaterial = {
  material: MaterialParams;
  materialPresetId: string | null;
};

type BaseObject = {
  id: string;
  name: string;
  visible: boolean;
  /** Frozen objects cannot be picked or transformed in the viewport. */
  locked: boolean;
  transform: Transform;
  /** Material used by every part that has no override. */
  material: MaterialParams;
  materialPresetId: string | null;
  /** Per-part overrides, keyed by part id. */
  parts: Record<string, PartMaterial>;
  motion: Motion;
};

export type TextObject = BaseObject &
  BevelParams & {
    kind: "text";
    text: string;
    fontId: string;
    size: number;
    depth: number;
    letterSpacing: number;
    lineHeight: number;
    textCase: "none" | "upper" | "lower";
  };

export type ShapeObject = BaseObject &
  BevelParams & {
    kind: "shape";
    /** raw SVG markup */
    svg: string;
    /** longest side of the extruded shape, world units */
    size: number;
    depth: number;
  };

/** Where a model object's geometry comes from. */
export type ModelSource =
  | { type: "procedural"; presetId: string; params: Record<string, number> }
  | { type: "asset"; assetId: string };

export type ModelObject = BaseObject & {
  kind: "model";
  source: ModelSource;
  /** Longest side of the model in world units. */
  size: number;
  /** Imported models only: render the file's own materials instead of ours. */
  useSourceMaterials: boolean;
};

/** One effect placed on a cover's stack. */
export type EffectInstance = {
  /** Instance id, so the same effect can appear twice. */
  id: string;
  effectId: string;
  enabled: boolean;
  params: Record<string, number>;
  colors: Record<string, string>;
};

export type CoverSource = {
  assetId: string;
  mediaType: "image" | "video";
};

export type CoverObject = BaseObject & {
  kind: "cover";
  source: CoverSource | null;
  effects: EffectInstance[];
  /** Longest side of the plane in world units, ignored in background mode. */
  size: number;
  /** Renders the media as a full-frame backdrop locked to the camera. */
  background: boolean;
  /** Multiplies the media's own aspect, for deliberate stretching. */
  stretch: number;
};

/**
 * Flat typography locked to the frame rather than placed in the scene. It never
 * turns with the camera, which is what a headline on a layout has to do.
 */
export type LabelObject = BaseObject & {
  kind: "label";
  text: string;
  fontId: string;
  /** Cap height as a fraction of the frame height. */
  size: number;
  letterSpacing: number;
  lineHeight: number;
  align: "left" | "center" | "right";
  textCase: "none" | "upper" | "lower";
  color: string;
  opacity: number;
  /** Position on the frame: 0,0 is the centre, ±0.5 the edges. */
  anchorX: number;
  anchorY: number;
  /** Degrees, clockwise on the frame. */
  tilt: number;
};

export type SceneObject = TextObject | ShapeObject | ModelObject | CoverObject | LabelObject;

/** A mesh inside an object, discovered at render time. */
export type PartInfo = { id: string; name: string };

export type EnvironmentId =
  | "studio"
  | "city"
  | "sunset"
  | "dawn"
  | "night"
  | "warehouse"
  | "forest"
  | "apartment"
  | "lobby"
  | "park";

export type Staging = {
  environment: EnvironmentId;
  envIntensity: number;
  /** radians around Y */
  envRotation: number;
  envAsBackground: boolean;
  envBlur: number;
  background: string;
  transparent: boolean;
  lightColor: string;
  lightIntensity: number;
  /** degrees */
  lightAzimuth: number;
  /** degrees */
  lightElevation: number;
  shadows: boolean;
  floorY: number;
  shadowOpacity: number;
  shadowBlur: number;
  fov: number;
  /** Lens focal length in millimetres on a full-frame sensor; drives the field of view. */
  focalLength: number;
  depthOfField: boolean;
  /** Distance in world units that stays sharp. */
  focusDistance: number;
  /** Aperture as an f-number: lower is shallower. */
  aperture: number;
  /** Ceiling on the blur radius, in pixels. */
  maxBlur: number;
  /** Iris blades: 0 keeps the bokeh round, 5 to 9 give it a polygon. */
  blades: number;
  /** Rotation of the iris polygon, in degrees. */
  bladeAngle: number;
  /** How strongly highlights bloom into bokeh discs. */
  highlight: number;
};

export type CanvasFormat = {
  id: string;
  name: string;
  width: number;
  height: number;
  group: string;
};

export type Project = {
  id: string;
  name: string;
  objects: SceneObject[];
  staging: Staging;
  formatId: string;
  customFormat: { width: number; height: number };
  camera: { position: Vec3; target: Vec3 };
};
