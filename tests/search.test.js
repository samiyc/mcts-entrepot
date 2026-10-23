import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRng } from "mcts-commun/random.js";
import { PLANS } from "../src/plans.js";
import { RULES } from "../src/rules.js";
import { drawWorld, searchRule } from "../src/search.js";
import { advance, beginTurn, createDay, drawDay, runDay } from "../src/simulate.js";

const blockedSeed = (setup) => {
  for (let seed = 1; ; seed += 1) if (drawDay(seed, setup).blockages.length > 0) return seed;
};

describe("the search (src/search.js)", () => {
  it("draws a world from what the robots know, leaving the day untouched", () => {
    const setup = PLANS.couloirs;
    const day = createDay(setup, drawDay(blockedSeed(setup), setup));
    beginTurn(day);
    const choice = advance(day);
    assert.ok(choice);
    const before = JSON.stringify({ robots: day.robots, orders: day.orders, known: day.known, cursor: day.cursor });
    const worlds = Array.from({ length: 40 }, (_, i) => drawWorld(day, createRng(i + 1)));
    assert.equal(JSON.stringify({ robots: day.robots, orders: day.orders, known: day.known, cursor: day.cursor }), before);
    // Nothing seen yet: the blockages are drawn again, after now, differently from one world to the next.
    assert.ok(new Set(worlds.map((world) => JSON.stringify(world.day.blockages))).size > 1);
    assert.ok(worlds.every((world) => world.day.blockages.every((blockage) => blockage.from > day.t)));
    assert.ok(worlds.every((world) => world.choice.robot.id === choice.robot.id));
  });

  it("plays a whole day as a rule, every order delivered, the same day twice", () => {
    // Without the waiting zone made at the start: on this small plan it costs the search (docs/modele.md).
    const setup = { ...PLANS.petit, autoZones: false };
    const seed = blockedSeed(setup);
    const { measures } = runDay(setup, seed, searchRule({ budget: 16 }));
    assert.equal(measures.delivered, measures.orders);
    assert.deepEqual(runDay(setup, seed, searchRule({ budget: 16 })).measures, measures);
    assert.ok(measures.finish <= runDay(setup, seed, RULES.list).measures.finish + 4);
  });
});
