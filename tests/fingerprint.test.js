import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { PLANS } from "../src/plans.js";
import { RULES } from "../src/rules.js";
import { searchRule } from "../src/search.js";
import { runDay } from "../src/simulate.js";

/**
 * What the warehouse does, held in a few hashes (Sami, 26/10/2026, before the code went under the lint budget, as in
 * mcts-urgences): a refactor must leave every one unchanged. A change meant to alter what the model does updates its
 * hash here, and its commit says so, with the measures before and after.
 */
const EXPECTED = {
  rules: "e1e6da092158c43c",
  variants: "b6f4f8a298e5ce56",
  search: "b6be81de0070fcb0",
};

const digest = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 16);

/** A day played: everything it logged (moves aside: assignments, loads, relays, blockages seen, deliveries) and its measures. */
const played = (setup, seed, rule) => {
  const { state, measures } = runDay(setup, seed, rule);
  return { log: state.log, measures, robots: state.robots.map((robot) => [robot.x, robot.y, robot.moves, robot.waits]) };
};

const FINGERPRINTS = {
  // Every plan under every rule, three days each: the loads, the loaders, the truck queues and the relays with them.
  rules: () => Object.values(PLANS).flatMap((setup) => [1, 2, 3].flatMap((seed) => Object.values(RULES).map((rule) => played(setup, seed, rule)))),
  // The switches and settings the plans leave at their defaults.
  variants: () =>
    [
      { ...PLANS.quais, relay: false },
      { ...PLANS.couloirs, autoZones: false },
      { ...PLANS.petit, autoZones: false },
      { ...PLANS.sami, blocking: 0.15 },
      { ...PLANS.quais, blocking: 0.5, duration: 4 },
    ].flatMap((setup) => [1, 2].flatMap((seed) => [RULES.nearest, RULES.list].map((rule) => played(setup, seed, rule)))),
  // A day played by the search, at a small budget.
  search: () => played({ ...PLANS.petit, autoZones: false }, 1, searchRule({ budget: 16 })),
};

describe("the fingerprints of the warehouse (a refactor changes none)", () => {
  for (const [name, compute] of Object.entries(FINGERPRINTS)) {
    it(`keeps the ${name} unchanged`, () => {
      assert.equal(digest(compute()), EXPECTED[name], `${name} : le comportement a changé`);
    });
  }
});
