/**
 * The editor is one viewport under floating cards: the tool rail on the left,
 * the panel on the right, the timeline along the bottom, each a rounded card
 * set in from the edge. The picture is fitted to the room left between them,
 * so nothing sits on it; the viewport's own ground runs under everything.
 */
export const GAP = 12;
export const RAIL_WIDTH = 56;
export const PANEL_WIDTH = 320;
/**
 * Room to leave on the left and the right of the picture, in pixels. The rail
 * is thin and stays clear; the panel on the right floats over the picture,
 * which runs on under it, and folds away when the whole frame is wanted.
 */
export const LEFT_INSET = GAP + RAIL_WIDTH + GAP;
export const RIGHT_INSET = GAP;
/** Where the middle of the free room is, relative to the middle of the screen. */
export const CENTRE_SHIFT = (LEFT_INSET - RIGHT_INSET) / 2;
export const CARD = "rounded-2xl border border-white/10 bg-neutral-900/95 shadow-2xl shadow-black/50 backdrop-blur";
