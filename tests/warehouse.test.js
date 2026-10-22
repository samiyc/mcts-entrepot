import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PLANS } from "../src/plans.js";
import { RULES, compareRules } from "../src/rules.js";
import { createDay, drawDay, isOver, measuresOf, runDay, stepDay } from "../src/simulate.js";
import { distancesFrom, readWarehouse } from "../src/warehouse.js";

/**
 * Plays a day turn by turn, checking after each that no two robots share a cell (the truck and shared charging
 * points aside) or swap, and that no bay holds more pallets, waiting or promised, than it has cells.
 */
function playChecked(setup, seed, rule) {
  const state = createDay(setup, drawDay(seed, setup));
  const sharedCharges = setup.robots > state.warehouse.charges.length;
  const shared = (robot) => (robot.x === state.warehouse.dock.x && robot.y === state.warehouse.dock.y) || (sharedCharges && state.warehouse.plan.at(robot.x, robot.y) === "c");
  let before = state.robots.map((robot) => ({ ...robot }));
  while (!isOver(state)) {
    stepDay(state, rule);
    const cells = state.robots.filter((robot) => !shared(robot)).map((robot) => `${robot.x},${robot.y}`);
    for (const truck of state.trucks) {
      const waiting = state.orders.filter((order) => order.truck === truck.id - 1 && order.cell);
      assert.ok(state.t >= truck.at || waiting.length <= truck.dock.bay.length, `jour ${seed}, tour ${state.t} : trop de palettes pour le quai ${truck.id}`);
    }
    assert.equal(new Set(cells).size, cells.length, `jour ${seed}, tour ${state.t} : deux robots dans la même case`);
    for (const a of state.robots) {
      for (const b of state.robots) {
        const was = (robot) => before.find((one) => one.id === robot.id);
        const swapped = a.id < b.id && a.x === was(b).x && a.y === was(b).y && b.x === was(a).x && b.y === was(a).y && (a.x !== b.x || a.y !== b.y);
        assert.ok(!swapped, `jour ${seed}, tour ${state.t} : les robots ${a.id} et ${b.id} se croisent`);
      }
    }
    const blockage = state.day.blockage;
    if (blockage && state.t >= blockage.from && state.t < blockage.to) {
      for (const robot of state.robots) {
        const was = before.find((one) => one.id === robot.id);
        // Backing out along the stretch it was in when the pallet went down is allowed; walking in is not.
        const walkedIn = state.warehouse.plan.at(robot.x, robot.y) === "~" && state.warehouse.plan.at(was.x, was.y) !== "~";
        assert.ok(!walkedIn, `jour ${seed}, tour ${state.t} : le robot ${robot.id} entre dans une case bloquée`);
      }
    }
    before = state.robots.map((robot) => ({ ...robot }));
  }
  return state;
}

describe("the warehouse (src/warehouse.js, src/simulate.js)", () => {
  it("reads Sami's plan: the truck, twelve blocks each with pickup cells, five cells that may block", () => {
    const warehouse = readWarehouse(PLANS.sami.text);
    assert.deepEqual(warehouse.dock, { x: 16, y: 3, bay: [] });
    assert.deepEqual(warehouse.charges, []);
    assert.equal(warehouse.blocks.size, 12);
    assert.ok([...warehouse.blocks.values()].every((cells) => cells.length >= 4));
    assert.equal(warehouse.blockable.length, 5);
    const open = distancesFrom(warehouse, warehouse.dock);
    const shut = distancesFrom(warehouse, warehouse.dock, true);
    assert.equal(open.get("0,2"), 17);
    assert.ok(shut.get("0,2") > open.get("0,2"));
    assert.throws(() => createDay({ ...PLANS.petit, orders: "AZ" }, { blockage: null }), /pas de bloc Z/);
  });

  it("reads the docks plan: three docks, each with a bay of three cells filled from the truck, four charging points", () => {
    const warehouse = readWarehouse(PLANS.quais.text);
    assert.equal(warehouse.docks.length, 3);
    assert.deepEqual(warehouse.docks[0].bay, [{ x: 20, y: 1 }, { x: 19, y: 1 }, { x: 18, y: 1 }]);
    assert.equal(warehouse.charges.length, 4);
    assert.throws(() => createDay({ ...PLANS.quais, orders: "A/B/C/D" }, { blockage: null }), /4 camions pour 3 quais/);
  });

  it("starts robots at their charging points, prepares orders on the bays before their truck, loads them when it comes", () => {
    const setup = { ...PLANS.quais, blocking: 0 };
    const state = createDay(setup, drawDay(1, setup));
    assert.deepEqual(state.robots.map((robot) => `${robot.x},${robot.y}`), state.warehouse.charges.map((cell) => `${cell.x},${cell.y}`));
    while (!isOver(state)) stepDay(state, RULES.list);
    const loaded = state.log.filter((event) => event.type === "loaded");
    assert.ok(loaded.length > 0);
    for (const { order: id, t } of loaded) assert.equal(t, state.trucks[state.orders.find((order) => order.id === id).truck].at);
    assert.ok(state.orders.every((order) => order.deliveredAt >= state.trucks[order.truck].at));
    // The waits: each truck from its arrival to its last pallet.
    const waits = state.trucks.map((truck) => Math.max(...state.orders.filter((order) => order.truck === truck.id - 1).map((order) => order.deliveredAt)) - truck.at);
    assert.equal(measuresOf(state).truckWait, waits.reduce((sum, wait) => sum + wait, 0));
  });

  it("delivers every order on every plan, the same day from the same seed", () => {
    for (const setup of Object.values(PLANS)) {
      const calm = { ...setup, blocking: 0 };
      for (const rule of Object.values(RULES)) {
        const { measures } = runDay(calm, 3, rule);
        assert.equal(measures.delivered, measures.orders, setup.label);
        assert.ok(measures.finish < setup.horizon, setup.label);
      }
      assert.deepEqual(runDay(setup, 5, RULES.nearest).measures, runDay(setup, 5, RULES.nearest).measures);
    }
  });

  it("never puts two robots in one cell nor lets them swap, keeps them out of a blocked cell, and delivers all", () => {
    for (const setup of Object.values(PLANS)) {
      for (let seed = 1; seed <= 12; seed += 1) {
        for (const rule of Object.values(RULES)) {
          const state = playChecked({ ...setup, blocking: 0.8 }, seed, rule);
          assert.ok(state.orders.every((order) => order.status === "delivered"), `${setup.label}, jour ${seed}`);
        }
      }
    }
  });

  it("sees a blockage only from beside it, then routes around it", () => {
    const setup = { ...PLANS.sami, blocking: 1 };
    const seen = [];
    for (let seed = 1; seed <= 20; seed += 1) {
      const state = playChecked(setup, seed, RULES.list);
      if (state.known.seenAt !== null) seen.push(state);
    }
    assert.ok(seen.length > 0);
    for (const state of seen) assert.ok(state.known.seenAt + 1 >= state.day.blockage.from && state.known.seenAt < state.day.blockage.to);
  });

  it("compares the rules by pairs on the same days", () => {
    const result = compareRules(PLANS.petit, { days: 30 });
    assert.deepEqual(Object.keys(result), ["nearest", "list", "farthest", "truck"]);
    assert.ok(result.farthest.finish < result.list.finish, "la plus lointaine d'abord finit avant la liste");
    assert.equal(result.list.gain.mean, 0);
    assert.equal(result.nearest.gain.n, 30);
  });
});
