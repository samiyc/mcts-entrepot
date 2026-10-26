import { paired } from "mcts-commun/measure.js";
import { runDay } from "./simulate.js";

/** @typedef {import("./types.js").Rule} Rule */
/** @typedef {import("./types.js").Summary} Summary */

/**
 * Who takes which order (simulate.js asks when a robot is idle): `(robot, open, { t, reach }) => order`, where
 * `reach(order)` is the floor distance to the order's nearest pickup cell, known blockages left out. The
 * search will have to beat these, by pairs, on the same days.
 */
export const RULES = /** @type {Readonly<Record<string, Rule>>} */ (Object.freeze({
  /** The order nearest the robot, the earlier in the list between equals. */
  nearest: (robot, open, { reach }) => open.reduce((best, order) => (reach(order) < reach(best) ? order : best)),
  /** The orders in the order they came. */
  list: (robot, open) => open[0],
  /** The farthest order first (the longest job first, LPT): the long trips start early and share out. */
  farthest: (robot, open, { reach }) => open.reduce((best, order) => (reach(order) > reach(best) ? order : best)),
  /** The orders of the truck due first, the nearest of them (the nearest overall when every truck is due together). */
  truck: (robot, open, { reach, state }) => {
    const due = (order) => state.trucks[order.truck].at;
    return open.reduce((best, order) => (due(order) < due(best) || (due(order) === due(best) && reach(order) < reach(best)) ? order : best));
  },
}));

export const RULE_LABELS = Object.freeze({ nearest: "la plus proche", list: "dans l'ordre de la liste", farthest: "la plus lointaine d'abord", truck: "le camion attendu d'abord", search: "recherche (ISMCTS)" });

const mean = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;
const meanOf = (measures, key) => mean(measures.map((one) => one[key]));
const MEASURES = ["delivered", "finish", "meanDelivery", "moves", "waits", "replans", "stuck", "truckWait", "early"];

/**
 * The rules on the same `days` days of `setup` (seeds `seed`, `seed + 1`, …): each rule's mean measures, the
 * share of days with a blockage, and the turns its trucks waited against the list order's, by pairs (list
 * minus rule: above 0, the trucks wait less; with one truck there from the start, the finishing turn).
 * @returns {Record<string, Summary>}
 */
export function compareRules(setup, { days = 100, seed = 1, rules = RULES } = {}) {
  return summaryOf(runsOf(setup, { days, seed, rules }));
}

/**
 * Each rule's measures on the same `days` days of `setup` (seeds `seed`, `seed + 1`, …), day by day: what
 * `compareRules` sums up, kept so that days measured apart can be put together (scripts/compare-merge.js).
 * @returns {Record<string, object[]>}
 */
export function runsOf(setup, { days = 100, seed = 1, rules = RULES } = {}) {
  const runs = Object.fromEntries(Object.keys(rules).map((name) => [name, []]));
  for (let i = 0; i < days; i += 1) for (const [name, rule] of Object.entries(rules)) runs[name].push(runDay(setup, seed + i, rule).measures);
  return runs;
}

/**
 * Each rule's days (`{ name: measures[] }`, the same days for all) summed up as `compareRules` does.
 * @returns {Record<string, Summary>}
 */
export function summaryOf(runs) {
  const baseline = runs.list?.map((one) => one.truckWait);
  const summed = (measures) => /** @type {Summary} */ ({
    ...Object.fromEntries(MEASURES.map((key) => [key, meanOf(measures, key)])),
    blockedDays: mean(measures.map((one) => (one.blocked ? 1 : 0))),
    gain: baseline ? paired(baseline, measures.map((one) => one.truckWait)) : null,
  });
  return Object.fromEntries(Object.entries(runs).map(([name, measures]) => [name, summed(measures)]));
}
