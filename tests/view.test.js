import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PLANS } from "../src/plans.js";
import { RULES } from "../src/rules.js";
import { createDay, drawDay, isOver, measuresOf, stepDay } from "../src/simulate.js";
import { blockageOf, cellsOf, ordersOf, robotsOf, statusLine } from "../web/view.js";

describe("what the page shows (web/view.js)", () => {
  it("draws every cell of the plan, the blocks with their pending orders", () => {
    const day = createDay(PLANS.petit, { blockage: null });
    const cells = cellsOf(day);
    assert.equal(cells.length, day.warehouse.plan.width * day.warehouse.plan.height);
    assert.equal(cells.find((cell) => cell.kind === "block" && cell.letter === "A").pending, 2);
    assert.equal(cells.filter((cell) => cell.kind === "dock").length, 1);
    assert.equal(cells.filter((cell) => cell.kind === "blockable").length, 1);
  });

  it("tells the robots, their legs, and the day as it goes", () => {
    const setup = { ...PLANS.sami, blocking: 1 };
    const day = createDay(setup, drawDay(2, setup));
    stepDay(day, RULES.list);
    const robots = robotsOf(day);
    assert.equal(robots.length, 4);
    assert.ok(robots.some((robot) => robot.ahead.length > 1));
    assert.match(robots[0].label, /^Robot 1 : va chercher \(commande 1, bloc A\)$/);
    assert.match(statusLine(day), /^Tour 1 \/ 120 · 0 \/ 12 commandes livrées · allées libres$/);
    while (!isOver(day)) stepDay(day, RULES.list);
    assert.match(statusLine(day, measuresOf(day)), /12 \/ 12 commandes livrées · allées libres · fini au tour \d+ · \d+ pas, \d+ attentes$/);
    assert.ok(ordersOf(day).every((order) => /^livrée, robot \d au tour \d+$/.test(order.label)));
    assert.deepEqual(blockageOf(createDay(setup, { blockage: null })), { now: false, seen: false });
  });
});
