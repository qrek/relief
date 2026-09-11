import type { Project } from "../types";

/**
 * A finished picture with everything that made it: subject, type, light, lens
 * and the look. It is a starting point the designer takes over, not a fill-in
 * form, which is why each one is a real composition rather than an object on
 * a backdrop. Ids are fixed so a template opens the same way every time; the
 * project itself gets a fresh id on load.
 */
export type TemplateDef = {
  id: string;
  name: string;
  /** One line on what the picture is for and what carries it. */
  blurb: string;
  /** Rendered by the app itself, from the template as it is. */
  thumbnail: string;
  project: Omit<Project, "id">;
};

export const TEMPLATES: TemplateDef[] = [
  {
    id: "like-no-one",
    name: "Like no one",
    blurb: "A three-line headline at the back, a faceted stone in front, and the whole sheet run through a four-colour press. Portrait, for a poster or a feed.",
    thumbnail: "/templates/like-no-one.jpg",
    project: {
      "name": "Like no one",
      "formatId": "portrait",
      "customFormat": {
        "width": 1600,
        "height": 1200
      },
      "camera": {
        "position": [
          -9.573818658013344,
          2.0022128436267863,
          12.635099455391465
        ],
        "target": [
          0,
          0,
          0
        ]
      },
      "staging": {
        "environment": "studio",
        "envIntensity": 0.28,
        "envRotation": 0.6,
        "envAsBackground": false,
        "envBlur": 0.6,
        "background": "#e9e6df",
        "transparent": false,
        "lightColor": "#ffe9c4",
        "lightIntensity": 3.4,
        "lightAzimuth": -42,
        "lightElevation": 48,
        "shadows": false,
        "floorY": -1.2,
        "shadowOpacity": 0.5,
        "shadowBlur": 2,
        "fov": 35,
        "focalLength": 55,
        "depthOfField": false,
        "focusDistance": 8,
        "aperture": 2.8,
        "maxBlur": 18,
        "blades": 0,
        "bladeAngle": 0,
        "bokehHighlight": 1,
        "sceneScale": 50,
        "look": [
          {
            "id": "look-print",
            "effectId": "cmyk",
            "enabled": true,
            "params": {
              "scale": 240,
              "angle": 0,
              "gain": 1,
              "black": 0.38,
              "soft": 0.06,
              "fill": 0.62
            },
            "colors": {
              "paper": "#e9e6df"
            }
          },
          {
            "id": "look-grain",
            "effectId": "grain",
            "enabled": true,
            "params": {
              "amount": 0.05,
              "size": 1.2,
              "speed": 0
            },
            "colors": {}
          }
        ]
      },
      "objects": [
        {
          "id": "headline",
          "kind": "label",
          "name": "LIKE\nNO\nONE",
          "visible": true,
          "locked": false,
          "transform": {
            "position": [
              0,
              0,
              0
            ],
            "rotation": [
              0,
              0,
              0
            ],
            "scale": [
              1,
              1,
              1
            ]
          },
          "material": {
            "color": "#f5f5f5",
            "artwork": {
              "assetId": null,
              "repeat": 1,
              "scale": 0.5,
              "offsetX": 0.5,
              "offsetY": 0,
              "rotation": 0,
              "tile": false
            },
            "roughness": 0.9,
            "metalness": 0,
            "clearcoat": 0,
            "clearcoatRoughness": 0.1,
            "transmission": 0,
            "thickness": 1,
            "ior": 1.5,
            "iridescence": 0,
            "sheen": 0,
            "sheenColor": "#ffffff",
            "emissive": "#000000",
            "emissiveIntensity": 1,
            "opacity": 1,
            "flatShading": false,
            "envMapIntensity": 1
          },
          "materialPresetId": "matte-white",
          "parts": {},
          "motion": {
            "preset": "none",
            "speed": 0.25,
            "amount": 0.4,
            "axis": 1,
            "phase": 0
          },
          "text": "LIKE\nNO\nONE",
          "fontId": "staatliches",
          "size": 0.258,
          "letterSpacing": -0.005,
          "lineHeight": 0.88,
          "align": "center",
          "textCase": "upper",
          "color": "#2a62ff",
          "opacity": 1,
          "anchorX": 0,
          "anchorY": -0.01,
          "tilt": 0,
          "depth": "behind"
        },
        {
          "id": "stone",
          "kind": "model",
          "name": "Stone",
          "visible": true,
          "locked": false,
          "transform": {
            "position": [
              0.08,
              0.02,
              0
            ],
            "rotation": [
              0.46,
              -0.62,
              0.1
            ],
            "scale": [
              1,
              1,
              1
            ]
          },
          "material": {
            "color": "#f7b500",
            "artwork": {
              "assetId": null,
              "repeat": 1,
              "scale": 0.5,
              "offsetX": 0.5,
              "offsetY": 0,
              "rotation": 0,
              "tile": false
            },
            "roughness": 0.9,
            "metalness": 0,
            "clearcoat": 0,
            "clearcoatRoughness": 0.1,
            "transmission": 0,
            "thickness": 1,
            "ior": 1.5,
            "iridescence": 0,
            "sheen": 0,
            "sheenColor": "#ffffff",
            "emissive": "#000000",
            "emissiveIntensity": 1,
            "opacity": 1,
            "flatShading": true,
            "envMapIntensity": 0.5
          },
          "materialPresetId": null,
          "parts": {},
          "motion": {
            "preset": "none",
            "speed": 0.25,
            "amount": 0.4,
            "axis": 1,
            "phase": 0
          },
          "source": {
            "type": "procedural",
            "presetId": "pebble",
            "params": {
              "amount": 0.24,
              "seed": 7,
              "detail": 22
            }
          },
          "size": 3.7,
          "useSourceMaterials": false
        }
      ]
    },
  },
];

export function templateById(id: string): TemplateDef | undefined {
  return TEMPLATES.find((t) => t.id === id);
}
