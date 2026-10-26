import { paired } from "mcts-commun/measure.js";
import { usageOf } from "./line-models.js";
import { runLine } from "./line.js";

/**
 * Who brings which bin (line.js asks when a robot is idle): `(robot, open, { t, reach, state }) => request`, as in
 * rules.js. The search will have to beat these, by pairs, on the same days.
 */

/**
 * The vehicles a lane has left before the line stops for it: its pieces (the bin in use and the full ones behind) over
 * the share of the vehicles known to come that take its reference (1 without a mix of models: the pieces).
 */
export const coverOf = (state, request) => {
  const lane = state.lanes[request.lane];
  return (lane.pieces + lane.full * state.setup.binPieces) / usageOf(state, lane.ref);
};

export const LINE_RULES = Object.freeze({
  /** The kanban in its order: the bins in the order they were emptied. */
  kanban: (robot, open) => open[0],
  /** The shortest cover first: the lane nearest to stopping the line (the logisticians' earliest due date); the nearest between equals. */
  cover: (robot, open, { reach, state }) => open.reduce((best, order) => (coverOf(state, order) < coverOf(state, best) || (coverOf(state, order) === coverOf(state, best) && reach(order) < reach(best)) ? order : best)),
  /** The nearest block first. */
  nearest: (robot, open, { reach }) => open.reduce((best, order) => (reach(order) < reach(best) ? order : best)),
});

export const LINE_RULE_LABELS = Object.freeze({ kanban: "le kanban dans l'ordre", cover: "la couverture la plus courte", nearest: "la plus proche", search: "recherche (ISMCTS)" });

const mean = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;
const MEASURES = ["stopped", "stoppedSeconds", "produced", "longestStop", "maxWip", "meanResponse", "moves", "waits", "replans", "stuck", "shortages"];

/**
 * Each rule's days (`{ name: measures[] }`, the same days for all) summed up: the mean measures, and the turns the
 * line stood still against the kanban's, by pairs (kanban minus rule: above 0, the line stops less).
 * @returns {Record<string, import("./types.js").LineSummary>}
 */
export function summaryOfLine(runs) {
  const baseline = runs.kanban?.map((one) => one.stopped);
  const summed = (measures) => /** @type {import("./types.js").LineSummary} */ ({
    ...Object.fromEntries(MEASURES.map((key) => [key, mean(measures.map((one) => one[key]))])),
    gain: baseline ? paired(baseline, measures.map((one) => one.stopped)) : null,
  });
  return Object.fromEntries(Object.entries(runs).map(([name, measures]) => [name, summed(measures)]));
}

/** Each rule's measures on `days` days of `setup` from `seed`. */
export function lineRuns(setup, { days = 100, seed = 1, rules = LINE_RULES } = {}) {
  const runs = Object.fromEntries(Object.keys(rules).map((name) => [name, []]));
  for (let i = 0; i < days; i += 1) for (const [name, rule] of Object.entries(rules)) runs[name].push(runLine(setup, seed + i, rule).measures);
  return runs;
}

/** The rules on the same days, summed up. */
export const compareLineRules = (setup, options) => summaryOfLine(lineRuns(setup, options));
