import { paired } from "mcts-commun/measure.js";
import { DRIVERS } from "../src/line-drivers.js";
import { LINE_PLANS } from "../src/line-plan.js";
import { LINE_RULES, LINE_RULE_LABELS } from "../src/line-rules.js";
import { runLine } from "../src/line.js";
import { fixed, interval, meanOf } from "./format.js";
import { mergeEnd, mergedOf, pieceOptions, runsOfLines, unitsOf } from "./units.js";

/**
 * `node scripts/line-drivers.js [--plan seul] [--days 100] [--from 1] [--rule nearest] [--out FILE]`: what a driver on
 * the line brings or costs (step 3), by pairs on the same hours: the robots alone, with the helping driver, with a
 * driver at random. `--out` writes each hour as a JSON line, `--merge FILE…` makes the tables of the pieces
 * (scripts/units.js).
 */
const args = process.argv.slice(2);
const option = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const { from, days, out, merging } = pieceOptions(args);
const ruleName = option("--rule", "nearest");
const named = args.includes("--plan") ? [option("--plan")] : Object.keys(LINE_PLANS);

/** The drivers against the robots alone, over a line's hours. */
function report(setup, runs) {
  const { alone } = runs;
  console.log(`\n${setup.label}, ${LINE_RULE_LABELS[ruleName]} : ${alone.length} heures ; les robots seuls, arrêt ${fixed(meanOf(alone, "stopped"))} tours`);
  for (const name of ["helping", "random"]) {
    const gain = paired(alone.map((one) => one.stopped), runs[name].map((one) => one.stopped));
    const label = name === "helping" ? "le cariste qui aide" : "le cariste au hasard";
    console.log(`${label.padEnd(22)} arrêt ${fixed(meanOf(runs[name], "stopped")).padStart(6)}, gagné sur les robots seuls ${interval(gain)}, ${fixed(meanOf(runs[name], "humanDelivered"))} bacs portés`);
  }
}

/** The hours of a line one by one: the robots alone, with each driver. */
function measured(id, unit) {
  const setup = LINE_PLANS[id];
  const withHuman = { ...setup, human: true };
  const rule = LINE_RULES[ruleName];
  const runs = { alone: [], helping: [], random: [] };
  for (let seed = from; seed < from + days; seed += 1) {
    const hour = { alone: runLine(setup, seed, rule).measures, helping: runLine(withHuman, seed, rule, DRIVERS.helping(seed)).measures, random: runLine(withHuman, seed, rule, DRIVERS.random(seed)).measures };
    for (const name of Object.keys(runs)) runs[name].push(hour[name]);
    unit({ plan: id, from, of: days, seed, runs: hour });
  }
  return runs;
}

if (merging) {
  const merged = mergedOf(merging, (line) => line.plan, { from, days });
  for (const id of [...new Set(merged.lines.map((line) => line.plan))]) report(LINE_PLANS[id], runsOfLines(merged.lines.filter((line) => line.plan === id)));
  mergeEnd(merged, "heures");
} else {
  const unit = unitsOf({ scope: "line-drivers", of: named.length * days, unit: "heure", out });
  for (const id of named) report(LINE_PLANS[id], measured(id, unit));
}
