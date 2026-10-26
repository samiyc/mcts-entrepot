import { paired } from "mcts-commun/measure.js";
import { DRIVERS } from "../src/line-drivers.js";
import { LINE_PLANS } from "../src/line-plan.js";
import { LINE_RULES, LINE_RULE_LABELS } from "../src/line-rules.js";
import { runLine } from "../src/line.js";
import { fixed, interval, meanOf } from "./format.js";

/**
 * `node scripts/line-drivers.js [--plan seul] [--days 100] [--rule nearest]`: what a driver on the line brings or costs
 * (step 3), by pairs on the same hours: the robots alone, with the helping driver, with a driver at random.
 */
const args = process.argv.slice(2);
const option = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const days = Number(option("--days", 100));
const ruleName = option("--rule", "nearest");
const named = args.includes("--plan") ? [option("--plan")] : Object.keys(LINE_PLANS);

for (const id of named) {
  const setup = LINE_PLANS[id];
  const withHuman = { ...setup, human: true };
  const rule = LINE_RULES[ruleName];
  const alone = [];
  const runs = { helping: [], random: [] };
  for (let i = 1; i <= days; i += 1) {
    alone.push(runLine(setup, i, rule).measures);
    runs.helping.push(runLine(withHuman, i, rule, DRIVERS.helping(i)).measures);
    runs.random.push(runLine(withHuman, i, rule, DRIVERS.random(i)).measures);
  }
  console.log(`\n${setup.label}, ${LINE_RULE_LABELS[ruleName]} : ${days} heures ; les robots seuls, arrêt ${fixed(meanOf(alone, "stopped"))} tours`);
  for (const [name, measures] of Object.entries(runs)) {
    const gain = paired(alone.map((one) => one.stopped), measures.map((one) => one.stopped));
    const label = name === "helping" ? "le cariste qui aide" : "le cariste au hasard";
    console.log(`${label.padEnd(22)} arrêt ${fixed(meanOf(measures, "stopped")).padStart(6)}, gagné sur les robots seuls ${interval(gain)}, ${fixed(meanOf(measures, "humanDelivered"))} bacs portés`);
  }
}
