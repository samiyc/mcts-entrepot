import fs from "node:fs";
import path from "node:path";
import { PLANS } from "../src/plans.js";
import { RULES, compareRules, runsOf, summaryOf } from "../src/rules.js";
import { searchRule } from "../src/search.js";
import { printComparison } from "./compare-table.js";

/**
 * `npm run compare -- [--plan petit|sami|couloirs] [--days 100] [--from 1] [--search [budget]] [--out FILE]`: the
 * assignment rules on the same drawn days of a warehouse, a line each; every plan when none is named. `--search`
 * adds the search (src/search.js: ~1 to 3 s a day with loads of a turn, 10 minutes and more on Sami's plan with
 * loads of 90 s). `--from` is the first day's seed; `--out` (one plan) writes the days measured, again after each
 * one, for scripts/compare-merge.js to put the pieces of a long measure together (Sami, 26/10/2026).
 */
const args = process.argv.slice(2);
const option = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const days = Number(option("--days", 100));
const from = Number(option("--from", 1));
const out = option("--out", null);
const named = args.includes("--plan") ? [option("--plan")] : Object.keys(PLANS);
const searching = args.includes("--search");
const budget = searching && /^\d+$/.test(option("--search") ?? "") ? Number(option("--search")) : undefined;
const rules = searching ? { ...RULES, search: searchRule(budget ? { budget } : {}) } : RULES;

/** The days one by one, the file written again after each. */
function measured(id, setup) {
  const runs = Object.fromEntries(Object.keys(rules).map((name) => [name, []]));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  for (let i = 0; i < days; i += 1) {
    const day = runsOf(setup, { days: 1, seed: from + i, rules });
    for (const name of Object.keys(rules)) runs[name].push(...day[name]);
    fs.writeFileSync(out, JSON.stringify({ plan: id, from, days: i + 1, of: days, runs }));
  }
  return summaryOf(runs);
}

if (out && named.length > 1) throw new Error("--out : un seul plan (--plan)");
for (const id of named) {
  const setup = PLANS[id];
  if (!setup) throw new Error(`plan inconnu ; au choix : ${Object.keys(PLANS).join(", ")}`);
  printComparison(setup, days, out ? measured(id, setup) : compareRules(setup, { days, seed: from, rules }));
}
