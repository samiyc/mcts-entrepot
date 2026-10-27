import { PLANS } from "../src/plans.js";
import { RULES, RULE_LABELS, runsOf, summaryOf } from "../src/rules.js";
import { searchRule } from "../src/search.js";
import { printComparison } from "./compare-table.js";
import { searchesLines, takeAll, variantLines, variantsOf, watchersOf } from "./searches.js";
import { mergeEnd, mergedOf, pieceOptions, runsOfLines, unitsOf } from "./units.js";

/**
 * `npm run compare -- [--plan petit|sami|couloirs] [--days 100] [--from 1] [--search [budget]] [--loaders N] [--diagnose] [--variant key=value,…]…
 * [--out FILE]`: the
 * assignment rules on the same drawn days of a warehouse, a line each; every plan when none is named. `--search`
 * adds the search (src/search.js: 6 s to 5 min a day with the dock loader, 27/10/2026). `--from` is the first day's
 * seed; `--out` writes each day measured as a JSON line (scripts/units.js), and `--merge FILE…` makes one table of
 * the pieces of a long measure, cut in jobs of half an hour (Sami, 26/10/2026; night.json). `--loaders` the dock
 * loaders (day-loaders.js; 0, the robots load the trucks themselves). `--diagnose` counts what each search saw
 * (scripts/searches.js); each `--variant` adds the search with those settings (`earlyStop=1,budget=128`), paired on
 * the search's truck waits and on the variant before.
 */
const args = process.argv.slice(2);
const option = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const { from, days, out, merging } = pieceOptions(args);
const loaders = args.includes("--loaders") ? { dockLoaders: Number(option("--loaders")) } : {};
const named = args.includes("--plan") ? [option("--plan")] : Object.keys(PLANS);
const searching = args.includes("--search");
const budget = searching && /^\d+$/.test(option("--search") ?? "") ? Number(option("--search")) : undefined;
const variants = searching ? variantsOf(args) : [];
const watchers = watchersOf(searching && (variants.length || args.includes("--diagnose")) ? ["search", ...variants.map((one) => one.name)] : []);
const searchOf = (options, name) => searchRule({ ...(budget ? { budget } : {}), ...options, onSearch: watchers[name]?.onSearch });
const searches = { search: searchOf({}, "search"), ...Object.fromEntries(variants.map((one) => [one.name, searchOf(one.options, one.name)])) };
const rules = searching ? { ...RULES, ...searches } : RULES;
const LABELS = { ...RULE_LABELS, ...Object.fromEntries(variants.map((one) => [one.name, one.label])) };

/** The table of the days (`records`), each variant against the search, and what the searches saw. */
function report(setup, records) {
  const runs = runsOfLines(records);
  printComparison(setup, records.length, summaryOf(runs), LABELS);
  for (const line of [...variantLines(runs, variants, "truckWait"), ...searchesLines(records, LABELS)]) console.log(line);
}

/** The days of `id` one by one, each handed to `unit`; their records. */
function measured(id, setup, unit) {
  const records = [];
  for (let i = 0; i < days; i += 1) {
    const day = runsOf(setup, { days: 1, seed: from + i, rules });
    const record = { plan: id, from, of: days, seed: from + i, runs: Object.fromEntries(Object.entries(day).map(([name, [one]]) => [name, one])) };
    if (Object.keys(watchers).length) record.searches = takeAll(watchers);
    records.push(record);
    unit(record);
  }
  return records;
}

if (merging) {
  const merged = mergedOf(merging, undefined, { from, days });
  const plans = new Set(merged.lines.map((line) => line.plan));
  if (plans.size > 1) throw new Error(`des morceaux de plans différents : ${[...plans].join(", ")}`);
  report(PLANS[merged.lines[0].plan], merged.lines);
  mergeEnd(merged);
} else {
  if (out && named.length > 1) throw new Error("--out : un seul plan (--plan)");
  const unit = unitsOf({ scope: "compare", of: named.length * days, unit: "journée", out });
  for (const id of named) {
    const setup = PLANS[id] && { ...PLANS[id], ...loaders };
    if (!setup) throw new Error(`plan inconnu ; au choix : ${Object.keys(PLANS).join(", ")}`);
    report(setup, measured(id, setup, unit));
  }
}
