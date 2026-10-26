import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PLANS } from "../src/plans.js";
import { RULES, compareRules, runsOf, summaryOf } from "../src/rules.js";
import { createDay, drawDay, isOver, measuresOf, runDay, stepDay } from "../src/simulate.js";
import { distancesFrom, readWarehouse } from "../src/warehouse.js";

/** Into a truck with a bay, only its loader, unless the bay is full; and no bay holds more pallets than it has cells. */
function checkTrucks(state, seed) {
  for (const truck of state.trucks) {
    const inside = state.robots.filter((robot) => robot.x === truck.dock.x && robot.y === truck.dock.y);
    const full = (robot) => state.log.some((event) => event.type === "overflow" && event.robot === robot.id && event.truck === truck.id);
    // At an assembly station, a robot also comes onto the station's cell for an assembled parcel, and leaves with it (day-kits.js).
    const picking = (robot) => truck.station && state.orders.find((order) => order.id === robot.order)?.parcel;
    const allowed = (robot) => Object.values(truck.loaders).includes(robot.id) || full(robot) || robot.phase === "idle" || picking(robot);
    if (truck.dock.bay.length > 0 && state.t >= truck.at) for (const robot of inside) assert.ok(allowed(robot), `jour ${seed}, tour ${state.t} : le robot ${robot.id} entre dans le camion ${truck.id}, chargé par ${truck.loader}`);
    const waiting = state.orders.filter((order) => order.truck === truck.id - 1 && order.cell);
    assert.ok(state.t >= truck.at || waiting.length <= truck.dock.bay.length, `jour ${seed}, tour ${state.t} : trop de palettes pour le quai ${truck.id}`);
  }
}

/** No cell is shared (Sami, 23/10): not a truck's, not a charging point; and a robot passes under a pallet waiting on a bay, never with one on its back. */
function checkCells(state, seed) {
  const cells = state.robots.map((robot) => `${robot.x},${robot.y}`);
  assert.equal(new Set(cells).size, cells.length, `jour ${seed}, tour ${state.t} : deux robots dans la même case`);
  const pallets = new Set(state.orders.filter((order) => order.cell && (order.status === "staged" || order.status === "toTruck")).map((order) => `${order.cell.x},${order.cell.y}`));
  for (const robot of state.robots) assert.ok(robot.phase !== "toDrop" || !pallets.has(`${robot.x},${robot.y}`), `jour ${seed}, tour ${state.t} : le robot ${robot.id} passe avec sa palette sur une autre`);
}

/** Did robots `a` and `b` swap cells since `before`? */
function swapped(a, b, before) {
  const was = (robot) => before.find((one) => one.id === robot.id);
  const crossed = a.x === was(b).x && a.y === was(b).y && b.x === was(a).x && b.y === was(a).y;
  return a.id < b.id && crossed && (a.x !== b.x || a.y !== b.y);
}

/** No two robots swap cells; and, the aisle blocked, none walks into it (backing out along the stretch it was in is allowed). */
function checkMoves(state, seed, before) {
  const was = (robot) => before.find((one) => one.id === robot.id);
  for (const a of state.robots) for (const b of state.robots) assert.ok(!swapped(a, b, before), `jour ${seed}, tour ${state.t} : les robots ${a.id} et ${b.id} se croisent`);
  if (!state.day.blockages.some((blockage) => state.t >= blockage.from && state.t < blockage.to)) return;
  for (const robot of state.robots) {
    const walkedIn = state.warehouse.plan.at(robot.x, robot.y) === "~" && state.warehouse.plan.at(was(robot).x, was(robot).y) !== "~";
    assert.ok(!walkedIn, `jour ${seed}, tour ${state.t} : le robot ${robot.id} entre dans une case bloquée`);
  }
}

/**
 * Plays a day turn by turn, checking after each that no two robots share a cell or swap, that no bay holds more
 * pallets, waiting or promised, than it has cells, and that nobody walks into a blocked aisle.
 */
