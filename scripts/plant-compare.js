import { paired } from "mcts-commun/measure.js";
import { LINE_RULES } from "../src/line-rules.js";
import { PLANT_PLANS, WAREHOUSE_RULE_LABELS, runPlant } from "../src/plant.js";
import { fixed, interval, meanOf } from "./format.js";

/**
 * `npm run plant -- [--plan usine] [--days 100]` (Sami, 26/10/2026): the plant, the line under the kanban, the warehouse
 * under each of its rules, with 1, 2 and 4 robots, on the same hours; the line's stop gained on the warehouse's list
 * order by pairs, the mean lead from the supermarket's order to its stock full again.
 */
const args = process.argv.slice(2);
const option = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const days = Number(option("--days", 100));
const setup = PLANT_PLANS[option("--plan", "usine")];
const RULE_NAMES = ["list", "nearest", "farthest", "urgent"];

for (const robots of [1, 2, 4]) {
  const runs = Object.fromEntries(RULE_NAMES.map((name) => [name, []]));
  for (let seed = 1; seed <= days; seed += 1) {
    for (const name of RULE_NAMES) runs[name].push(runPlant({ ...setup, warehouse: { ...setup.warehouse, robots }, warehouseRule: name }, seed, LINE_RULES.kanban).measures);
  }
  console.log(`\n${setup.label}, ${robots} robot(s) à l'entrepôt, ${days} heures`);
  const list = runs.list.map((one) => one.stopped);
  for (const [name, measures] of Object.entries(runs)) {
    const gain = name === "list" ? "—" : interval(paired(list, measures.map((one) => one.stopped)));
    console.log(`${WAREHOUSE_RULE_LABELS[name].padEnd(30)} arrêt de la ligne ${fixed(meanOf(measures, "stopped")).padStart(6)}  gagné sur l'ordre ${gain.padStart(22)}  délai ${fixed(meanOf(measures, "supplyLead"), 0)} tours`);
  }
}
