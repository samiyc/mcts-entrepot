import { PLANS } from "../src/plans.js";
import { RULE_LABELS, compareRules } from "../src/rules.js";

/**
 * `npm run compare -- [--plan petit|sami|couloirs] [--days 100]`: the assignment rules on the same drawn days
 * of a warehouse, a line each; every plan when none is named.
 */
const args = process.argv.slice(2);
const days = args.includes("--days") ? Number(args[args.indexOf("--days") + 1]) : 100;
const named = args.includes("--plan") ? [args[args.indexOf("--plan") + 1]] : Object.keys(PLANS);
const fixed = (value, digits = 1) => value.toFixed(digits).replace(".", ",");
for (const id of named) {
  const setup = PLANS[id];
  if (!setup) throw new Error(`plan inconnu ; au choix : ${Object.keys(PLANS).join(", ")}`);
  const result = compareRules(setup, { days });
  console.log(`\n${setup.label} : ${days} journées, blocage ${fixed(100 * result.list.blockedDays, 0)} % des jours`);
  console.log("Règle                      | livrées | fini au tour | tours gagnés sur la liste (IC 95 %) | attentes | replanifiés");
  for (const [name, row] of Object.entries(result)) {
    const gain = name === "list" ? "—" : `${fixed(row.gain.mean)} (${fixed(row.gain.low)} à ${fixed(row.gain.high)})`;
    console.log([RULE_LABELS[name].padEnd(26), fixed(row.delivered, 2).padStart(7), fixed(row.finish).padStart(12), gain.padStart(35), fixed(row.waits).padStart(8), fixed(row.replans, 2).padStart(11)].join(" | "));
  }
}
