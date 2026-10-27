import fs from "node:fs";
import path from "node:path";
import { progress } from "mcts-commun/trace.js";

/**
 * The units of a long measure (days, hours), one by one, as mcts-commun asks of the jobs in its queue (docs/backlog.md,
 * « Recommandations aux projets », 27/10/2026: a job said nothing for 45 minutes, then everything at its end). Each
 * unit is traced by `progress` (the queue's views: « journée 12/30, fin vers 10:20 »), told in a short line on the
 * error output (the table stays alone on the standard output), and with `--out`, appended to its file as a JSON line:
 * a job stopped at its limit keeps what it computed, and `--merge` makes the table again from the pieces.
 */

/** The options every measuring script shares: the first seed, the units, the file of each unit, the pieces to merge. */
export function pieceOptions(args, days = 100) {
  const option = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
  const merging = args.includes("--merge") ? args.slice(args.indexOf("--merge") + 1) : null;
  return { from: Number(option("--from", 1)), days: Number(option("--days", days)), out: option("--out", null), merging };
}

/** What records each of `of` units (`unit`, « journée »): traced, told on `log`, appended to `out` when given. */
export function unitsOf({ scope, of, unit, out = null, log = console.error }) {
  if (out) {
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, "");
  }
  const started = Date.now();
  let done = 0;
  // Said from the start: a job whose first day takes minutes showed nothing until then (27/10, the queue tried).
  progress(scope, 0, of, { unit });
  return (record) => {
    done += 1;
    progress(scope, done, of, { unit });
    log(`${unit} ${done}/${of}, ${Math.round((Date.now() - started) / 1000)} s`);
    if (out) fs.appendFileSync(out, `${JSON.stringify(record)}\n`);
  };
}

/** The lines of a file that parse (the last one cut, its job stopped while writing it, is left out). */
function linesOf(file) {
  return fs.readFileSync(file, "utf8").split("\n").flatMap((line) => {
    try {
      return line ? [JSON.parse(line)] : [];
    } catch {
      return [];
    }
  });
}

/** Seeds as ranges: "4 à 7, 12". */
const rangesOf = (seeds) => seeds.reduce((ranges, seed) => {
  const last = ranges.at(-1);
  if (last && last[1] === seed - 1) last[1] = seed;
  else ranges.push([seed, seed]);
  return ranges;
}, []).map(([low, high]) => (low === high ? String(low) : `${low} à ${high}`));

/**
 * The pieces' units (`{ seed, from, of, … }` each, `from` and `of` its piece's), put together: by `group` then by
 * seed, the first of a seed measured twice; the seeds of the measure (`range`, its `from` and `days`) or of a piece
 * that none measured (a piece cut short, or one that never wrote its file), as text; and how many pieces.
 * @param {string[]} files
 * @param {(line: any) => unknown} [group]
 * @param {{ from: number, days: number } | null} [range]
 */
export function mergedOf(files, group = () => "", range = null) {
  const all = files.filter((file) => fs.existsSync(file)).flatMap(linesOf);
  if (all.length === 0) throw new Error("aucun morceau trouvé");
  const seen = new Map();
  const keyOf = (line) => `${group(line)}|${line.seed}`;
  for (const line of all) if (!seen.has(keyOf(line))) seen.set(keyOf(line), line);
  const lines = [...seen.values()].sort((a, b) => a.seed - b.seed);
  const pieces = new Map(all.map((line) => [line.from, line.of]));
  const groups = [...new Set(lines.map(group))];
  const ranges = [...pieces, ...(range ? [[range.from, range.days]] : [])];
  const due = [...new Set(ranges.flatMap(([from, of]) => Array.from({ length: of }, (_, i) => from + i)))].sort((a, b) => a - b);
  const missing = due.filter((seed) => groups.some((one) => !seen.has(`${one}|${seed}`)));
  return { lines, pieces: pieces.size, missing: rangesOf(missing), first: due[0], last: due.at(-1) };
}

/** The line that ends a merged table; a merge with days missing exits with 1, for the queue to show it. */
export function mergeEnd({ pieces, missing, first, last }, unit = "journées") {
  const gaps = missing.length > 0 ? ` ; manquent ${missing.join(", ")}` : "";
  console.log(`${pieces} morceau${pieces > 1 ? "x" : ""}, ${unit} ${first} à ${last}${gaps}`);
  if (missing.length > 0) process.exitCode = 1;
}

/** Each name's measures, in the order of the lines (`line.runs[name]`, one unit each). */
export const runsOfLines = (lines) => Object.fromEntries(Object.keys(lines[0].runs).map((name) => [name, lines.map((line) => line.runs[name])]));
