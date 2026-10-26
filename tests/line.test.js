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

describe("the line, step 2: rounds, empty bins, a mix of models", () => {
  it("takes up to `capacity` bins on a round, drops them nearest first, takes the empties back to the shelf", () => {
    const setup = LINE_PLANS.tournee;
    const { state } = runLine(setup, 1, LINE_RULES.nearest);
    assert.ok(state.trips > 0 && state.orders.filter((order) => order.status === "delivered").length > state.trips, "des tournées d'un seul bac");
    assert.ok(state.returned > 0);
    const returned = state.log.filter((event) => event.type === "returned");
    assert.ok(returned.every((event) => event.bins >= 1 && event.bins <= setup.capacity));
    // Every empty bin made is on a line side, on a robot, or back on the shelf.
    const made = state.orders.length;
    const onRobots = state.robots.reduce((sum, robot) => sum + robot.empties, 0);
    assert.equal(state.empties.reduce((sum, count) => sum + count, 0) + onRobots + state.returned, made);
  });

  it("refuses empties to bring back without a shelf", () => {
    const setup = { ...LINE_PLANS.sami, returnEmpties: true };
    assert.throws(() => createLine(setup, drawLineDay(1, setup)), /étagère de retour/);
  });

  it("takes only the references of each vehicle's model, and knows the sequence only so far ahead", async () => {
    const { knownModels, modelAt, usageOf } = await import("../src/line-models.js");
    const setup = { ...LINE_PLANS.melange, shortagesPerHour: 0, blocking: 0 };
    const state = createLine(setup, drawLineDay(1, setup));
    assert.equal(knownModels(state).length, setup.frozen + 1);
    const model = modelAt(state, 0);
    const before = state.lanes.map((lane) => lane.pieces + lane.full * setup.binPieces);
    state.t = state.nextTakt;
    takt(state);
    state.lanes.forEach((lane, i) => {
      const taken = before[i] - (lane.pieces + lane.full * setup.binPieces);
      assert.equal(taken, model.skip.includes(lane.ref) ? 0 : 1, `${lane.ref} pour un véhicule ${model.name}`);
    });
    assert.ok(usageOf(state, "E") < 1 && usageOf(state, "A") === 1);
  });
});

describe("the line, step 3: the driver at the keys (src/line-human.js)", () => {
  it("helps, never shares a cell with a robot, and plays its hour again from its actions", async () => {
    const { helpingDriver, randomDriver } = await import("../src/line-drivers.js");
    const { replayDay } = await import("../src/replay.js");
    const { recording } = await import("../src/replay.js");
    const { measuresOfLine, startLine } = await import("../src/line.js");
    const setup = { ...LINE_PLANS.seul, human: true };
    for (const driver of [helpingDriver, randomDriver(3)]) {
      const state = startLine(setup, 2);
      const choices = [];
      while (!isOver(state)) {
        state.human.next = driver(state);
        stepDay(state, recording(LINE_RULES.nearest, choices));
        assert.ok(!state.robots.some((robot) => robot.x === state.human.x && robot.y === state.human.y), `tour ${state.t} : un robot sur la case du cariste`);
      }
      const { day } = replayDay({ ...setup, humanScript: state.human.actions }, 2, choices, "ligne");
      assert.deepEqual(measuresOfLine(day), measuresOfLine(state));
    }
    const helped = runLine(setup, 2, LINE_RULES.nearest, helpingDriver).measures;
    assert.ok(helped.humanDelivered > 0);
  });
});
