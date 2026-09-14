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

/** How a value moves from one key to the next. */
export type Ease = "linear" | "smooth" | "in" | "out";

/** One value at one moment of the clip. */
export type Key = { id: string; t: number; v: number; ease: Ease };

/**
 * Keys per animated channel, sorted by time: "position.x" on an object,
 * "scale" on an effect. A channel nobody keyed is simply absent.
 */
export type KeyTracks = Record<string, Key[]>;

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
  /**
   * Keyed transform channels. A keyed channel is wherever its keys say at the
   * clip's current time, and changing it writes the key at that time; the
   * other channels follow the plain transform. The looping motion plays on top.
   */
  keys: KeyTracks;
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
  /** Keyed numeric parameters, by parameter key. */
  keys: KeyTracks;
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
  /**
   * Front: drawn over everything, the caption on a print. Behind: sits at the
   * back of the scene and objects pass in front of it, the headline a subject
   * floats over on a poster.
   */
  depth: "front" | "behind";
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

export type LightType = "sun" | "spot" | "point";

/**
 * One light on a sphere around the subject. A sun is a parallel light and
 * ignores distance except to frame its shadow; a spot and a point sit at the
 * distance given. Angles are in degrees on the panel and in the file.
 */
export type SceneLight = {
  id: string;
  name: string;
  type: LightType;
  enabled: boolean;
  color: string;
  intensity: number;
  azimuth: number;
  elevation: number;
  distance: number;
  /** Spot only: full cone angle, and how soft its edge is from 0 to 1. */
  angle: number;
  penumbra: number;
  castShadow: boolean;
  /** Blur radius of the shadow this light casts. */
  softness: number;
};

export type Staging = {
  /** A preset id, or `asset:<id>` for an imported equirectangular map. */
  environment: EnvironmentId | string;
  envIntensity: number;
  /** radians around Y */
  envRotation: number;
  envAsBackground: boolean;
  envBlur: number;
  background: string;
  transparent: boolean;
  lights: SceneLight[];
  /** Lights cast real shadows onto objects and onto the floor catcher. */
  castShadows: boolean;
  /** An invisible floor that receives cast shadows, at floorY. */
  shadowCatcher: boolean;
  /** Contact shadows: the soft dark pool under everything. */
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
  /** How strongly highlights gather into bokeh discs. */
  bokehHighlight: number;
  /**
   * How the picture is developed from the scene's light. ACES is punchy and
   * pulls saturated colours toward white; AgX keeps them, like film; Neutral
   * changes hue least, for brand colours that must stay exact.
   */
  tone: "aces" | "agx" | "neutral";
  /** Exposure of the development, 1 as shot. */
  exposure: number;
  /** Millimetres one world unit stands for. Smaller turns the lens macro. */
  sceneScale: number;
  /**
   * Effects run over the finished frame, type and objects alike, after depth of
   * field and tone mapping. This is what turns a render into a print.
   */
  look: EffectInstance[];
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
  /** The shot camera: where it stands, what it looks at, and its keyed channels (position, target, focal, focus). */
  camera: { position: Vec3; target: Vec3; keys: KeyTracks };
  /** The clip the keyframes live in: it loops, and a video export is one pass of it. */
  clip: { duration: number };
  /** The row this project is saved as in the cloud, once it has been; null for a local-only project. */
  cloudId: string | null;
};
