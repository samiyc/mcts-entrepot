import { paired } from "mcts-commun/measure.js";
import { LINE_PLANS } from "../src/line-plan.js";
import { LINE_RULES, LINE_RULE_LABELS, lineRuns } from "../src/line-rules.js";
import { lineSearchRule } from "../src/line-search.js";
import { fixed, interval, meanOf } from "./format.js";
import { mergeEnd, mergedOf, pieceOptions, runsOfLines, unitsOf } from "./units.js";

/**
 * `node scripts/line-rollout.js --plan tournee [--days 100] [--from 1] [--short 30] [--out FILE]` (Sami, 26/10/2026):
 * the search played beyond its tree by the nearest first (the default) or by the shortest cover, against the rules,
 * on the same hours; and the same comparison on the first `short` hours only, to see whether a short measure says
 * what the long one says (the short one is the long one's first hours: one run gives both). `--out` writes each hour
 * as a JSON line, `--merge FILE…` makes the report of the pieces (scripts/units.js).
 */
const args = process.argv.slice(2);
const option = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const { from, days, out, merging } = pieceOptions(args);
const short = Number(option("--short", 30));
const SEARCHES = { "recherche (jouée par la plus proche)": "nearest", "recherche (jouée par la couverture)": "cover" };

/** The rules and both searches over the first `count` hours: the stops, each search against the best rule, and the two searches against each other. */
function report(runs, count) {
  const stops = (name) => runs[name].slice(0, count).map((one) => one.stopped);
  const rules = Object.keys(LINE_RULES);
  const mean = (name) => meanOf(runs[name].slice(0, count), "stopped");
  const best = rules.reduce((one, other) => (mean(other) < mean(one) ? other : one));
  const means = rules.map((name) => LINE_RULE_LABELS[name] + " " + fixed(mean(name))).join(" · ");
  console.log(`\n${count} heures : ${means}`);
  for (const name of Object.keys(SEARCHES)) {
    const gain = paired(stops(best), stops(name));
    console.log(`${name.padEnd(38)} ${fixed(mean(name)).padStart(6)} tours d'arrêt, sur la meilleure règle (${LINE_RULE_LABELS[best]}) ${interval(gain)}`);
  }
  const [nearest, cover] = Object.keys(SEARCHES);
  console.log(`la couverture sur la plus proche, comme règle de jeu : ${interval(paired(stops(nearest), stops(cover)))} tours d'arrêt en moins`);
}

/** The hours of `id` one by one. */
function measure(id) {
  const setup = LINE_PLANS[id];
  if (!setup) throw new Error(`ligne inconnue ; au choix : ${Object.keys(LINE_PLANS).join(", ")}`);
  const rules = { ...LINE_RULES, ...Object.fromEntries(Object.entries(SEARCHES).map(([name, rollout]) => [name, lineSearchRule({ rollout })])) };
  const unit = unitsOf({ scope: "line-rollout", of: days, unit: "heure", out });
  const started = Date.now();
  const runs = Object.fromEntries(Object.keys(rules).map((name) => [name, []]));
  for (let seed = from; seed < from + days; seed += 1) {
    const hour = lineRuns(setup, { days: 1, seed, rules });
    for (const name of Object.keys(rules)) runs[name].push(...hour[name]);
    unit({ plan: id, from, of: days, seed, runs: Object.fromEntries(Object.entries(hour).map(([name, [one]]) => [name, one])) });
  }
  console.log(`${setup.label} : ${days} heures de ligne, ${((Date.now() - started) / 1000).toFixed(0)} s`);
  return runs;
}

const merged = merging && mergedOf(merging, undefined, { from, days });
const runs = merged ? runsOfLines(merged.lines) : measure(option("--plan", "tournee"));
if (merged) console.log(`${LINE_PLANS[merged.lines[0].plan].label} : ${merged.lines.length} heures de ligne`);
report(runs, Math.min(short, runs[Object.keys(runs)[0]].length));
report(runs, runs[Object.keys(runs)[0]].length);
if (merged) mergeEnd(merged, "heures");
