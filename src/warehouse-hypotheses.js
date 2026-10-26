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
  /**
   * HYPOTHESIS: how long a specialist takes to assemble a kit (Sami, 26/10/2026: a few small parts put into a bigger
   * parcel, or a long work such as wiring), in turns: a wiring 5 to 15 minutes, a packing 1 to 3 minutes. No figure
   * was found online; a study of wire harness boards says the times follow a normal law, the model draws them evenly.
   */
  works: Object.freeze({ wiring: Object.freeze([60, 180]), packing: Object.freeze([12, 36]) }),
});
