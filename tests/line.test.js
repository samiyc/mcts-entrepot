import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { bringBin, takt } from "../src/line-day.js";
import { LINE_PLANS, readLine } from "../src/line-plan.js";
import { LINE_RULES, coverOf } from "../src/line-rules.js";
import { lineSearchRule } from "../src/line-search.js";
import { createLine, drawLineDay, isOver, runLine, stepDay } from "../src/line.js";

const shortSeed = (setup) => {
  for (let seed = 1; ; seed += 1) if (drawLineDay(seed, setup).shortages.length > 0) return seed;
};

describe("the assembly line (src/line*.js)", () => {
  it("reads a line: its stations in reading order, each slot to the nearest, the drop cells beside the slots", () => {
    const { stations, warehouse } = readLine(LINE_PLANS.sami.text, LINE_PLANS.sami.refs);
    assert.deepEqual(stations.map((one) => one.refs.join("")), ["ABG", "CDH", "EI", "FJ", "KL"]);
    assert.ok(stations.every((one) => one.slots.length === 2 && one.access.length > 0));
    // Stations and slots are not floor: robots drop from beside them.
    assert.ok(stations.every((one) => !warehouse.floor(warehouse.plan.at(one.x, one.y)) && one.slots.every((slot) => !warehouse.floor(warehouse.plan.at(slot.x, slot.y)))));
    assert.throws(() => readLine("c.AA\n..bb\n###P", "AB"), /pas de bloc B/);
    assert.throws(() => readLine("c.AA\n..bb\n###P", "A/A"), /2 groupes/);
    assert.throws(() => readLine("c.AA\n....", "A"), /pas de poste/);
  });

  it("stops the whole line at the takt when a lane has no piece, and starts again when a bin comes", () => {
    const setup = { ...LINE_PLANS.petite, shortagesPerHour: 0, blocking: 0 };
    const state = createLine(setup, drawLineDay(1, setup));
    Object.assign(state.lanes[2], { pieces: 0, full: 0 });
    state.t = state.nextTakt;
    takt(state);
    assert.equal(state.produced, 0);
    assert.equal(state.stopped, 1);
    assert.deepEqual(state.stops, { "2:B": 1 });
    bringBin(state, 2);
    assert.equal(state.lanes[2].pieces, setup.binPieces);
    takt(state);
    assert.equal(state.produced, 1);
    assert.equal(state.nextTakt, state.t + setup.takt);
    // Every lane took a piece; a bin emptied sends a request.
    assert.equal(state.lanes[2].pieces, setup.binPieces - 1);
  });

  it("sends a request when a bin empties, the next full bin taking over", () => {
    const setup = { ...LINE_PLANS.petite, shortagesPerHour: 0, blocking: 0 };
    const state = createLine(setup, drawLineDay(1, setup));
    Object.assign(state.lanes[0], { pieces: 1, full: 1 });
    state.t = state.nextTakt;
    takt(state);
    assert.deepEqual(state.lanes[0], { station: 0, ref: "A", pieces: setup.binPieces, full: 0 });
    assert.equal(state.orders.length >= 1, true);
    assert.equal(state.orders[0].block, "A");
    assert.equal(coverOf(state, state.orders[0]), setup.binPieces);
  });

  it("plays an hour under every rule: one robot a cell, every request brought or under way, the same day twice", () => {
    for (const [id, setup] of Object.entries(LINE_PLANS)) {
      for (const [name, rule] of Object.entries(LINE_RULES)) {
        const state = createLine(setup, drawLineDay(2, setup));
        while (!isOver(state)) {
          stepDay(state, rule);
          const cells = state.robots.map((robot) => `${robot.x},${robot.y}`);
          assert.equal(new Set(cells).size, cells.length, `${id}, ${name}, tour ${state.t} : deux robots dans la même case`);
        }
        assert.ok(state.produced <= Math.floor(setup.horizon / setup.takt));
        assert.ok(state.orders.filter((order) => order.status === "open").length <= state.lanes.length, `${id}, ${name} : des demandes oubliées`);
        assert.deepEqual(runLine(setup, 2, rule).measures, runLine(setup, 2, rule).measures);
      }
    }
  });

  it("sees a shortage only at the block, waits there, and every robot knows until the bins are back", () => {
    const setup = { ...LINE_PLANS.sami, shortagesPerHour: 4 };
    const { state } = runLine(setup, shortSeed(setup), LINE_RULES.kanban);
    const seen = state.log.filter((event) => event.type === "short");
    assert.ok(seen.length > 0);
    for (const event of seen) assert.ok(state.day.shortages.some((one) => one.block === event.block && event.t >= one.from && event.t < one.to));
    assert.ok(state.log.some((event) => event.type === "restocked"));
  });

  it("plays a day with the search, the same day twice", () => {
    const setup = { ...LINE_PLANS.seul, horizon: 240 };
    const one = runLine(setup, 1, lineSearchRule({ budget: 12 })).measures;
    assert.deepEqual(runLine(setup, 1, lineSearchRule({ budget: 12 })).measures, one);
    assert.ok(one.produced > 0);
  });
});
