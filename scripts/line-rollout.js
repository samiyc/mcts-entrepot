import { paired } from "mcts-commun/measure.js";
import { LINE_PLANS } from "../src/line-plan.js";
import { LINE_RULES, LINE_RULE_LABELS, lineRuns } from "../src/line-rules.js";
import { lineSearchRule } from "../src/line-search.js";
import { fixed, interval, meanOf } from "./format.js";

/**
 * `node scripts/line-rollout.js --plan tournee [--days 100] [--short 30]` (Sami, 26/10/2026): the search played beyond
 * its tree by the nearest first (the default) or by the shortest cover, against the rules, on the same hours; and the
 * same comparison on the first `short` hours only, to see whether a short measure says what the long one says (the
 * short one is the long one's first hours: one run gives both).
 */
const args = process.argv.slice(2);
const option = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const id = option("--plan", "tournee");
const days = Number(option("--days", 100));
const short = Number(option("--short", 30));
const setup = LINE_PLANS[id];
if (!setup) throw new Error(`ligne inconnue ; au choix : ${Object.keys(LINE_PLANS).join(", ")}`);

const SEARCHES = { "recherche (jouée par la plus proche)": "nearest", "recherche (jouée par la couverture)": "cover" };
const started = Date.now();
const runs = lineRuns(setup, { days, rules: { ...LINE_RULES, ...Object.fromEntries(Object.entries(SEARCHES).map(([name, rollout]) => [name, lineSearchRule({ rollout })])) } });
const stops = (name, count) => runs[name].slice(0, count).map((one) => one.stopped);

/** The rules and both searches over the first `count` hours: the stops, each search against the best rule, and the two searches against each other. */
function report(count) {
  const rules = Object.keys(LINE_RULES);
  const mean = (name) => meanOf(runs[name].slice(0, count), "stopped");
  const best = rules.reduce((one, other) => (mean(other) < mean(one) ? other : one));
  const means = rules.map((name) => LINE_RULE_LABELS[name] + " " + fixed(mean(name))).join(" · ");
  console.log(`\n${count} heures : ${means}`);
  for (const name of Object.keys(SEARCHES)) {
    const gain = paired(stops(best, count), stops(name, count));
    console.log(`${name.padEnd(38)} ${fixed(mean(name)).padStart(6)} tours d'arrêt, sur la meilleure règle (${LINE_RULE_LABELS[best]}) ${interval(gain)}`);
  }
  const [nearest, cover] = Object.keys(SEARCHES);
  console.log(`la couverture sur la plus proche, comme règle de jeu : ${interval(paired(stops(nearest, count), stops(cover, count)))} tours d'arrêt en moins`);
}

console.log(`${setup.label} : ${days} heures de ligne, ${((Date.now() - started) / 1000).toFixed(0)} s`);
report(short);
report(days);
