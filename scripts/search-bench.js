import { paired } from "mcts-commun/measure.js";
import { PLANS } from "../src/plans.js";
import { RULES } from "../src/rules.js";
import { searchRule } from "../src/search.js";
import { runDay } from "../src/simulate.js";

/**
 * `node scripts/search-bench.js [days] [plan] [variant…]`: the search against the list order, the nearest
 * order and the farthest order on the same drawn days, by pairs (turns gained on the list order's finish; above 0, earlier). A
 * variant is `key=value,key=value` over SEARCH_SETTINGS, e.g. `budget=128,explore=0.5`.
 */
const [daysArg = "20", planArg = "sami", ...variants] = process.argv.slice(2);
const days = Number(daysArg);
const plans = planArg === "tous" ? Object.keys(PLANS) : [planArg];
const optionsOf = (text) => Object.fromEntries(text.split(",").filter(Boolean).map((pair) => pair.split("=")).map(([key, value]) => [key, Number(value)]));
const fixed = (value, digits = 1) => value.toFixed(digits).replace(".", ",");
for (const id of plans) {
  const setup = PLANS[id];
  const list = [];
  const rows = { nearest: [], farthest: [], ...Object.fromEntries((variants.length ? variants : [""]).map((text) => [`search ${text}`, []])) };
  const started = Date.now();
  for (let i = 0; i < days; i += 1) {
    list.push(runDay(setup, 1 + i, RULES.list).measures);
    rows.nearest.push(runDay(setup, 1 + i, RULES.nearest).measures);
    rows.farthest.push(runDay(setup, 1 + i, RULES.farthest).measures);
    for (const text of variants.length ? variants : [""]) rows[`search ${text}`].push(runDay(setup, 1 + i, searchRule(optionsOf(text))).measures);
  }
  const mean = (measures, key) => measures.reduce((sum, one) => sum + one[key], 0) / measures.length;
  console.log(`\n${setup.label} : ${days} journées, ${((Date.now() - started) / 1000).toFixed(0)} s ; liste finie au tour ${fixed(mean(list, "finish"))}, livraison moyenne ${fixed(mean(list, "meanDelivery"))}`);
  for (const [name, measures] of Object.entries(rows)) {
    const gain = paired(list.map((one) => one.finish), measures.map((one) => one.finish));
    const wins = measures.filter((one, i) => one.finish < list[i].finish).length;
    const losses = measures.filter((one, i) => one.finish > list[i].finish).length;
    const versus = paired(rows.farthest.map((one) => one.finish), measures.map((one) => one.finish));
    console.log(`${name.padEnd(30)} fini ${fixed(mean(measures, "finish")).padStart(6)}  moy. ${fixed(mean(measures, "meanDelivery")).padStart(6)}  gain ${fixed(gain.mean)} (${fixed(gain.low)} à ${fixed(gain.high)})  ${wins}/${days - wins - losses}/${losses}  sur la plus lointaine ${fixed(versus.mean)} (${fixed(versus.low)} à ${fixed(versus.high)})`);
  }
}
