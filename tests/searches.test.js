import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { searchesLines, sumOf, takeAll, variantLines, variantsOf, watchersOf } from "../scripts/searches.js";

/** A search's result as mcts-commun returns it: two root moves at the same mean, 20 iterations, one level deep. */
const found = { stats: [{ key: "a", move: {}, visits: 10, mean: 0.5 }, { key: "b", move: {}, visits: 10, mean: 0.5 }], iterations: 20, depth: 1, ms: 3 };

describe("what the searches of a measure saw (scripts/searches.js)", () => {
  it("counts each decision's iterations, time and diagnose codes, unit by unit", () => {
    const watchers = watchersOf(["search"]);
    watchers.search.onSearch(found, 2);
    watchers.search.onSearch({ ...found, iterations: 44, rank: { played: 2, of: 5 } }, 2);
    const first = takeAll(watchers).search;
    assert.deepEqual(first, { searches: 2, iterations: 64, ms: 6, codes: { fewIterations: 1, flatScore: 2, shallow: 2 }, ranks: { "2/5": 1 } });
    // Taken, the next unit starts from nothing.
    assert.deepEqual(takeAll(watchers).search, { searches: 0, iterations: 0, ms: 0, codes: {}, ranks: {} });
    assert.deepEqual(sumOf([first, first]).codes, { fewIterations: 2, flatScore: 4, shallow: 4 });
    assert.deepEqual(sumOf([first, first]).ranks, { "2/5": 2 });
  });

  it("reads the variants asked, and pairs each on the search and on the one before", () => {
    const variants = variantsOf(["--search", "--early", "--variant", "calm=1,budget=128"]);
    assert.deepEqual(variants.map(({ name, options }) => ({ name, options })), [{ name: "early", options: { earlyStop: true } }, { name: "calm=1,budget=128", options: { calm: 1, budget: 128 } }]);
    const runs = { search: [{ stopped: 4 }, { stopped: 6 }], early: [{ stopped: 4 }, { stopped: 6 }], "calm=1,budget=128": [{ stopped: 3 }, { stopped: 6 }] };
    const lines = variantLines(runs, variants, "stopped");
    assert.equal(lines.length, 3);
    assert.match(lines[0], /^recherche, arrêt anticipé sur la recherche \(tours d'arrêt\) : 0,0 .* 0 gagnées, 0 perdues$/);
    assert.match(lines[2], /sur recherche, arrêt anticipé : 0,5 .* 1 gagnées, 0 perdues$/);
  });

  it("sums the units' records into a line per search", () => {
    const seen = { searches: 2, iterations: 64, ms: 6, codes: { flatScore: 2 } };
    const lines = searchesLines([{ searches: { search: seen } }, { searches: { search: seen } }, {}], { search: "recherche" });
    assert.deepEqual(lines, ["recherche : 4 décisions, 32,0 itérations et 3 ms chacune ; diagnose : flatScore 100 %"]);
    // The played move's rank, the first ones apart (a record from before 28/10 has none).
    const ranked = { ...seen, ranks: { "1/5": 1, "4/5": 1 } };
    assert.match(searchesLines([{ searches: { search: ranked } }], { search: "recherche" })[0], / ; rang du coup joué : 1er 50 %, 3e et plus 50 %$/);
  });
});
