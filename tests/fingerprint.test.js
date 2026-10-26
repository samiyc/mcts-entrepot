import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { LINE_PLANS } from "../src/line-plan.js";
import { LINE_RULES } from "../src/line-rules.js";
import { lineSearchRule } from "../src/line-search.js";
import { runLine } from "../src/line.js";
import { PLANS } from "../src/plans.js";
import { PLANT_PLANS, runPlant } from "../src/plant.js";
import { RULES } from "../src/rules.js";
import { searchRule } from "../src/search.js";
import { runDay } from "../src/simulate.js";

/**
 * What the warehouse does, held in a few hashes (Sami, 26/10/2026, before the code went under the lint budget, as in
 * mcts-urgences): a refactor must leave every one unchanged. A change meant to alter what the model does updates its
 * hash here, and its commit says so, with the measures before and after. The assembly line (26/10/2026) has its own.
 */
const EXPECTED = {
  rules: "f4a389eee82ea253",
  variants: "e66e41b1943c3d5b",
  search: "40e575f0b2213329",
  line: "85e28c2d2b6d0b86",
  plant: "eb9655c978cfacec",
  kits: "6d097c4d2e850835",
};

const digest = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 16);

/** A day played: everything it logged (moves aside: assignments, loads, relays, blockages seen, deliveries) and its measures. */
const played = (setup, seed, rule) => {
  const { state, measures } = runDay(setup, seed, rule);
  return { log: state.log, measures, robots: state.robots.map((robot) => [robot.x, robot.y, robot.moves, robot.waits]) };
};

const lineDay = (setup, seed, rule) => {
  const { state, measures } = runLine(setup, seed, rule);
  return { log: state.log, measures, lanes: state.lanes, robots: state.robots.map((robot) => [robot.x, robot.y, robot.moves, robot.waits]) };
};

const plantHour = (setup, seed) => {
  const { state, measures } = runPlant(setup, seed, LINE_RULES.kanban);
  return { line: state.line.log, warehouse: state.warehouse.log, measures, sent: [...state.sent.values()].map((order) => order.at) };
};

const FINGERPRINTS = {
  // Every plan under every rule, three days each: the loads, the loaders, the truck queues and the relays with them.
  rules: () => [PLANS.petit, PLANS.sami, PLANS.quais, PLANS.couloirs, PLANS.flux].flatMap((setup) => [1, 2, 3].flatMap((seed) => Object.values(RULES).map((rule) => played(setup, seed, rule)))),
  // The switches and settings the plans leave at their defaults.
  variants: () =>
    [
      { ...PLANS.quais, relay: false },
      { ...PLANS.couloirs, autoZones: false },
      { ...PLANS.petit, autoZones: false },
      { ...PLANS.sami, blocking: 0.15 },
      { ...PLANS.quais, blocking: 0.5, duration: 4 },
    ].flatMap((setup) => [1, 2].flatMap((seed) => [RULES.nearest, RULES.list].map((rule) => played(setup, seed, rule)))),
  // The assembly station (26/10/2026): its plan under every rule, three days each.
  kits: () => [1, 2, 3].flatMap((seed) => Object.values(RULES).map((rule) => played(PLANS.assemblage, seed, rule))),
  // A day played by the search, at a small budget.
  search: () => played({ ...PLANS.petit, autoZones: false }, 1, searchRule({ budget: 16 })),
  // The assembly line: every plan under every rule, two hours each, and a short hour of its search.
  line: () => [
    ...Object.values(LINE_PLANS).flatMap((setup) => [1, 2].flatMap((seed) => Object.values(LINE_RULES).map((rule) => lineDay(setup, seed, rule)))),
    lineDay({ ...LINE_PLANS.seul, horizon: 240 }, 1, lineSearchRule({ budget: 12 })),
  ],
  // The plant (26/10/2026): each plan, one warehouse robot, half an hour under each warehouse rule, and a one-bin supermarket.
  plant: () =>
    [PLANT_PLANS.usine, PLANT_PLANS.vite].flatMap((plan) =>
      [plan, { ...plan, line: { ...plan.line, supermarket: { ...plan.line.supermarket, bins: 1 } } }].flatMap((one) =>
        ["list", "nearest", "farthest", "truck", "urgent"].map((warehouseRule) => plantHour({ ...one, line: { ...one.line, horizon: 360 }, warehouse: { ...one.warehouse, robots: 1 }, warehouseRule }, 1)),
      ),
    ),
};

describe("the fingerprints of the warehouse (a refactor changes none)", () => {
  for (const [name, compute] of Object.entries(FINGERPRINTS)) {
    it(`keeps the ${name} unchanged`, () => {
      assert.equal(digest(compute()), EXPECTED[name], `${name} : le comportement a changé`);
    });
  }
});
