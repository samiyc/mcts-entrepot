import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { LINE_RULES } from "../src/line-rules.js";
import { PLANT_PLANS, isPlantOver, measuresOfPlant, runPlant, startPlant, stepPlant } from "../src/plant.js";

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
});
