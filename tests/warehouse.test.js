import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PLANS } from "../src/plans.js";
import { RULES, compareRules } from "../src/rules.js";
import { createDay, drawDay, isOver, runDay, stepDay } from "../src/simulate.js";
import { distancesFrom, readWarehouse } from "../src/warehouse.js";

/** Plays a day turn by turn, checking after each that no two robots share a cell (the truck aside) or swap. */
function playChecked(setup, seed, rule) {
  const state = createDay(setup, drawDay(seed, setup));
  let before = state.robots.map((robot) => ({ ...robot }));
  while (!isOver(state)) {
    stepDay(state, rule);
    const cells = state.robots.filter((robot) => robot.x !== state.warehouse.dock.x || robot.y !== state.warehouse.dock.y).map((robot) => `${robot.x},${robot.y}`);
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
    assert.deepEqual(warehouse.dock, { x: 16, y: 3 });
    assert.equal(warehouse.blocks.size, 12);
    assert.ok([...warehouse.blocks.values()].every((cells) => cells.length >= 4));
    assert.equal(warehouse.blockable.length, 5);
    const open = distancesFrom(warehouse, warehouse.dock);
    const shut = distancesFrom(warehouse, warehouse.dock, true);
    assert.equal(open.get("0,2"), 17);
    assert.ok(shut.get("0,2") > open.get("0,2"));
    assert.throws(() => createDay({ ...PLANS.petit, orders: "AZ" }, { blockage: null }), /pas de bloc Z/);
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
    assert.deepEqual(Object.keys(result), ["nearest", "list", "farthest"]);
    assert.ok(result.farthest.finish < result.list.finish, "la plus lointaine d'abord finit avant la liste");
    assert.equal(result.list.gain.mean, 0);
    assert.equal(result.nearest.gain.n, 30);
  });
});
