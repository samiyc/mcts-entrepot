import { paired } from "mcts-commun/measure.js";
import { LINE_PLANS } from "../src/line-plan.js";
import { LINE_RULES } from "../src/line-rules.js";
import { runLine } from "../src/line.js";
import { fixed, interval, meanOf } from "./format.js";

/**
 * `node scripts/line-stock.js [--days 100]` (Sami, 26/10/2026): the supermarket's reorder point as a decision, by pairs
 * on the same hours, the robots under the kanban. A fixed point at 1 bin, at 2, or the cover (order when the stock no
 * longer lasts the warehouse's mean lead time at the line's pace); on the supermarket plan, on the mix of models, and
 * with a slow warehouse. What it costs: the stock held, the orders.
 */
const args = process.argv.slice(2);
const days = args.includes("--days") ? Number(args[args.indexOf("--days") + 1]) : 100;
const base = LINE_PLANS.supermarche;
const CASES = {
  "le supermarché (retour en 10 à 40 min)": base,
  "le mélange de modèles, deux robots": { ...LINE_PLANS.melange, robots: 2, supermarket: base.supermarket, shortagesPerHour: 0 },
  "un entrepôt lent (4 bacs, retour en 20 à 60 min)": { ...base, supermarket: { ...base.supermarket, bins: 4, lead: [240, 720] } },
  "une file de 3 préparateurs (2 à 6 min, 5 min de trajet)": LINE_PLANS.file,
  "une file de 2 préparateurs": { ...LINE_PLANS.file, supermarket: { ...LINE_PLANS.file.supermarket, warehouse: { pickers: 2, transport: 60 } } },
};
const POLICIES = { "seuil à 1 bac": { policy: "point", reorder: 1 }, "seuil à 2 bacs": { policy: "point", reorder: 2 }, "à la couverture": { policy: "cover" } };

for (const [label, setup] of Object.entries(CASES)) {
  const runs = Object.fromEntries(Object.keys(POLICIES).map((name) => [name, []]));
  for (let seed = 1; seed <= days; seed += 1) {
    for (const [name, policy] of Object.entries(POLICIES)) runs[name].push(runLine({ ...setup, supermarket: { ...setup.supermarket, ...policy } }, seed, LINE_RULES.kanban).measures);
  }
  console.log(`\n${label}, ${days} heures (gain : l'arrêt évité sur le seuil à 1 bac, par paires)`);
  const first = runs["seuil à 1 bac"].map((one) => one.stopped);
  for (const [name, measures] of Object.entries(runs)) {
    const gain = name === "seuil à 1 bac" ? "—" : interval(paired(first, measures.map((one) => one.stopped)));
    console.log(`${name.padEnd(16)} arrêt ${fixed(meanOf(measures, "stopped")).padStart(6)}  gain ${gain.padStart(22)}  stock moyen ${fixed(meanOf(measures, "meanStock"))} bacs  commandes ${fixed(meanOf(measures, "ordered"))}`);
  }
}
