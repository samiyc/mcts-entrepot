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

  it("draws the bays, the charging points and the trucks, and tells where the trucks are", () => {
    const setup = { ...PLANS.quais, blocking: 0 };
    const day = createDay(setup, drawDay(1, setup));
    const cells = cellsOf(day);
    assert.equal(cells.filter((cell) => cell.kind === "bay").length, 9);
    assert.equal(cells.filter((cell) => cell.kind === "charge").length, 4);
    assert.deepEqual(cells.filter((cell) => cell.kind === "dock").map((cell) => cell.truck.at), [20, 40, 60]);
    assert.match(statusLine(day), /camion 1 au tour 20, camion 2 au tour 40, camion 3 au tour 60/);
    while (!day.orders.some((order) => order.status === "staged")) stepDay(day, RULES.list);
    assert.ok(cellsOf(day).some((cell) => cell.kind === "bay" && cell.pallet));
    assert.ok(ordersOf(day).some((order) => order.status === "staged" && /^prête devant le quai/.test(order.label) && order.truck));
    while (!isOver(day)) stepDay(day, RULES.list);
    assert.match(statusLine(day, measuresOf(day)), /camion 1 parti, camion 2 parti, camion 3 parti.*\d+ tours à quai pour les camions/);
  });

  it("tells the robots, their legs, and the day as it goes", () => {
    const setup = { ...PLANS.sami, blocking: 0 };
    const day = createDay(setup, drawDay(2, setup));
    stepDay(day, RULES.list);
    const robots = robotsOf(day);
    assert.equal(robots.length, 4);
    assert.ok(robots.some((robot) => robot.ahead.length > 1));
    assert.match(robots[0].label, /^Robot 1 : (va chercher|prend) \(commande 1, bloc A\)$/);
    assert.match(statusLine(day), /^Tour 1 \/ 260 · 0 \/ 12 commandes livrées · allées libres$/);
    while (!isOver(day)) stepDay(day, RULES.list);
    assert.match(statusLine(day, measuresOf(day)), /12 \/ 12 commandes livrées · allées libres · fini au tour \d+ · \d+ pas, \d+ attentes$/);
    assert.ok(ordersOf(day).every((order) => /^livrée, robot \d au tour \d+$/.test(order.label)));
    assert.deepEqual(blockageOf(createDay(setup, { blockage: null })), { now: false, seen: false });
  });
});
