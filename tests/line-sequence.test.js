import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRng } from "mcts-commun/random.js";
import { LINE_PLANS } from "../src/line-plan.js";
import { knownModels, resequenced, worldSequence } from "../src/line-models.js";
import { createLine, drawLineDay } from "../src/line.js";

const sorted = (sequence) => [...sequence].sort((a, b) => a - b);

describe("the resequencing: the sequence planned, a few vehicles moved at the last minute (src/line-models.js)", () => {
  it("moves a few vehicles later, keeps every vehicle, and moves none at no odds", () => {
    const planned = Array.from({ length: 200 }, (_, k) => k % 2);
    const moved = resequenced(createRng(1), { share: 0.05, reach: 5 }, planned);
    assert.deepEqual(sorted(moved), sorted(planned));
    assert.notDeepEqual(moved, planned);
    assert.deepEqual(resequenced(createRng(1), { share: 0, reach: 5 }, planned), planned);
  });

  it("shows the robots the vehicles as they are up to the notice, as planned after; a world keeps those and redraws the moves", () => {
    const setup = LINE_PLANS.melange;
    const day = drawLineDay(3, setup);
    assert.ok(day.planned && day.planned.length === day.sequence.length);
    const state = createLine(setup, day);
    const { notice } = setup.resequence;
    const seen = [...day.sequence.slice(0, notice + 1), ...day.planned.slice(notice + 1)].slice(0, setup.frozen + 1);
    assert.deepEqual(knownModels(state), seen.map((index) => setup.models[index]));
    const world = worldSequence(state, createRng(9));
    assert.deepEqual(world.slice(0, notice + 1), day.sequence.slice(0, notice + 1));
    assert.equal(world.length, day.sequence.length);
  });
});
