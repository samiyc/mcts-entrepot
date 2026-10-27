import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { searchesLines, sumOf, takeAll, watchersOf } from "../scripts/searches.js";

/** A search's result as mcts-commun returns it: two root moves at the same mean, 20 iterations, one level deep. */
const found = { stats: [{ key: "a", move: {}, visits: 10, mean: 0.5 }, { key: "b", move: {}, visits: 10, mean: 0.5 }], iterations: 20, depth: 1, ms: 3 };

describe("what the searches of a measure saw (scripts/searches.js)", () => {
  it("counts each decision's iterations, time and diagnose codes, unit by unit", () => {
    const watchers = watchersOf(["search"]);
    watchers.search.onSearch(found, 2);
    watchers.search.onSearch({ ...found, iterations: 44 }, 2);
    const first = takeAll(watchers).search;
    assert.deepEqual(first, { searches: 2, iterations: 64, ms: 6, codes: { fewIterations: 1, flatScore: 2, shallow: 2 } });
    // Taken, the next unit starts from nothing.
    assert.deepEqual(takeAll(watchers).search, { searches: 0, iterations: 0, ms: 0, codes: {} });
    assert.deepEqual(sumOf([first, first]).codes, { fewIterations: 2, flatScore: 4, shallow: 4 });
  });

  it("sums the units' records into a line per search", () => {
    const seen = { searches: 2, iterations: 64, ms: 6, codes: { flatScore: 2 } };
    const lines = searchesLines([{ searches: { search: seen } }, { searches: { search: seen } }, {}], { search: "recherche" });
    assert.deepEqual(lines, ["recherche : 4 décisions, 32,0 itérations et 3 ms chacune ; diagnose : flatScore 100 %"]);
  });
});
