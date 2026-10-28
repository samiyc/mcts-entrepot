import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRng } from "mcts-commun/random.js";
import { withLegHorizon } from "../src/day-basics.js";
import { planLeg } from "../src/day-legs.js";
import { drawWorld } from "../src/search.js";
import { beginTurn, createDay } from "../src/simulate.js";

/** A one-cell aisle: robot 1 charges at the far end, robot 2 parked for good between it and the block A, the truck beyond. */
const AISLE = { label: "un couloir", text: ["c.c..T", "####A#"].join("\n"), robots: 2, orders: "A", blocking: 0, duration: 8, horizon: 60 };

describe("the legs (src/day-legs.js)", () => {
  it("finds no leg through a robot parked for good, and one on the near side", () => {
    const state = createDay(AISLE, { blockage: null });
    const [robot, parked] = state.robots;
    assert.deepEqual([parked.x, parked.y], [2, 0]);
    assert.equal(planLeg(state, robot, { x: 4, y: 0 }), false);
    assert.equal(planLeg(state, robot, { x: 1, y: 0 }), true);
  });

  it("plans the legs of a search's worlds `legHorizon` turns ahead, LEG_HORIZON without one", () => {
    const state = createDay(AISLE, { blockage: null });
    const parked = state.robots[1];
    assert.equal(withLegHorizon(state, null), state);
    // Two steps to the pickup: not within one turn ahead, found within the default.
    assert.equal(planLeg(withLegHorizon(state, 1), parked, { x: 4, y: 0 }), false);
    assert.equal(planLeg(state, parked, { x: 4, y: 0 }), true);
    beginTurn(state);
    assert.equal(drawWorld(withLegHorizon(state, 40), createRng(1)).legHorizon, 40);
  });
});
