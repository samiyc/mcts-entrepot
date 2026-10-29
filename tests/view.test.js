import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PLANS } from "../src/plans.js";
import { RULES } from "../src/rules.js";
import { createDay, drawDay, isOver, measuresOf, stepDay } from "../src/simulate.js";
import { blockageOf, cellsOf, ordersOf, robotsOf, stationsOf, statusLine } from "../web/view.js";

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
    assert.ok(ordersOf(day).some((order) => order.status === "staged" && order.label.startsWith("prête devant le quai") && order.truck));
    while (!isOver(day)) stepDay(day, RULES.list);
    const line = statusLine(day, measuresOf(day));
    assert.match(line, /camion 1 parti, camion 2 parti, camion 3 parti/);
    assert.match(line, /· \d+ tours à quai pour les camions/);
  });

  it("tells the robots, their legs, and the day as it goes", () => {
    const setup = { ...PLANS.sami, blocking: 0 };
    const day = createDay(setup, drawDay(2, setup));
    stepDay(day, RULES.list);
    const robots = robotsOf(day);
    assert.equal(robots.length, 4);
    assert.ok(robots.some((robot) => robot.ahead.length > 1));
    assert.match(robots[0].label, new RegExp(`^Robot 1 : (va chercher|prend) \\(commande 1, bloc ${day.orders[0].block}\\)$`));
    assert.match(statusLine(day), /^Tour 1 \/ 420 · 0 \/ 12 commandes livrées · allées libres$/);
    while (!isOver(day)) stepDay(day, RULES.list);
    assert.match(statusLine(day, measuresOf(day)), /12 \/ 12 commandes livrées · allées libres · fini au tour \d+ · \d+ pas, \d+ attentes?$/);
    assert.ok(ordersOf(day).every((order) => /^livrée, robot \d, chargeur 1 au tour \d+$/.test(order.label)));
    assert.deepEqual(blockageOf(createDay(setup, { blockage: null })), { now: false, seen: false });
  });
});

describe("the days of a comparison by pairs (web/view.js)", () => {
  it("gives each rule's gain on the list order, day by day, 0 inside the range", async () => {
    const { pairedDays } = await import("../web/view.js");
    const runs = { list: [{ truckWait: 10 }, { truckWait: 20 }], nearest: [{ truckWait: 12 }, { truckWait: 15 }] };
    const paired = pairedDays(runs, 5);
    assert.deepEqual(paired.rows, [{ name: "nearest", diffs: [{ seed: 5, gain: -2 }, { seed: 6, gain: 5 }] }]);
    assert.equal(paired.low, -2);
    assert.equal(paired.high, 5);
  });
});

describe("the assembly station on the page (web/view.js)", () => {
  it("shows the station, its kit waiting for its parts then at work, and what each order is to a kit", () => {
    const setup = PLANS.assemblage;
    const day = createDay(setup, drawDay(1, setup));
    const cell = cellsOf(day).find((one) => one.kind === "assembly");
    assert.deepEqual({ x: cell.x, y: cell.y }, { x: 1, y: 7 });
    assert.deepEqual(stationsOf(day), [{ x: 1, y: 7, kit: 1, parts: 2, partsIn: 0, working: false, since: null }]);
    const orders = ordersOf(day);
    assert.match(orders.find((order) => order.block === "I").label, /^pièce du kit 1 : /);
    assert.match(orders.find((order) => order.block === "S1").label, /^colis assemblé \(kit 1\) : en attente de son assemblage/);
    while (!day.kits.some((kit) => kit.startedAt !== null)) stepDay(day, RULES.nearest);
    const [station] = stationsOf(day);
    assert.equal(station.working, true);
    assert.equal(station.since, day.kits.find((kit) => kit.startedAt !== null).startedAt);
    assert.ok(!statusLine(day).includes("camion 2"));
  });
});
