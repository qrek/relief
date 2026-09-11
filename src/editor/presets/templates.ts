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
  /**
   * The project as it was saved. It is typed loosely on purpose: it goes
   * through normalizeProject on load, which is also what lets a template
   * written before a field existed keep opening.
   */
  project: Record<string, unknown>;
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
          "lineHeight": 1.25,
          "align": "center",
          "textCase": "upper",
          "color": "#2a62ff",
          "opacity": 1,
          "anchorX": 0,
          "anchorY": -0.03,
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
  {
    id: "open-sign",
    name: "Open sign",
    blurb: "One word in lit diodes on a dark board, with the glow a real sign throws. Square, for a post or an avatar. Type your own word.",
    thumbnail: "/templates/open-sign.jpg",
    project: {
      "name": "Open sign",
      "formatId": "square",
      "customFormat": {
        "width": 1600,
        "height": 1200
      },
      "camera": {
        "position": [
          0,
          0.1,
          8.4
        ],
        "target": [
          0,
          0,
          0
        ]
      },
      "staging": {
        "environment": "studio",
        "envIntensity": 0.1,
        "envRotation": 0,
        "envAsBackground": false,
        "envBlur": 0.6,
        "background": "#030403",
        "transparent": false,
        "lightColor": "#ffffff",
        "lightIntensity": 2.2,
        "lightAzimuth": -30,
        "lightElevation": 25,
        "shadows": false,
        "floorY": -1.2,
        "shadowOpacity": 0.5,
        "shadowBlur": 2,
        "fov": 35,
        "focalLength": 50,
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
            "id": "look-led",
            "effectId": "led",
            "enabled": true,
            "params": {
              "pitch": 60,
              "dot": 0.7,
              "gain": 1.5,
              "cut": 0.06,
              "sat": 1.8
            },
            "colors": {
              "bg": "#040604",
              "off": "#0f1f10"
            }
          },
          {
            "id": "look-glow",
            "effectId": "bloom",
            "enabled": true,
            "params": {
              "threshold": 0.5,
              "radius": 18,
              "intensity": 0.9,
              "knee": 0.7
            },
            "colors": {}
          }
        ]
      },
      "objects": [
        {
          "id": "word",
          "kind": "text",
          "name": "OPEN",
          "visible": true,
          "locked": false,
          "transform": {
            "position": [
              0,
              0.02,
              0
            ],
            "rotation": [
              0.06,
              -0.38,
              0
            ],
            "scale": [
              1,
              1,
              1
            ]
          },
          "material": {
            "color": "#178f36",
            "artwork": {
              "assetId": null,
              "repeat": 1,
              "scale": 0.5,
              "offsetX": 0.5,
              "offsetY": 0,
              "rotation": 0,
              "tile": false
            },
            "roughness": 0.92,
            "metalness": 0,
            "clearcoat": 0,
            "clearcoatRoughness": 0.1,
            "transmission": 0,
            "thickness": 1,
            "ior": 1.5,
            "iridescence": 0,
            "sheen": 0,
            "sheenColor": "#ffffff",
            "emissive": "#0f7a2c",
            "emissiveIntensity": 1,
            "opacity": 1,
            "flatShading": false,
            "envMapIntensity": 1
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
          "text": "OPEN",
          "fontId": "staatliches",
          "size": 1.3,
          "depth": 0.42,
          "letterSpacing": 0.02,
          "lineHeight": 1,
          "textCase": "none",
          "bevelEnabled": false,
          "bevelThickness": 0.03,
          "bevelSize": 0.02,
          "bevelSegments": 4,
          "curveSegments": 8
        }
      ]
    },
  },
  {
    id: "carpe-feed",
    name: "Carpe feed",
    blurb: "A liquid chrome mass on paper, a condensed headline above, the small print below. Portrait, for a poster or a story. Swap the words, keep the silence around them.",
    thumbnail: "/templates/carpe-feed.jpg",
    project: {
      "name": "Carpe feed",
      "formatId": "portrait",
      "customFormat": {
        "width": 1600,
        "height": 1200
      },
      "camera": {
        "position": [
          0,
          0.2,
          9.5
        ],
        "target": [
          0,
          0.1,
          0
        ]
      },
      "staging": {
        "environment": "studio",
        "envIntensity": 1.5,
        "envRotation": 2.4,
        "envAsBackground": false,
        "envBlur": 0.6,
        "background": "#eeeae3",
        "transparent": false,
        "lightColor": "#ffffff",
        "lightIntensity": 0.8,
        "lightAzimuth": 30,
        "lightElevation": 55,
        "shadows": false,
        "floorY": -1.2,
        "shadowOpacity": 0.5,
        "shadowBlur": 2,
        "fov": 35,
        "focalLength": 65,
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
            "id": "look-glow",
            "effectId": "bloom",
            "enabled": true,
            "params": {
              "threshold": 0.86,
              "radius": 22,
              "intensity": 0.4,
              "knee": 0.5
            },
            "colors": {}
          },
          {
            "id": "look-grain",
            "effectId": "grain",
            "enabled": true,
            "params": {
              "amount": 0.06,
              "size": 1.1,
              "speed": 0
            },
            "colors": {}
          }
        ]
      },
      "objects": [
        {
          "id": "chrome",
          "kind": "model",
          "name": "Chrome",
          "visible": true,
          "locked": false,
          "transform": {
            "position": [
              0,
              0.04,
              0
            ],
            "rotation": [
              0.55,
              0.35,
              0.1
            ],
            "scale": [
              1.08,
              0.82,
              1
            ]
          },
          "material": {
            "color": "#d9dde3",
            "artwork": {
              "assetId": null,
              "repeat": 1,
              "scale": 0.5,
              "offsetX": 0.5,
              "offsetY": 0,
              "rotation": 0,
              "tile": false
            },
            "roughness": 0.08,
            "metalness": 1,
            "clearcoat": 1,
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
          "materialPresetId": "liquid-metal",
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
            "presetId": "blob",
            "params": {
              "amount": 0.42,
              "freq": 0.7,
              "seed": 9,
              "detail": 180
            }
          },
          "size": 2.2,
          "useSourceMaterials": false
        },
        {
          "id": "headline",
          "kind": "label",
          "name": "CARPE FEED.\nMEMENTO MORE.",
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
          "text": "CARPE FEED.\nMEMENTO MORE.",
          "fontId": "staatliches",
          "size": 0.05,
          "letterSpacing": 0.01,
          "lineHeight": 1.12,
          "align": "center",
          "textCase": "upper",
          "color": "#111111",
          "opacity": 1,
          "anchorX": 0,
          "anchorY": 0.395,
          "tilt": 0,
          "depth": "front"
        },
        {
          "id": "caption",
          "kind": "label",
          "name": "Caption",
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
          "text": "BY CONTINUING TO SCROLL, YOU AGREE TO: LOSE TRACK OF TIME,\nQUESTION YOUR LIFE CHOICES, AND PRETEND TOMORROW WILL BE DIFFERENT.\nNO REFUNDS ON WASTED HOURS.",
          "fontId": "inter",
          "size": 0.0105,
          "letterSpacing": 0.03,
          "lineHeight": 1.55,
          "align": "center",
          "textCase": "upper",
          "color": "#222222",
          "opacity": 1,
          "anchorX": 0,
          "anchorY": -0.41,
          "tilt": 0,
          "depth": "front"
        }
      ]
    },
  },
];

export function templateById(id: string): TemplateDef | undefined {
  return TEMPLATES.find((t) => t.id === id);
}
