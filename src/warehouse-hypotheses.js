/**
 * The warehouse's figures that come from the research (docs/recherche/hypotheses.md), here and nowhere else. A turn is
 * 5 seconds and a cell about 5 m, as on the line (line-hypotheses.js).
 */
export const WAREHOUSE = Object.freeze({
  /**
   * Turns a pallet takes to go into a truck (Sami, 26/10/2026: the value found, with some margin, until someone who
   * loads trucks says otherwise): 90 s, 18 turns. A patent counts 43 to 86 s a pallet with a forklift (10 to 20
   * minutes for 14), a carriers' forum 82 s, a forklift and its driver about 70 pallets an hour. It is a driver's
   * time, driving into the trailer (lifting takes seconds): since the night of 26/10 a dock loader's (day-loaders.js);
   * with no loader (`dockLoaders: 0`), the robot's own, as before. Q5, Q22 in docs/recherche/hypotheses.md.
   */
  loadTurns: 18,
  /**
   * The dock loaders (Sami, 26/10/2026, the night: a person loads the trucks, one after the other; two or three in a
   * big warehouse, only when as many trucks load together): the robots set their pallets on the dock's bay, or at its
   * door, in a turn like any other pallet (an electric pallet truck lifts 31 to 56 mm/s, 2 to 4 s for 10 cm, Q5), and
   * the loaders take them into the trucks. 0: the robots load the trucks themselves.
   */
  dockLoaders: 1,
  /**
   * HYPOTHESIS: how long a specialist takes to assemble a kit (Sami, 26/10/2026: a few small parts put into a bigger
   * parcel, or a long work such as wiring), in turns: a wiring 5 to 15 minutes, a packing 1 to 3 minutes. No figure
   * was found online; a study of wire harness boards says the times follow a normal law, the model draws them evenly.
   */
  works: Object.freeze({ wiring: Object.freeze([60, 180]), packing: Object.freeze([12, 36]) }),
});
