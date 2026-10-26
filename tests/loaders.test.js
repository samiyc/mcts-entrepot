import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PLANS } from "../src/plans.js";
import { RULES } from "../src/rules.js";
import { createDay, drawDay, isOver, runDay, stepDay } from "../src/simulate.js";
import { WAREHOUSE } from "../src/warehouse-hypotheses.js";

const eventsOf = (state, type) => state.log.filter((event) => event.type === type);

describe("the dock loaders (src/day-loaders.js)", () => {
  it("lets the robots set their pallets down in a turn, and a loader take each into its truck in loadTurns", () => {
    const { state, measures } = runDay(PLANS.sami, 1, RULES.list);
    assert.equal(measures.delivered, measures.orders);
    // No robot goes into the truck: every pallet set down on the bay, then loaded by the loader.
    assert.equal(eventsOf(state, "delivered").length, 0);
    assert.equal(eventsOf(state, "staged").length, measures.orders);
    for (const loaded of eventsOf(state, "loaded")) {
      const start = eventsOf(state, "loading").find((event) => event.order === loaded.order);
      assert.equal(loaded.t - start.t, WAREHOUSE.loadTurns);
      assert.equal(loaded.loader, 1);
    }
    assert.ok(measures.loaderBusy > 0.5 && measures.loaderBusy <= 1);
    assert.equal(measures.loaderWalk, 0);
  });

  it("drops in a turn: no robot stays on its drop longer, where it stayed loadTurns with no loader", () => {
    // The longest a robot is seen dropping, turn after turn (a drop of a turn is seen at the end of two).
    const longest = (setup) => {
      const state = createDay(setup, drawDay(2, setup));
      const since = new Map();
      let most = 0;
      while (!isOver(state)) {
        stepDay(state, RULES.nearest);
        for (const robot of state.robots) since.set(robot.id, robot.phase === "dropping" ? (since.get(robot.id) ?? 0) + 1 : 0);
        most = Math.max(most, ...since.values());
      }
      return most;
    };
    assert.equal(longest(PLANS.couloirs), 2);
    assert.ok(longest({ ...PLANS.couloirs, dockLoaders: 0 }) > WAREHOUSE.loadTurns);
  });

  it("serves the trucks one after the other, a pallet at a time, walking between the docks", () => {
    const { state } = runDay(PLANS.quais, 1, RULES.list);
    const loadings = eventsOf(state, "loading");
    // One loader: a pallet at a time.
    for (let i = 1; i < loadings.length; i += 1) assert.ok(loadings[i].t >= loadings[i - 1].t + WAREHOUSE.loadTurns);
    const moves = eventsOf(state, "loaderTo");
    assert.ok(moves.length >= 2, "il passe d'un quai à l'autre");
    for (const move of moves) {
      const next = loadings.find((event) => event.t >= move.t);
      const order = state.orders.find((one) => one.id === next.order);
      assert.equal(order.truck + 1, move.truck);
      // The walk: the docks are one above the other, two rows apart.
      assert.ok(next.t - move.t >= 2);
    }
  });

  it("keeps the trucks apart with several loaders, never two in one truck", () => {
    const setup = { ...PLANS.quais, dockLoaders: 3 };
    const one = runDay(PLANS.quais, 1, RULES.list).measures;
    const { state, measures } = runDay(setup, 1, RULES.list);
    assert.ok(measures.truckWait < one.truckWait, `${measures.truckWait} tours à quai, contre ${one.truckWait} avec un chargeur`);
    const open = new Map();
    for (const event of state.log) {
      if (event.type === "loading") {
        const truck = state.orders.find((order) => order.id === event.order).truck;
        assert.ok(![...open.values()].some((other) => other.truck === truck && other.loader !== event.loader), `deux chargeurs dans le camion ${truck + 1}`);
        open.set(event.order, { truck, loader: event.loader });
      }
      if (event.type === "loaded") open.delete(event.order);
    }
  });

  it("takes no order for a truck whose bay is full", () => {
    const setup = { ...PLANS.quais, blocking: 0 };
    const state = createDay(setup, drawDay(3, setup));
    while (!isOver(state)) {
      const full = state.trucks.map((truck) => truck.dock.bay.every((cell) => state.claims.has(`${cell.x},${cell.y}`)));
      const before = state.log.length;
      stepDay(state, RULES.nearest);
      for (const event of state.log.slice(before)) {
        if (event.type !== "assigned") continue;
        const order = state.orders.find((one) => one.id === event.order);
        assert.ok(!full[order.truck], `tour ${state.t} : commande ${order.id} prise, la baie du camion ${order.truck + 1} pleine`);
      }
    }
  });

  it("leaves the loading to the robots with no loader, as before", () => {
    const { state, measures } = runDay({ ...PLANS.sami, dockLoaders: 0 }, 1, RULES.list);
    assert.equal(measures.delivered, measures.orders);
    assert.equal(eventsOf(state, "loading").length, 0);
    assert.ok(eventsOf(state, "delivered").length > 0);
    assert.equal(measures.loaderBusy, undefined);
  });
});
