import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { traceTo } from "mcts-commun/trace.js";
import { mergedOf, runsOfLines, unitsOf } from "../scripts/units.js";

const folder = () => fs.mkdtempSync(path.join(os.tmpdir(), "entrepot-units-"));

/** A piece of `of` units from seed `from`, written as a job writes it, `cut` of them at most. */
function piece(file, { from, of, cut = of, group = {} }) {
  const unit = unitsOf({ scope: "test-units", of, unit: "journée", out: file, log: () => {} });
  for (let seed = from; seed < from + Math.min(cut, of); seed += 1) unit({ ...group, from, of, seed, runs: { list: { finish: seed } } });
}

describe("the units of a long measure (scripts/units.js)", () => {
  it("traces each unit's progress and writes it as a JSON line", () => {
    const events = [];
    const stop = traceTo((event) => event.kind === "progress" && event.scope === "test-units" && events.push(event));
    const file = path.join(folder(), "a.jsonl");
    piece(file, { from: 1, of: 3 });
    stop();
    assert.deepEqual(events.map(({ done, of, unit }) => ({ done, of, unit })).at(-1), { done: 3, of: 3, unit: "journée" });
    assert.equal(fs.readFileSync(file, "utf8").trim().split("\n").length, 3);
  });

  it("puts the pieces together by seed, and says which seeds a piece cut short did not measure", () => {
    const dir = folder();
    piece(path.join(dir, "b.jsonl"), { from: 4, of: 3, cut: 1 });
    piece(path.join(dir, "a.jsonl"), { from: 1, of: 3 });
    // A job stopped while writing its line leaves it cut: left out.
    fs.appendFileSync(path.join(dir, "b.jsonl"), '{"seed": 5, "ru');
    const merged = mergedOf(["a", "b", "never"].map((name) => path.join(dir, `${name}.jsonl`)));
    assert.deepEqual(merged.lines.map((line) => line.seed), [1, 2, 3, 4]);
    assert.deepEqual(runsOfLines(merged.lines).list.map((one) => one.finish), [1, 2, 3, 4]);
    assert.deepEqual({ pieces: merged.pieces, missing: merged.missing, first: merged.first, last: merged.last }, { pieces: 2, missing: ["5 à 6"], first: 1, last: 6 });
  });

  it("counts a seed missing when one group of a piece lacks it", () => {
    const file = path.join(folder(), "c.jsonl");
    const unit = unitsOf({ scope: "test-units", of: 4, unit: "heure", out: file, log: () => {} });
    for (const [robots, seed] of [[1, 1], [1, 2], [2, 1]]) unit({ robots, from: 1, of: 2, seed, runs: { list: {} } });
    assert.deepEqual(mergedOf([file], (line) => line.robots).missing, ["2"]);
    assert.throws(() => mergedOf([path.join(folder(), "none.jsonl")]), /aucun morceau/);
    // A piece that never wrote its file: only the measure's own days tell it.
    assert.deepEqual(mergedOf([file], (line) => line.robots, { from: 1, days: 4 }).missing, ["2 à 4"]);
  });
});
