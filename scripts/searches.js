import { diagnose } from "mcts-commun/mcts.js";
import { fixed } from "./format.js";

/**
 * What the searches of a measure saw (mcts-commun, 27/10/2026 evening: docs/recherche.md § 2, docs/backlog.md
 * recommendation 8). A watcher counts, between two `take`s, the decisions searched, their iterations and time, and the
 * codes `diagnose` gives each one; a unit's record keeps them, and the pieces' are summed by `sumOf`. Reading a
 * result changes nothing the search does.
 */

const fresh = () => ({ searches: 0, iterations: 0, ms: 0, codes: {} });

/** `onSearch` for a search rule, and `take`, what it saw since the last `take`. */
export function watcherOf() {
  let seen = fresh();
  return {
    onSearch(found, depth) {
      seen.searches += 1;
      seen.iterations += found.iterations;
      seen.ms += found.ms;
      for (const { code } of diagnose(found, { depth })) seen.codes[code] = (seen.codes[code] ?? 0) + 1;
    },
    take() {
      const taken = seen;
      seen = fresh();
      return taken;
    },
  };
}

/** The sum of what several units' searches saw. */
export function sumOf(all) {
  const sum = fresh();
  for (const one of all) {
    sum.searches += one.searches;
    sum.iterations += one.iterations;
    sum.ms += one.ms;
    for (const [code, count] of Object.entries(one.codes)) sum.codes[code] = (sum.codes[code] ?? 0) + count;
  }
  return sum;
}

/** A line of what `label`'s searches saw: the decisions, their iterations and time each, each code's share. */
export function searchesLine(label, seen) {
  const per = (value) => (seen.searches ? value / seen.searches : 0);
  const codes = Object.entries(seen.codes).sort((a, b) => b[1] - a[1]).map(([code, count]) => `${code} ${fixed(100 * per(count), 0)} %`);
  return `${label} : ${seen.searches} décisions, ${fixed(per(seen.iterations))} itérations et ${fixed(per(seen.ms), 0)} ms chacune ; diagnose : ${codes.join(", ") || "rien"}`;
}

/** The watchers of the searches `names` (`--diagnose`, `--early`), none when the measure asked for neither. */
export function watchersOf(names) {
  return Object.fromEntries(names.map((name) => [name, watcherOf()]));
}

/** What each watcher saw since the last unit, for the unit's record. */
export function takeAll(watchers) {
  return Object.fromEntries(Object.entries(watchers).map(([name, watcher]) => [name, watcher.take()]));
}

/** The lines of what each search of the units' records saw, summed. */
export function searchesLines(records, labels) {
  const names = [...new Set(records.flatMap((record) => Object.keys(record.searches ?? {})))];
  return names.map((name) => searchesLine(labels[name] ?? name, sumOf(records.map((record) => record.searches?.[name]).filter(Boolean))));
}
