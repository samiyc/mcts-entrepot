import { paired } from "mcts-commun/measure.js";
import { LINE_PLANS } from "../src/line-plan.js";
import { LINE_RULES, LINE_RULE_LABELS, lineRuns, summaryOfLine } from "../src/line-rules.js";
import { lineSearchRule } from "../src/line-search.js";
import { fixed, interval } from "./format.js";

/**
 * `npm run line -- [--plan petite|sami|seul|etroite] [--days 100] [--search [budget]]`: the rules of the assembly line
 * on the same drawn days, a line each, every plan when none is named; `--search` adds the search (a few seconds a
 * day). The turns the line stood still, gained on the kanban by pairs, and the search against the best rule.
 */
const args = process.argv.slice(2);
const days = args.includes("--days") ? Number(args[args.indexOf("--days") + 1]) : 100;
const named = args.includes("--plan") ? [args[args.indexOf("--plan") + 1]] : Object.keys(LINE_PLANS);
const searching = args.includes("--search");
const budget = searching && /^\d+$/.test(args[args.indexOf("--search") + 1] ?? "") ? Number(args[args.indexOf("--search") + 1]) : undefined;
const rules = searching ? { ...LINE_RULES, search: lineSearchRule(budget ? { budget } : {}) } : LINE_RULES;

/** The search against the rule that stops the line least, on the same days. */
function searchAgainstBest(runs, summary) {
  const best = Object.keys(LINE_RULES).reduce((one, other) => (summary[other].stopped < summary[one].stopped ? other : one));
  const gain = paired(runs[best].map((one) => one.stopped), runs.search.map((one) => one.stopped));
  const wins = runs.search.filter((one, i) => one.stopped < runs[best][i].stopped).length;
  const losses = runs.search.filter((one, i) => one.stopped > runs[best][i].stopped).length;
  return `recherche sur la meilleure règle (${LINE_RULE_LABELS[best]}) : ${interval(gain)} tours d'arrêt en moins, ${wins} journées gagnées, ${losses} perdues`;
}

for (const id of named) {
  const setup = LINE_PLANS[id];
  if (!setup) throw new Error(`ligne inconnue ; au choix : ${Object.keys(LINE_PLANS).join(", ")}`);
  const started = Date.now();
  const runs = lineRuns(setup, { days, rules });
  const summary = summaryOfLine(runs);
  console.log(`\n${setup.label} : ${days} journées d'une heure, ${((Date.now() - started) / 1000).toFixed(0)} s`);
  console.log("Règle                          | arrêt (tours) | arrêt (s) | véhicules | plus long arrêt | gagné sur le kanban (IC 95 %) | bacs au plus");
  for (const [name, row] of Object.entries(summary)) {
    const gain = name === "kanban" ? "—" : interval(row.gain);
    console.log([LINE_RULE_LABELS[name].padEnd(30), fixed(row.stopped).padStart(13), fixed(row.stoppedSeconds, 0).padStart(9), fixed(row.produced).padStart(9), fixed(row.longestStop).padStart(15), gain.padStart(29), fixed(row.maxWip).padStart(12)].join(" | "));
  }
  if (searching) console.log(searchAgainstBest(runs, summary));
}
