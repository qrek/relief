export type ShapeEntry = { id: string; name: string; svg: string };

const wrap = (inner: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${inner}</svg>`;

export const SHAPES: ShapeEntry[] = [
  { id: "circle", name: "Circle", svg: wrap('<circle cx="50" cy="50" r="45"/>') },
  { id: "square", name: "Square", svg: wrap('<rect x="8" y="8" width="84" height="84"/>') },
  { id: "rounded", name: "Rounded", svg: wrap('<rect x="8" y="8" width="84" height="84" rx="22"/>') },
  { id: "triangle", name: "Triangle", svg: wrap('<polygon points="50,6 96,92 4,92"/>') },
  { id: "hexagon", name: "Hexagon", svg: wrap('<polygon points="50,4 92,27 92,73 50,96 8,73 8,27"/>') },
  {
    id: "star",
    name: "Star",
    svg: wrap('<polygon points="50,4 61,36 96,36 68,57 78,92 50,71 22,92 32,57 4,36 39,36"/>'),
  },
  {
    id: "heart",
    name: "Heart",
    svg: wrap(
      '<path d="M50 92 L14 54 C2 40 8 16 30 14 C40 13 47 20 50 26 C53 20 60 13 70 14 C92 16 98 40 86 54 Z"/>',
    ),
  },
  {
    id: "ring",
    name: "Ring",
    svg: wrap(
      '<path fill-rule="evenodd" d="M50 5 A45 45 0 1 0 50 95 A45 45 0 1 0 50 5 Z M50 30 A20 20 0 1 1 50 70 A20 20 0 1 1 50 30 Z"/>',
    ),
  },
  {
    id: "arrow",
    name: "Arrow",
    svg: wrap('<polygon points="4,36 56,36 56,12 96,50 56,88 56,64 4,64"/>'),
  },
  {
    id: "cross",
    name: "Cross",
    svg: wrap('<polygon points="34,4 66,4 66,34 96,34 96,66 66,66 66,96 34,96 34,66 4,66 4,34 34,34"/>'),
  },
  {
    id: "blob",
    name: "Blob",
    svg: wrap(
      '<path d="M78 18 C96 32 98 62 84 80 C70 98 38 98 20 84 C2 70 4 40 20 22 C36 4 60 4 78 18 Z"/>',
    ),
  },
  {
    id: "lightning",
    name: "Lightning",
    svg: wrap('<polygon points="58,4 22,54 46,54 38,96 78,42 54,42"/>'),
  },
  {
    id: "pill",
    name: "Pill",
    svg: wrap('<rect x="4" y="30" width="92" height="40" rx="20"/>'),
  },
  {
    id: "diamond",
    name: "Diamond",
    svg: wrap('<polygon points="50,4 96,50 50,96 4,50"/>'),
  },
];
