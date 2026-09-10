import type { MaterialParams, MaterialPreset } from "../types";

export const DEFAULT_ARTWORK = {
  assetId: null,
  repeat: 1,
  // Half a turn brings the label to the front of a lathed object, so a logo
  // dropped on a can or a bottle faces the camera straight away.
  scale: 0.5,
  offsetX: 0.5,
  offsetY: 0,
  rotation: 0,
  tile: false,
};

export const DEFAULT_MATERIAL: MaterialParams = {
  color: "#f2f2f2",
  artwork: { ...DEFAULT_ARTWORK },
  roughness: 0.4,
  metalness: 0,
  clearcoat: 0,
  clearcoatRoughness: 0.1,
  transmission: 0,
  thickness: 1,
  ior: 1.5,
  iridescence: 0,
  sheen: 0,
  sheenColor: "#ffffff",
  emissive: "#000000",
  emissiveIntensity: 1,
  opacity: 1,
  flatShading: false,
  envMapIntensity: 1,
};

const p = (
  id: string,
  name: string,
  category: string,
  params: Partial<MaterialParams>,
): MaterialPreset => ({ id, name, category, params });

export const MATERIAL_PRESETS: MaterialPreset[] = [
  // Basic
  p("matte-white", "Matte White", "Basic", { color: "#f5f5f5", roughness: 0.9 }),
  p("matte-black", "Matte Black", "Basic", { color: "#141414", roughness: 0.85 }),
  p("soft-clay", "Soft Clay", "Basic", { color: "#e8d5c4", roughness: 0.7 }),
  p("chalk-blue", "Chalk Blue", "Basic", { color: "#9db9d6", roughness: 0.95 }),
  p("concrete", "Concrete", "Basic", { color: "#8d8d8d", roughness: 1 }),
  p("flat-coral", "Flat Coral", "Basic", { color: "#ff7a59", roughness: 1, flatShading: true }),
  p("flat-mint", "Flat Mint", "Basic", { color: "#7fe0c3", roughness: 1, flatShading: true }),

  // Metal
  p("chrome", "Chrome", "Metal", { color: "#ffffff", roughness: 0.04, metalness: 1 }),
  p("gold", "Gold", "Metal", { color: "#ffc94d", roughness: 0.18, metalness: 1 }),
  p("rose-gold", "Rose Gold", "Metal", { color: "#e3a898", roughness: 0.22, metalness: 1 }),
  p("copper", "Copper", "Metal", { color: "#d97a45", roughness: 0.3, metalness: 1 }),
  p("brushed-steel", "Brushed Steel", "Metal", { color: "#b8bcc2", roughness: 0.45, metalness: 1 }),
  p("gunmetal", "Gunmetal", "Metal", { color: "#3a3d42", roughness: 0.35, metalness: 1 }),
  p("titanium", "Titanium", "Metal", { color: "#8a8f99", roughness: 0.28, metalness: 1 }),
  p("liquid-metal", "Liquid Metal", "Metal", { color: "#d9dde3", roughness: 0.08, metalness: 1, clearcoat: 1 }),

  // Glass
  p("clear-glass", "Clear Glass", "Glass", { color: "#ffffff", roughness: 0, transmission: 1, thickness: 1.5, ior: 1.5 }),
  p("frosted-glass", "Frosted Glass", "Glass", { color: "#ffffff", roughness: 0.35, transmission: 1, thickness: 1, ior: 1.45 }),
  p("soapy-glass", "Soapy Glass", "Glass", { color: "#ffffff", roughness: 0.05, transmission: 1, thickness: 0.8, ior: 1.4, iridescence: 1 }),
  p("amber-glass", "Amber Glass", "Glass", { color: "#ffb347", roughness: 0.05, transmission: 0.95, thickness: 1.2, ior: 1.5 }),
  p("crystal", "Crystal", "Glass", { color: "#ffffff", roughness: 0, transmission: 1, thickness: 2, ior: 2.4 }),
  p("liquid-glass", "Liquid Glass", "Glass", { color: "#ffffff", roughness: 0.08, transmission: 1, thickness: 0.4, ior: 1.3, clearcoat: 1 }),
  p("sea-glass", "Sea Glass", "Glass", { color: "#8fe3d6", roughness: 0.4, transmission: 0.9, thickness: 1, ior: 1.45 }),

  // Plastic
  p("glossy-red", "Glossy Red", "Plastic", { color: "#ff3b30", roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.08 }),
  p("glossy-blue", "Glossy Blue", "Plastic", { color: "#2f6bff", roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.08 }),
  p("candy-pink", "Candy Pink", "Plastic", { color: "#ff5da2", roughness: 0.25, clearcoat: 1, sheen: 0.4, sheenColor: "#ffd1e8" }),
  p("lime", "Lime", "Plastic", { color: "#b6f542", roughness: 0.3, clearcoat: 0.8 }),
  p("toy-yellow", "Toy Yellow", "Plastic", { color: "#ffd60a", roughness: 0.3, clearcoat: 0.9 }),
  p("soft-peach", "Soft Peach", "Plastic", { color: "#ffc8a8", roughness: 0.55, clearcoat: 0.3 }),
  p("rubber-black", "Rubber Black", "Plastic", { color: "#111111", roughness: 1 }),
  p("lavender", "Lavender", "Plastic", { color: "#b9a7ff", roughness: 0.4, clearcoat: 0.6 }),

  // Special
  p("pearl", "Pearl", "Special", { color: "#f8f4ff", roughness: 0.2, clearcoat: 1, iridescence: 1 }),
  p("holographic", "Holographic", "Special", { color: "#cfd8ff", roughness: 0.1, metalness: 1, iridescence: 1 }),
  p("oil-slick", "Oil Slick", "Special", { color: "#1a1a1a", roughness: 0.2, metalness: 0.8, iridescence: 1 }),
  p("velvet-purple", "Velvet Purple", "Special", { color: "#5b2a86", roughness: 1, sheen: 1, sheenColor: "#d9b8ff" }),
  p("bubblegum", "Bubblegum", "Special", { color: "#ff8fcf", roughness: 0.6, sheen: 1, sheenColor: "#ffd6f0" }),
  p("wax", "Wax", "Special", { color: "#fff1d6", roughness: 0.5, transmission: 0.3, thickness: 1.5, ior: 1.4 }),

  // Emissive
  p("neon-pink", "Neon Pink", "Emissive", { color: "#ff2d95", emissive: "#ff2d95", emissiveIntensity: 2, roughness: 0.4 }),
  p("neon-cyan", "Neon Cyan", "Emissive", { color: "#19e6ff", emissive: "#19e6ff", emissiveIntensity: 2, roughness: 0.4 }),
  p("lava", "Lava", "Emissive", { color: "#ff6a00", emissive: "#ff2200", emissiveIntensity: 1.5, roughness: 0.8 }),
];

export const MATERIAL_CATEGORIES = Array.from(
  new Set(MATERIAL_PRESETS.map((m) => m.category)),
);

export function materialFromPreset(id: string): MaterialParams {
  const preset = MATERIAL_PRESETS.find((m) => m.id === id);
  return { ...DEFAULT_MATERIAL, ...(preset?.params ?? {}) };
}
