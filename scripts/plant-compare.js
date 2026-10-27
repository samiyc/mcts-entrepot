import { paired } from "mcts-commun/measure.js";
import { LINE_RULES } from "../src/line-rules.js";
import { PLANT_PLANS, WAREHOUSE_RULES, WAREHOUSE_RULE_LABELS, runPlant } from "../src/plant.js";
import { plantSearchRule } from "../src/plant-search.js";
import { fixed, interval, meanOf } from "./format.js";
import { searchesLines, takeAll, variantLines, variantsOf, watchersOf } from "./searches.js";
import { mergeEnd, mergedOf, pieceOptions, runsOfLines, unitsOf } from "./units.js";

/**
 * `npm run plant -- [--plan usine] [--days 100] [--from 1] [--robots 1,2,4] [--search] [--budget 64] [--diagnose]
 * [--early] [--variant key=value,…]… [--out FILE]` (Sami, 26/10/2026): the plant, the line under the kanban, the warehouse under each of its rules
 * (and the search with `--search`) on the same hours; the line's stop gained on the warehouse's list order by pairs,
 * the mean lead from the supermarket's order to its stock full again. `--diagnose` counts what each search saw
 * (scripts/searches.js); `--early` adds the search with `earlyStop`, each `--variant` the search with those
 * settings (`budget=128`), paired on the search. `--out` writes each hour as a JSON line,
 * `--merge FILE…` makes the tables of the pieces (scripts/units.js).
 */
const args = process.argv.slice(2);
const option = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const { from, days, out, merging } = pieceOptions(args);
const RULE_NAMES = ["list", "nearest", "farthest", "urgent", "lineCover"];
const LABELS = { ...WAREHOUSE_RULE_LABELS, search: "recherche (ISMCTS)" };
const searching = args.includes("--search");
const variants = searching ? variantsOf(args) : [];
const watchers = watchersOf(searching && (variants.length || args.includes("--diagnose")) ? ["search", ...variants.map((one) => one.name)] : []);
for (const one of variants) LABELS[one.name] = one.label;

/** The rules' measures over the hours (`records`) of one robot count, against the list order; what the searches saw. */
function report(setup, robots, records, took) {
  const runs = runsOfLines(records);
  console.log(`\n${setup.label}, ${robots} robot(s) à l'entrepôt, ${runs.list.length} heures${took}`);
  const list = runs.list.map((one) => one.stopped);
  for (const [name, measures] of Object.entries(runs)) {
    const gain = name === "list" ? "—" : interval(paired(list, measures.map((one) => one.stopped)));
    console.log(`${LABELS[name].padEnd(30)} arrêt de la ligne ${fixed(meanOf(measures, "stopped")).padStart(6)}  gagné sur l'ordre ${gain.padStart(22)}  délai ${fixed(meanOf(measures, "supplyLead"), 0)} tours`);
  }
  for (const line of [...variantLines(runs, variants, "stopped"), ...searchesLines(records, LABELS)]) console.log(line);
}

/** The warehouse's rules, and the searches asked. */
function rulesOf() {
  const budget = Number(option("--budget", 64));
  const searchOf = (options, name) => plantSearchRule({ budget, ...options, onSearch: watchers[name]?.onSearch });
  const searches = searching ? { search: searchOf({}, "search"), ...Object.fromEntries(variants.map((one) => [one.name, searchOf(one.options, one.name)])) } : {};
  return { ...Object.fromEntries(RULE_NAMES.map((name) => [name, WAREHOUSE_RULES[name]])), ...searches };
}

/** The hours of each robot count, one by one. */
function measure(id) {
  const setup = PLANT_PLANS[id];
  const robotCounts = option("--robots", "1,2,4").split(",").map(Number);
  const rules = rulesOf();
  const unit = unitsOf({ scope: "plant", of: robotCounts.length * days, unit: "heure", out });
  for (const robots of robotCounts) {
    const records = [];
    const started = Date.now();
    for (let seed = from; seed < from + days; seed += 1) {
      const hour = Object.fromEntries(Object.entries(rules).map(([name, rule]) => [name, runPlant({ ...setup, warehouse: { ...setup.warehouse, robots } }, seed, LINE_RULES.kanban, rule).measures]));
      const record = { plan: id, robots, from, of: days, seed, runs: hour, ...(Object.keys(watchers).length ? { searches: takeAll(watchers) } : {}) };
      records.push(record);
      unit(record);
    }
    report(setup, robots, records, ` (${fixed((Date.now() - started) / 1000, 0)} s)`);
  }
}

if (merging) {
  const merged = mergedOf(merging, (line) => line.robots, { from, days });
  for (const robots of [...new Set(merged.lines.map((line) => line.robots))]) {
    report(PLANT_PLANS[merged.lines[0].plan], robots, merged.lines.filter((line) => line.robots === robots), "");
  }
  mergeEnd(merged, "heures");
} else {
  measure(option("--plan", "usine"));
}
