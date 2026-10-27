import { paired } from "mcts-commun/measure.js";
import { LINE_PLANS } from "../src/line-plan.js";
import { LINE_RULES, LINE_RULE_LABELS, lineRuns, summaryOfLine } from "../src/line-rules.js";
import { lineSearchRule } from "../src/line-search.js";
import { fixed, interval } from "./format.js";
import { searchesLines, takeAll, watchersOf } from "./searches.js";
import { mergeEnd, mergedOf, pieceOptions, runsOfLines, unitsOf } from "./units.js";

/**
 * `npm run line -- [--plan petite|sami|seul|etroite] [--days 100] [--from 1] [--search [budget]] [--diagnose] [--early]
 * [--out FILE]`: the rules of the assembly line on the same drawn days, a line each, every plan when none is named;
 * `--search` adds the search (a few seconds a day). The turns the line stood still, gained on the kanban by pairs, and
 * the search against the best rule. `--diagnose` counts what each search saw (scripts/searches.js); `--early` adds the
 * search with `earlyStop`, paired on the search. `--out` (one plan) writes each hour as a JSON line, `--merge FILE…`
 * makes the table of the pieces (scripts/units.js).
 */
const args = process.argv.slice(2);
const { from, days, out, merging } = pieceOptions(args);
const named = args.includes("--plan") ? [args[args.indexOf("--plan") + 1]] : Object.keys(LINE_PLANS);
const searching = args.includes("--search");
const early = searching && args.includes("--early");
const budget = searching && /^\d+$/.test(args[args.indexOf("--search") + 1] ?? "") ? Number(args[args.indexOf("--search") + 1]) : undefined;
const watchers = watchersOf(searching && (early || args.includes("--diagnose")) ? ["search", ...(early ? ["early"] : [])] : []);
const searches = {
  search: lineSearchRule({ ...(budget ? { budget } : {}), onSearch: watchers.search?.onSearch }),
  ...(early ? { early: lineSearchRule({ ...(budget ? { budget } : {}), earlyStop: true, onSearch: watchers.early.onSearch }) } : {}),
};
const rules = searching ? { ...LINE_RULES, ...searches } : LINE_RULES;
const LABELS = { ...LINE_RULE_LABELS, early: "recherche, arrêt anticipé" };

/** `name`'s hours against `against`'s: the turns of stop it saves, and the hours it wins and loses. */
function pairedLine(runs, against, name) {
  const gain = paired(runs[against].map((one) => one.stopped), runs[name].map((one) => one.stopped));
  const wins = runs[name].filter((one, i) => one.stopped < runs[against][i].stopped).length;
  const losses = runs[name].filter((one, i) => one.stopped > runs[against][i].stopped).length;
  return `${interval(gain)} tours d'arrêt en moins, ${wins} heures gagnées, ${losses} perdues`;
}

/** The search against the rule that stops the line least, on the same days; the early stop against the search. */
function searchLines(runs, summary) {
  const best = Object.keys(LINE_RULES).reduce((one, other) => (summary[other].stopped < summary[one].stopped ? other : one));
  const lines = [`recherche sur la meilleure règle (${LINE_RULE_LABELS[best]}) : ${pairedLine(runs, best, "search")}`];
  if (runs.early) lines.push(`arrêt anticipé sur la recherche : ${pairedLine(runs, "search", "early")}`);
  return lines;
}

/** The table of a line's hours, and what its searches saw (`records`, the hours' own). */
function report(setup, runs, took, records) {
  const summary = summaryOfLine(runs);
  console.log(`\n${setup.label} : ${runs.kanban.length} heures de ligne${took}`);
  console.log("Règle                          | arrêt (tours) | arrêt (s) | véhicules | plus long arrêt | gagné sur le kanban (IC 95 %) | bacs au plus");
  for (const [name, row] of Object.entries(summary)) {
    const gain = name === "kanban" ? "—" : interval(row.gain);
    console.log([LABELS[name].padEnd(30), fixed(row.stopped).padStart(13), fixed(row.stoppedSeconds, 0).padStart(9), fixed(row.produced).padStart(9), fixed(row.longestStop).padStart(15), gain.padStart(29), fixed(row.maxWip).padStart(12)].join(" | "));
  }
  if (runs.search) for (const line of [...searchLines(runs, summary), ...searchesLines(records, LABELS)]) console.log(line);
}

/** The hours of `id` one by one, each handed to `unit`; their records. */
function measured(id, setup, unit) {
  const records = [];
  for (let seed = from; seed < from + days; seed += 1) {
    const hour = lineRuns(setup, { days: 1, seed, rules });
    const record = { plan: id, from, of: days, seed, runs: Object.fromEntries(Object.entries(hour).map(([name, [one]]) => [name, one])) };
    if (Object.keys(watchers).length) record.searches = takeAll(watchers);
    records.push(record);
    unit(record);
  }
  return records;
}

if (merging) {
  const merged = mergedOf(merging, undefined, { from, days });
  report(LINE_PLANS[merged.lines[0].plan], runsOfLines(merged.lines), "", merged.lines);
  mergeEnd(merged, "heures");
} else {
  if (out && named.length > 1) throw new Error("--out : une seule ligne (--plan)");
  const unit = unitsOf({ scope: "line", of: named.length * days, unit: "heure", out });
  for (const id of named) {
    const setup = LINE_PLANS[id];
    if (!setup) throw new Error(`ligne inconnue ; au choix : ${Object.keys(LINE_PLANS).join(", ")}`);
    const started = Date.now();
    const records = measured(id, setup, unit);
    report(setup, runsOfLines(records), `, ${((Date.now() - started) / 1000).toFixed(0)} s`, records);
  }
}
