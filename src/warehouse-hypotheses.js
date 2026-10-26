/**
 * The warehouse's figures that come from the research (docs/recherche/hypotheses.md), here and nowhere else. A turn is
 * 5 seconds and a cell about 5 m, as on the line (line-hypotheses.js).
 */
export const WAREHOUSE = Object.freeze({
  /**
   * Turns a robot takes to set a pallet into a truck (Sami, 26/10/2026: the value found, with some margin, until someone
   * who loads trucks says otherwise): 90 s, 18 turns. A patent counts 43 to 86 s a pallet with a forklift (10 to 20
   * minutes for 14), a carriers' forum 82 s. A pallet set on a bay, or left on a dock before its truck, takes a turn.
   */
  loadTurns: 18,
});
