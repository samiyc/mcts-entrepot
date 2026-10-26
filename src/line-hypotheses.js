/**
 * The figures of the line (Sami, 26/10/2026: real data first). The sourced ones and their sources are in
 * docs/recherche/ligne-cadencee.md; the others are written as hypotheses, here and nowhere else, and the page can change
 * them. A turn is 5 seconds; a cell about 5 m (a robot at 1 m/s, under the 1.35 m/s of an Omron LD-90).
 */
export const LINE = Object.freeze({
  /** Seconds a turn. */
  turnSeconds: 5,
  /** Toyota Georgetown: a vehicle every 55 s (Assembly Magazine, 2006), 11 turns. */
  takt: 11,
  /** An hour of the line: 720 turns, about 65 vehicles. */
  horizon: 720,
  /** Pieces a bin (All About Lean's worked milk run: 12 a box, a box lasts 10 minutes at a piece every 50 s). */
  binPieces: 12,
  /** Bins of each reference on the line side (two-bin kanban): one in use, one full behind it. */
  bins: 2,
  /**
   * HYPOTHESIS: the bins a robot carries on a round (step 2): 4 KLT of some 15 kg, under the 90 kg an Omron LD-90 takes.
   * The weight of a full bin is not sourced.
   */
  tourBins: 4,
  /**
   * HYPOTHESIS: the mix of models (step 2): 60 % petrol, 40 % hybrid; the petrol car skips the hybrid's parts (I, J on
   * Sami's line), the hybrid the petrol's (E, F). No mix is sourced.
   */
  mix: Object.freeze([Object.freeze({ name: "essence", share: 0.6, skip: "IJ" }), Object.freeze({ name: "hybride", share: 0.4, skip: "EF" })]),
  /** HYPOTHESIS: the robots know the next 20 vehicles of the sequence (about 18 minutes), not the ones after. */
  frozen: 20,
  /**
   * HYPOTHESIS: the supermarket fed from the warehouse (step 2): 3 full bins a reference (some 33 minutes of the line),
   * an order to the warehouse when one is left, back 10 to 40 minutes later (120 to 480 turns: picked, carried across).
   * With 4 bins and 5 to 20 minutes the line never stopped; this is the tight case.
   */
  supermarket: Object.freeze({ bins: 3, reorder: 1, lead: Object.freeze([120, 480]) }),
  /**
   * HYPOTHESIS: the warehouse as a queue (step 2): 3 pickers, 2 to 6 minutes to prepare an order (24 to 72 turns), 5
   * minutes to bring it across (60 turns); the supermarket orders by the cover, just in time.
   */
  pickedSupermarket: Object.freeze({ bins: 3, reorder: 1, policy: "cover", lead: Object.freeze([24, 72]), warehouse: Object.freeze({ pickers: 3, transport: 60 }) }),
  /** HYPOTHESIS: the shuttle from the warehouse to the supermarket, in the plant (plant.js): 5 minutes, 60 turns. */
  shuttle: 60,
  /** HYPOTHESIS: a supplier shortage, a reference missing at the supermarket, once an hour on average. */
  shortagesPerHour: 1,
  /** HYPOTHESIS: a shortage lasts 5 to 15 minutes (60 to 180 turns). */
  shortageTurns: Object.freeze([60, 180]),
  /** A vendor's figure (Oxmaint, no study cited): a stopped car line costs $10,000 to $50,000 a minute. */
  stopCostPerMinute: Object.freeze([10_000, 50_000]),
});
