import { paired } from "mcts-commun/measure.js";
import { runDay } from "./simulate.js";

/**
 * Who takes which order (simulate.js asks when a robot is idle): `(robot, open, { t, reach }) => order`, where
 * `reach(order)` is the floor distance to the order's nearest pickup cell, known blockages left out. The
 * search will have to beat these, by pairs, on the same days.
 */
export const RULES = Object.freeze({
  /** The order nearest the robot, the earlier in the list between equals. */
  nearest: (robot, open, { reach }) => open.reduce((best, order) => (reach(order) < reach(best) ? order : best)),
  /** The orders in the order they came. */
  list: (robot, open) => open[0],
  /** The farthest order first (the longest job first, LPT): the long trips start early and share out. */
  farthest: (robot, open, { reach }) => open.reduce((best, order) => (reach(order) > reach(best) ? order : best)),
});

export const RULE_LABELS = Object.freeze({ nearest: "la plus proche", list: "dans l'ordre de la liste", farthest: "la plus lointaine d'abord", search: "recherche (ISMCTS)" });

const mean = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;
const MEASURES = ["delivered", "finish", "meanDelivery", "moves", "waits", "replans", "stuck"];

/**
 * The rules on the same `days` days of `setup` (seeds `seed`, `seed + 1`, …): each rule's mean measures, the
 * share of days with a blockage, and its finishing turn against the list order's, by pairs (list minus rule:
 * above 0, the rule finishes earlier).
 */
export function compareRules(setup, { days = 100, seed = 1, rules = RULES } = {}) {
  const runs = Object.fromEntries(Object.keys(rules).map((name) => [name, []]));
  for (let i = 0; i < days; i += 1) for (const [name, rule] of Object.entries(rules)) runs[name].push(runDay(setup, seed + i, rule).measures);
  return summaryOf(runs);
}

/** Each rule's days (`{ name: measures[] }`, the same days for all) summed up as `compareRules` does. */
export function summaryOf(runs) {
  const baseline = runs.list?.map((one) => one.finish);
  return Object.fromEntries(
    Object.entries(runs).map(([name, measures]) => [
      name,
      {
        ...Object.fromEntries(MEASURES.map((key) => [key, mean(measures.map((one) => one[key]))])),
        blockedDays: mean(measures.map((one) => (one.blocked ? 1 : 0))),
        gain: baseline ? paired(baseline, measures.map((one) => one.finish)) : null,
      },
    ]),
  );
}
