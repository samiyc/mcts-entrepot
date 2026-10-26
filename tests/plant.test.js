import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRng } from "mcts-commun/random.js";
import { LINE_RULES } from "../src/line-rules.js";
import { drawPlantWorld, plantSearchRule } from "../src/plant-search.js";
import { PLANT_PLANS, WAREHOUSE_RULES, advancePlant, choosePlant, isPlantOver, measuresOfPlant, runPlant, startPlant, stepPlant } from "../src/plant.js";

const listOf = (plant, choice) => WAREHOUSE_RULES.list(choice.robot, choice.open, { t: plant.t, reach: choice.reach, state: plant.warehouse })?.id;

describe("the plant: the line and its supermarket fed by the warehouse (src/plant.js)", () => {
  it("sends the supermarket's orders to the warehouse, brings them back by the shuttle, on one clock", () => {
    const setup = PLANT_PLANS.usine;
    const state = startPlant(setup, 1);
    assert.equal(state.warehouse.orders.length, 0);
    while (!isPlantOver(state)) {
      stepPlant(state, LINE_RULES.kanban);
      assert.equal(state.warehouse.t, state.line.t, "une seule horloge");
      // Each order of the warehouse is one the supermarket placed, for the block of the same letter.
      for (const [id, order] of state.sent) assert.equal(state.warehouse.orders[id - 1].block, order.block);
    }
    const measures = measuresOfPlant(state);
    assert.ok(measures.warehouseOrders > 0 && measures.warehouseDelivered > 0);
    assert.equal(measures.warehouseOrders, state.line.ordered);
    // A pallet comes back the shuttle's turns after it reached the warehouse's dock, never before.
    for (const [id, order] of state.sent) {
      const delivered = state.warehouse.orders[id - 1].deliveredAt;
      if (delivered !== null) assert.equal(order.at, delivered + setup.transport);
      else assert.equal(order.at, Infinity);
    }
    assert.ok(measures.supplyLead > setup.transport);
  });

  it("plays the same hour twice, and lets the warehouse's rule look at the line", () => {
    const setup = { ...PLANT_PLANS.usine, warehouse: { ...PLANT_PLANS.usine.warehouse, robots: 1 }, warehouseRule: "urgent" };
    assert.deepEqual(runPlant(setup, 2, LINE_RULES.kanban).measures, runPlant(setup, 2, LINE_RULES.kanban).measures);
    const farthest = runPlant({ ...setup, warehouseRule: "farthest" }, 2, LINE_RULES.kanban).measures;
    assert.ok(runPlant(setup, 2, LINE_RULES.kanban).measures.stopped <= farthest.stopped);
  });

  it("plays the same hour choice by choice (advancePlant, choosePlant) as turn by turn", () => {
    const setup = { ...PLANT_PLANS.usine, warehouse: { ...PLANT_PLANS.usine.warehouse, robots: 1 } };
    const plant = startPlant(setup, 3);
    for (let choice = advancePlant(plant, LINE_RULES.kanban); choice; choice = advancePlant(plant, LINE_RULES.kanban)) choosePlant(plant, choice, listOf(plant, choice));
    assert.deepEqual(measuresOfPlant(plant), runPlant(setup, 3, LINE_RULES.kanban).measures);
  });

  it("with the shuttle on a timetable, a pallet waits for the next departure", () => {
    const setup = PLANT_PLANS.train;
    const { state } = runPlant(setup, 1, LINE_RULES.kanban);
    for (const [id, order] of state.sent) {
      const delivered = state.warehouse.orders[id - 1].deliveredAt;
      if (delivered === null) continue;
      assert.equal(order.at, Math.ceil(delivered / setup.shuttleEvery) * setup.shuttleEvery + setup.transport);
      assert.equal((order.at - setup.transport) % setup.shuttleEvery, 0);
    }
  });

  it("draws worlds of the plant that leave the plant as it is, and searches the same hour twice alike", () => {
    const setup = { ...PLANT_PLANS.train, warehouse: { ...PLANT_PLANS.train.warehouse, robots: 1 }, line: { ...PLANT_PLANS.train.line, horizon: 240 } };
    const plant = startPlant(setup, 1);
    let choice = advancePlant(plant, LINE_RULES.kanban);
    while (choice && choice.open.length < 2) {
      choosePlant(plant, choice, listOf(plant, choice));
      choice = advancePlant(plant, LINE_RULES.kanban);
    }
    assert.ok(choice, "un choix entre deux commandes");
    const before = JSON.stringify({ restocks: plant.line.restocks, stock: plant.line.stock, orders: plant.warehouse.orders, t: plant.t });
    const world = drawPlantWorld(plant, createRng(1), 240);
    for (let next = world.choice; next; next = advancePlant(world, LINE_RULES.kanban)) choosePlant(world, next, listOf(world, next));
    assert.equal(JSON.stringify({ restocks: plant.line.restocks, stock: plant.line.stock, orders: plant.warehouse.orders, t: plant.t }), before);
    assert.ok(world.t >= 239);
    const searched = () => runPlant(setup, 1, LINE_RULES.kanban, plantSearchRule({ budget: 4, lookahead: 120 })).measures;
    assert.deepEqual(searched(), searched());
  });
});
