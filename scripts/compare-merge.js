import fs from "node:fs";
import { PLANS } from "../src/plans.js";
import { summaryOf } from "../src/rules.js";
import { printComparison } from "./compare-table.js";

/**
 * `node scripts/compare-merge.js FILE…`: the pieces of one long measure (`npm run compare -- --out FILE --from N`),
 * put together in the order of their days and compared by pairs as one (Sami, 26/10/2026: 100 days of search on a
 * plan with loads of 90 s take more than a night on a thread, ten jobs of 10 days do it in parallel). A piece cut
 * short counts for the days it measured, and the line says which days are missing.
 */
const pieces = process.argv.slice(2).filter((file) => fs.existsSync(file)).map((file) => JSON.parse(fs.readFileSync(file, "utf8")));
if (pieces.length === 0) throw new Error("aucun morceau trouvé");
const [first] = pieces;
if (pieces.some((piece) => piece.plan !== first.plan)) throw new Error("des morceaux de plans différents");
pieces.sort((a, b) => a.from - b.from);
const names = Object.keys(first.runs);
const runs = Object.fromEntries(names.map((name) => [name, pieces.flatMap((piece) => piece.runs[name])]));
// The days a piece did not reach, and those between two pieces (a piece that never wrote its file).
const holes = pieces.flatMap((piece, i) => [[piece.from + piece.days, piece.from + piece.of - 1], [piece.from + piece.of, (pieces[i + 1]?.from ?? 0) - 1]]);
const missing = holes.filter(([low, high]) => low <= high).map(([low, high]) => `${low} à ${high}`);
const gaps = missing.length > 0 ? ` ; manquent ${missing.join(", ")}` : "";
printComparison(PLANS[first.plan], runs.list.length, summaryOf(runs));
console.log(`${pieces.length} morceaux, journées ${pieces[0].from} à ${pieces.at(-1).from + pieces.at(-1).of - 1}${gaps}`);
