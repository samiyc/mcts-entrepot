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
  /** HYPOTHESIS: a supplier shortage, a reference missing at the supermarket, once an hour on average. */
  shortagesPerHour: 1,
  /** HYPOTHESIS: a shortage lasts 5 to 15 minutes (60 to 180 turns). */
  shortageTurns: Object.freeze([60, 180]),
  /** A vendor's figure (Oxmaint, no study cited): a stopped car line costs $10,000 to $50,000 a minute. */
  stopCostPerMinute: Object.freeze([10_000, 50_000]),
});
