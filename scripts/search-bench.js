import { paired } from "mcts-commun/measure.js";
import { PLANS } from "../src/plans.js";
import { RULES } from "../src/rules.js";
import { searchRule } from "../src/search.js";
import { runDay } from "../src/simulate.js";

/**
 * `node scripts/search-bench.js [days] [plan] [variant…]`: the search against the list order, the nearest
 * order, the farthest order and the truck due first on the same drawn days, by pairs (turns of truck waiting gained on the
 * list order; above 0, less waiting; with one truck there from the start, the last delivery's turn). A
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
  const rows = { nearest: [], farthest: [], truck: [], ...Object.fromEntries((variants.length ? variants : [""]).map((text) => [`search ${text}`, []])) };
  const started = Date.now();
  for (let i = 0; i < days; i += 1) {
    list.push(runDay(setup, 1 + i, RULES.list).measures);
    rows.nearest.push(runDay(setup, 1 + i, RULES.nearest).measures);
    rows.farthest.push(runDay(setup, 1 + i, RULES.farthest).measures);
    rows.truck.push(runDay(setup, 1 + i, RULES.truck).measures);
    for (const text of variants.length ? variants : [""]) rows[`search ${text}`].push(runDay(setup, 1 + i, searchRule(optionsOf(text))).measures);
  }
  const mean = (measures, key) => measures.reduce((sum, one) => sum + one[key], 0) / measures.length;
  console.log(`\n${setup.label} : ${days} journées, ${((Date.now() - started) / 1000).toFixed(0)} s ; liste : camions en attente ${fixed(mean(list, "truckWait"))} tours, finie au tour ${fixed(mean(list, "finish"))}, livraison moyenne ${fixed(mean(list, "meanDelivery"))}`);
  for (const [name, measures] of Object.entries(rows)) {
    const gain = paired(list.map((one) => one.truckWait), measures.map((one) => one.truckWait));
    const wins = measures.filter((one, i) => one.truckWait < list[i].truckWait).length;
    const losses = measures.filter((one, i) => one.truckWait > list[i].truckWait).length;
    const versus = paired(rows.farthest.map((one) => one.truckWait), measures.map((one) => one.truckWait));
    console.log(`${name.padEnd(30)} camions ${fixed(mean(measures, "truckWait")).padStart(6)}  fini ${fixed(mean(measures, "finish")).padStart(6)}  moy. ${fixed(mean(measures, "meanDelivery")).padStart(6)}  gain ${fixed(gain.mean)} (${fixed(gain.low)} à ${fixed(gain.high)})  ${wins}/${days - wins - losses}/${losses}  sur la plus lointaine ${fixed(versus.mean)} (${fixed(versus.low)} à ${fixed(versus.high)})`);
  }
}
