import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PLANS } from "../src/plans.js";
import { RULES } from "../src/rules.js";
import { createDay, drawDay, isOver, measuresOf, runDay, stepDay } from "../src/simulate.js";

/** The days that left an order undelivered (30/10/2026, the orders drawn: docs/recherche/feuille-de-route.md), each with its cause. */
const DAYS = [
  // A robot given an order while it gave way on its way home went back home after the pickup, and picked there.
  ["sami", 21, "nearest"],
  // A robot held short of a pickup cell on the closed aisle gave way to nobody all day; its block had others.
  ["quais", 1, "nearest"],
  // A relay called off as the pallet went down: the taker took it, its own order left to nobody.
  ["quais", 133, "truck"],
  // The station's loader fetched a part while two were on their way to its door; set down, they shut it out.
  ["assemblage", 54, "farthest"],
  // Two loaded robots nose to nose at the station's door: the one asked to give way had nowhere to go, the other was never asked.
  ["assemblage", 82, "farthest"],
];

describe("the days that left an order undelivered (30/10/2026)", () => {
  for (const [plan, seed, rule] of DAYS) {
    it(`delivers every order: ${plan}, day ${seed}, ${rule}`, () => {
      const { measures } = runDay(PLANS[plan], seed, RULES[rule]);
      assert.equal(measures.delivered, measures.orders);
    });
  }
});

/** Days with a relay called off (day-relays.js `callOff`), found on 30/10/2026: none was tested until then. */
const CALLED_OFF = [
  ["quais", 19, "nearest"],
  ["quais", 39, "nearest"],
  ["sami", 87, "list"],
];

describe("a relay called off (src/day-relays.js)", () => {
  for (const [plan, seed, rule] of CALLED_OFF) {
    it(`leaves no order to nobody: ${plan}, day ${seed}, ${rule}`, () => {
      const state = createDay(PLANS[plan], drawDay(seed, PLANS[plan]));
      let seen = 0;
      while (!isOver(state)) {
        const before = state.log.length;
        stepDay(state, RULES[rule]);
        const turn = state.log.slice(before);
        if (!turn.some((one) => one.type === "relayOff")) continue;
        seen += 1;
        // Called off, the same pair does not start again at once (30/10/2026: it did, the call-off undone).
        for (const off of turn.filter((one) => one.type === "relayOff")) assert.ok(!turn.some((one) => one.type === "relay" && one.robot === off.robot && one.to === off.to), `le même relais repart au tour ${state.t}`);
        // No order left to nobody: each one taken is some robot's, to fetch, to carry or kept for after a relay.
        for (const order of state.orders.filter((one) => one.status === "assigned")) {
          const robot = state.robots.find((one) => one.id === order.robot);
          assert.ok(robot && (robot.order === order.id || robot.relayOrder === order.id), `commande ${order.id} sans robot au tour ${state.t}`);
        }
      }
      assert.ok(seen > 0, "au moins un relais annulé");
      assert.equal(measuresOf(state).delivered, state.orders.length);
    });
  }
});