function playChecked(setup, seed, rule) {
  const state = createDay(setup, drawDay(seed, setup));
  let before = state.robots.map((robot) => ({ ...robot }));
  while (!isOver(state)) {
    stepDay(state, rule);
    checkTrucks(state, seed);
    checkCells(state, seed);
    checkMoves(state, seed, before);
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
    // The robots loading the trucks themselves, as before the dock loaders (day-loaders.js, 26/10/2026).
    const setup = { ...PLANS.quais, blocking: 0, dockLoaders: 0 };
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

  it("passes a stuck pallet to the robot nearer the truck through a waiting cell (Sami's relays, 23/10), and finishes sooner", () => {
    // Days with a relay (not every day has one: on days 3 and 8 nobody gets stuck), a pallet set into a truck in a turn:
    // at 90 s the truck's queue paces the robots and nobody gets stuck on these days (26/10/2026).
    const setup = { ...PLANS.quais, loadTurns: 1, dockLoaders: 0, horizon: 240 };
    for (const seed of [1, 2, 4, 5, 6, 7]) {
      const { state, measures } = runDay(setup, seed, RULES.nearest);
      const off = runDay({ ...setup, relay: false }, seed, RULES.nearest).measures;
      assert.equal(measures.delivered, measures.orders);
      assert.ok(measures.relays > 0, `jour ${seed} : aucun relais`);
      assert.equal(off.relays, 0);
      assert.ok(measures.finish < off.finish, `jour ${seed} : ${measures.finish} contre ${off.finish} sans relais`);
      // The robot that set the pallet down is not the one that delivered it.
      const relay = state.log.find((event) => event.type === "relay");
      const delivered = state.log.find((event) => event.type === "delivered" && event.order === relay.order);
      assert.equal(delivered.robot, relay.to);
    }
  });

  it("never puts two robots in one cell nor lets them swap, keeps them out of a blocked cell, and delivers all", () => {
    for (const setup of Object.values(PLANS)) {
      for (let seed = 1; seed <= 12; seed += 1) {
        for (const rule of Object.values(RULES)) {
          const state = playChecked({ ...setup, blocking: 0.5 }, seed, rule);
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
          const state = playChecked({ ...PLANS.couloirs, text, trucks, blocking: 0.5, horizon: 400 }, seed, rule);
          assert.ok(state.orders.every((order) => order.status === "delivered"), `camion au tour ${trucks[0] ?? 0}, jour ${seed}`);
        }
      }
    }
  });

  it("sees a blockage only from beside it, then routes around it, and again later in the day", () => {
    const setup = { ...PLANS.sami, blocking: 0.3 };
    const seen = [];
    for (let seed = 1; seed <= 20; seed += 1) {
      const state = playChecked(setup, seed, RULES.list);
      if (state.known.seenAt !== null) seen.push(state);
    }
    assert.ok(seen.length > 0);
    // Seen the turn before it began or while it was on; and over a day, again and again.
    for (const state of seen) assert.ok(state.day.blockages.some((blockage) => state.known.seenAt + 1 >= blockage.from && state.known.seenAt < blockage.to));
    assert.ok(seen.some((state) => state.known.seen > 1), "vue plusieurs fois dans une journée");
  });

  it("makes a waiting zone at the start for a truck the plan gives none, and robots then wait far less in a narrow aisle", () => {
    const corridors = readWarehouse(PLANS.couloirs.text);
    assert.equal(corridors.dock.auto, true);
    assert.deepEqual(corridors.dock.bay, [{ x: 11, y: 2 }, { x: 10, y: 2 }, { x: 9, y: 2 }]);
    assert.deepEqual(readWarehouse(PLANS.couloirs.text, { autoZones: false }).dock.bay, []);
    // A plan that draws its zones keeps them as they are.
    assert.ok(!readWarehouse(PLANS.sami.text).dock.auto);
    const waits = (autoZones) => runDay({ ...PLANS.couloirs, autoZones }, 1, RULES.list).measures.waits;
    assert.ok(waits(true) * 4 < waits(false), `${waits(true)} attentes contre ${waits(false)}`);
  });

  it("compares the rules by pairs on the same days", () => {
    const result = compareRules(PLANS.petit, { days: 30 });
    assert.deepEqual(Object.keys(result), ["nearest", "list", "farthest", "truck"]);
    assert.ok(result.nearest.finish < result.list.finish, "la plus proche d'abord finit avant la liste");
    assert.ok(result.nearest.gain.low > 0, "par paires, avec son intervalle");
    assert.equal(result.list.gain.mean, 0);
    assert.equal(result.nearest.gain.n, 30);
  });

  it("compares days measured in pieces as it compares them together", () => {
    const setup = { ...PLANS.petit, loadTurns: 1, horizon: 160 };
    const [early, late] = [runsOf(setup, { days: 3, seed: 1 }), runsOf(setup, { days: 2, seed: 4 })];
    const joined = Object.fromEntries(Object.keys(early).map((name) => [name, [...early[name], ...late[name]]]));
    assert.deepEqual(summaryOf(joined), compareRules(setup, { days: 5 }));
  });
});

describe("orders that arrive during the day (src/day-arrivals.js)", () => {
  it("hides an order until it arrives, opens it at its drawn turn, and plays the day to the end", () => {
    const setup = PLANS.flux;
    const state = createDay(setup, drawDay(1, setup));
    const arrivals = state.day.arrivals;
    assert.equal(arrivals.filter((t) => t === 0).length, setup.arrivals.known);
    assert.equal(state.orders.filter((order) => order.status === "pending").length, setup.orders.length - setup.arrivals.known);
    while (!isOver(state)) {
      stepDay(state, RULES.nearest);
      for (const order of state.orders) if (order.status === "pending") assert.ok(arrivals[order.id - 1] > state.t - 1, `commande ${order.id} encore cachée au tour ${state.t}`);
    }
    const measures = measuresOf(state);
    assert.equal(measures.delivered, measures.orders);
    assert.ok(measures.meanResponse > 0 && measures.meanResponse < measures.meanDelivery);
    assert.ok(state.log.some((event) => event.type === "arrived"));
  });

  it("draws the orders to come again in the search's worlds, not the true ones", async () => {
    const { createRng } = await import("mcts-commun/random.js");
    const { drawWorld } = await import("../src/search.js");
    const { advance, beginTurn } = await import("../src/simulate.js");
    const setup = PLANS.flux;
    const day = createDay(setup, drawDay(1, setup));
    beginTurn(day);
    advance(day);
    const worlds = Array.from({ length: 30 }, (_, i) => drawWorld(day, createRng(i + 1)));
    const pendingIds = day.orders.filter((order) => order.status === "pending").map((order) => order.id);
    // The true day untouched; the worlds' arrivals all after now, and different from one world to the next.
    assert.deepEqual(day.day.arrivals, drawDay(1, setup).arrivals);
    assert.ok(worlds.every((world) => pendingIds.every((id) => world.day.arrivals[id - 1] >= day.t)));
    assert.ok(new Set(worlds.map((world) => JSON.stringify(world.orders.filter((order) => order.status === "pending").map((order) => order.block)))).size > 1);
  });
});
