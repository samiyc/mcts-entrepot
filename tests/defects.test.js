import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PLANS } from "../src/plans.js";
import { RULES } from "../src/rules.js";
import { runDay } from "../src/simulate.js";

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
