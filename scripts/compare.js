import { PLANS } from "../src/plans.js";
import { RULES, runsOf, summaryOf } from "../src/rules.js";
import { searchRule } from "../src/search.js";
import { printComparison } from "./compare-table.js";
import { searchesLines, takeAll, watchersOf } from "./searches.js";
import { mergeEnd, mergedOf, pieceOptions, runsOfLines, unitsOf } from "./units.js";

/**
 * `npm run compare -- [--plan petit|sami|couloirs] [--days 100] [--from 1] [--search [budget]] [--loaders N] [--diagnose] [--out FILE]`:
 * the
 * assignment rules on the same drawn days of a warehouse, a line each; every plan when none is named. `--search`
 * adds the search (src/search.js: 6 s to 5 min a day with the dock loader, 27/10/2026). `--from` is the first day's
 * seed; `--out` writes each day measured as a JSON line (scripts/units.js), and `--merge FILE…` makes one table of
 * the pieces of a long measure, cut in jobs of half an hour (Sami, 26/10/2026; night.json). `--loaders` the dock
 * loaders (day-loaders.js; 0, the robots load the trucks themselves). `--diagnose` counts what each search saw
 * (scripts/searches.js).
 */
const args = process.argv.slice(2);
const option = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const { from, days, out, merging } = pieceOptions(args);
const loaders = args.includes("--loaders") ? { dockLoaders: Number(option("--loaders")) } : {};
const named = args.includes("--plan") ? [option("--plan")] : Object.keys(PLANS);
const searching = args.includes("--search");
const budget = searching && /^\d+$/.test(option("--search") ?? "") ? Number(option("--search")) : undefined;
const watchers = watchersOf(searching && args.includes("--diagnose") ? ["search"] : []);
const rules = searching ? { ...RULES, search: searchRule({ ...(budget ? { budget } : {}), onSearch: watchers.search?.onSearch }) } : RULES;
const LABELS = { search: "recherche (ISMCTS)" };

/** The days of `id` one by one, each handed to `unit`; their records. */
function measured(id, setup, unit) {
  const records = [];
  for (let i = 0; i < days; i += 1) {
    const day = runsOf(setup, { days: 1, seed: from + i, rules });
    const record = { plan: id, from, of: days, seed: from + i, runs: Object.fromEntries(Object.entries(day).map(([name, [one]]) => [name, one])) };
    if (watchers.search) record.searches = takeAll(watchers);
    records.push(record);
    unit(record);
  }
  return records;
}

if (merging) {
  const merged = mergedOf(merging, undefined, { from, days });
  const plans = new Set(merged.lines.map((line) => line.plan));
  if (plans.size > 1) throw new Error(`des morceaux de plans différents : ${[...plans].join(", ")}`);
  printComparison(PLANS[merged.lines[0].plan], merged.lines.length, summaryOf(runsOfLines(merged.lines)));
  for (const line of searchesLines(merged.lines, LABELS)) console.log(line);
  mergeEnd(merged);
} else {
  if (out && named.length > 1) throw new Error("--out : un seul plan (--plan)");
  const unit = unitsOf({ scope: "compare", of: named.length * days, unit: "journée", out });
  for (const id of named) {
    const setup = PLANS[id] && { ...PLANS[id], ...loaders };
    if (!setup) throw new Error(`plan inconnu ; au choix : ${Object.keys(PLANS).join(", ")}`);
    const records = measured(id, setup, unit);
    printComparison(setup, days, summaryOf(runsOfLines(records)));
    for (const line of searchesLines(records, LABELS)) console.log(line);
  }
}
