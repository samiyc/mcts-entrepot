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
  let before = state.robots.map((robot) => ({ ...robot }));
  while (!isOver(state)) {
    stepDay(state, rule);
    // No cell is shared (Sami, 23/10): not a truck's, not a charging point.
    const cells = state.robots.map((robot) => `${robot.x},${robot.y}`);
    for (const truck of state.trucks) {
      // Into a truck with a bay, only its loader, unless the bay is full.
      const inside = state.robots.filter((robot) => robot.x === truck.dock.x && robot.y === truck.dock.y);
      const full = (robot) => state.log.some((event) => event.type === "overflow" && event.robot === robot.id && event.truck === truck.id);
      if (truck.dock.bay.length > 0 && state.t >= truck.at) for (const robot of inside) assert.ok(Object.values(truck.loaders).includes(robot.id) || full(robot) || robot.phase === "idle", `jour ${seed}, tour ${state.t} : le robot ${robot.id} entre dans le camion ${truck.id}, chargé par ${truck.loader}`);
      const waiting = state.orders.filter((order) => order.truck === truck.id - 1 && order.cell);
      assert.ok(state.t >= truck.at || waiting.length <= truck.dock.bay.length, `jour ${seed}, tour ${state.t} : trop de palettes pour le quai ${truck.id}`);
    }
    assert.equal(new Set(cells).size, cells.length, `jour ${seed}, tour ${state.t} : deux robots dans la même case`);
    // A robot passes under a pallet waiting on a bay, never with one on its back.
    const pallets = new Set(state.orders.filter((order) => order.cell && (order.status === "staged" || order.status === "toTruck")).map((order) => `${order.cell.x},${order.cell.y}`));
    for (const robot of state.robots) assert.ok(robot.phase !== "toDrop" || !pallets.has(`${robot.x},${robot.y}`), `jour ${seed}, tour ${state.t} : le robot ${robot.id} passe avec sa palette sur une autre`);
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
  it("reads Sami's plan: the truck, its two waiting zones, twelve blocks each with pickup cells, four cells that may block", () => {
    const warehouse = readWarehouse(PLANS.sami.text);
    // The zones touch no truck: they belong to the only one, two zones, every cell nearest it first (Sami, 23/10).
    const cells = (keys) => keys.split(" ").map((key) => ({ x: Number(key.split(",")[0]), y: Number(key.split(",")[1]) }));
    assert.deepEqual(warehouse.dock, { x: 12, y: 3, bay: cells("11,1 11,5 11,0 11,6 10,0 10,6 9,0 9,6"), zones: [cells("11,1 11,0 10,0 9,0"), cells("11,5 11,6 10,6 9,6")] });
    assert.equal(warehouse.charges.length, 4);
    assert.equal(warehouse.blocks.size, 12);
    assert.ok([...warehouse.blocks.values()].every((cells) => cells.length >= 4));
    assert.equal(warehouse.blockable.length, 4);
    const open = distancesFrom(warehouse, warehouse.dock);
    const shut = distancesFrom(warehouse, warehouse.dock, true);
    assert.equal(open.get("1,2"), 12);
    // The aisle blocked, the cell beside the second charging point is cut off: its only way in is the aisle.
    assert.equal(shut.get("1,2"), undefined);
    assert.throws(() => createDay({ ...PLANS.petit, orders: "AZ" }, { blockage: null }), /pas de bloc Z/);
  });

  it("reads the docks plan: three docks, each with a bay of three cells filled from the truck, four charging points", () => {
    const warehouse = readWarehouse(PLANS.quais.text);
    assert.equal(warehouse.docks.length, 3);
    assert.deepEqual(warehouse.docks[0].bay, [{ x: 14, y: 1 }, { x: 13, y: 1 }, { x: 12, y: 1 }]);
    assert.equal(warehouse.charges.length, 4);
    assert.throws(() => createDay({ ...PLANS.quais, orders: "A/B/C/D" }, { blockage: null }), /4 camions pour 3 quais/);
  });

  it("starts robots at their charging points, prepares orders on the bays before their truck, and a robot loads each into it once there", () => {
    const setup = { ...PLANS.quais, blocking: 0 };
    const state = createDay(setup, drawDay(1, setup));
    assert.deepEqual(state.robots.map((robot) => `${robot.x},${robot.y}`), state.warehouse.charges.map((cell) => `${cell.x},${cell.y}`));
    while (!isOver(state)) stepDay(state, RULES.list);
    // Every pallet left on a bay was then taken by a robot into its truck, after the truck came.
    const staged = state.log.filter((event) => event.type === "staged");
    assert.ok(staged.length > 0);
    for (const { order: id } of staged) {
      const load = state.log.find((event) => event.type === "load" && event.order === id);
      const order = state.orders.find((one) => one.id === id);
      assert.ok(load && load.t >= state.trucks[order.truck].at, `commande ${id} chargée par un robot`);
      const delivered = state.log.find((event) => event.type === "delivered" && event.order === id);
      assert.equal(delivered.robot, load.robot);
      assert.ok(delivered.t > load.t);
    }
    assert.equal(state.claims.size, 0);
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

  it("never shuts a robot out with a bay in a one-cell aisle (Sami's corridors, 23/10), the truck there or coming", () => {
    const text = ["#############", "#AAAA.~.BBBB#", "#........wwwT", "#CCCC.~.DDDD#", "#############"].join("\n");
    for (const trucks of [[], [20]]) {
      for (let seed = 1; seed <= 12; seed += 1) {
        for (const rule of Object.values(RULES)) {
          const state = playChecked({ ...PLANS.couloirs, text, trucks, blocking: 0.8, horizon: 200 }, seed, rule);
          assert.ok(state.orders.every((order) => order.status === "delivered"), `camion au tour ${trucks[0] ?? 0}, jour ${seed}`);
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
