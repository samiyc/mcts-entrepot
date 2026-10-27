import { RULE_LABELS } from "../src/rules.js";
import { fixed, interval } from "./format.js";

/** The table of a warehouse comparison (scripts/compare.js), the rules named by `labels`. */
export function printComparison(setup, days, result, labels = RULE_LABELS) {
  console.log(`\n${setup.label} : ${days} journées, blocage ${fixed(100 * result.list.blockedDays, 0)} % des jours`);
  console.log("Règle                      | livrées | fini au tour | tours gagnés sur la liste (IC 95 %) | attentes | replanifiés");
  for (const [name, row] of Object.entries(result)) {
    const gain = name === "list" ? "—" : interval(row.gain);
    console.log([labels[name].padEnd(26), fixed(row.delivered, 2).padStart(7), fixed(row.finish).padStart(12), gain.padStart(35), fixed(row.waits).padStart(8), fixed(row.replans, 2).padStart(11)].join(" | "));
  }
}
