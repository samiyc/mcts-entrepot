import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { LINE_PLANS } from "../src/line-plan.js";
import { LINE_RULES } from "../src/line-rules.js";
import { createLine, drawLineDay, isOver, stepDay } from "../src/line.js";
import { carsOf, cellsOfLine, lanesOf, lineStatus, restocksOf, robotsOfLine } from "../web/line-view.js";

describe("what the page shows of the line (web/line-view.js)", () => {
  it("draws the stations, their slots, the supermarket's blocks and the robots", () => {
    const setup = LINE_PLANS.sami;
    const state = createLine(setup, drawLineDay(1, setup));
    const cells = cellsOfLine(state);
    assert.equal(cells.length, state.drawn.width * state.drawn.height);
    assert.deepEqual(cells.filter((cell) => cell.kind === "station").map((cell) => cell.id), [1, 2, 3, 4, 5]);
    assert.equal(cells.filter((cell) => cell.kind === "slot").length, 10);
    assert.equal(cells.filter((cell) => cell.kind === "block").length, 24);
    assert.equal(robotsOfLine(state).length, setup.robots);
    assert.deepEqual(lanesOf(state).map((station) => station.lanes.map((lane) => lane.ref).join("")), ["ABG", "CDH", "EI", "FJ", "KL"]);
    assert.match(lineStatus(state), /^Tour 0 \/ 720 \(0 min 00\) · 0 véhicule · la ligne avance/);
  });

  it("puts a vehicle at each station, slides them on through the takt, and holds them while the line stands still", () => {
    const setup = LINE_PLANS.sami;
    const state = createLine(setup, drawLineDay(1, setup));
    const xs = state.stations.map((station) => station.x).sort((a, b) => a - b);
    assert.deepEqual(carsOf(state).map((car) => [car.number, car.x]), xs.map((x, s) => [xs.length - s, x]));
    while (state.t < 5) stepDay(state, LINE_RULES.kanban);
    const [first] = carsOf(state);
    assert.ok(first.x > xs[0] && first.x < xs[1]);
    while (state.produced === 0) stepDay(state, LINE_RULES.kanban);
    assert.deepEqual(carsOf(state).map((car) => [car.number, car.x]), xs.map((x, s) => [xs.length - s + 1, x]));
    const stops = LINE_PLANS.etroite;
    const stopped = createLine(stops, drawLineDay(3, stops));
    while (!isOver(stopped) && stopped.stopRun === 0) stepDay(stopped, LINE_RULES.kanban);
    const held = carsOf(stopped).map((car) => car.x);
    stepDay(stopped, LINE_RULES.kanban);
    if (stopped.stopRun > 0) assert.deepEqual(carsOf(stopped).map((car) => car.x), held);
  });

  it("shows what waits: the supermarket's bins, its orders to the warehouse and where they stand, the bins each station asked for", () => {
    const endless = createLine(LINE_PLANS.sami, drawLineDay(1, LINE_PLANS.sami));
    assert.equal(restocksOf(endless), null);
    assert.ok(cellsOfLine(endless).filter((cell) => cell.kind === "block").every((cell) => cell.stock === null && !cell.ordered));
    const setup = LINE_PLANS.file;
    const state = createLine(setup, drawLineDay(1, setup));
    while (!isOver(state) && state.restocks.length === 0) stepDay(state, LINE_RULES.kanban);
    const [order] = restocksOf(state);
    assert.ok(["attend un préparateur", "en préparation", "en route vers le supermarché"].includes(order.where));
    const blocks = cellsOfLine(state).filter((cell) => cell.kind === "block");
    assert.ok(blocks.every((cell) => cell.bins === setup.supermarket.bins && cell.stock <= cell.bins));
    assert.ok(blocks.some((cell) => cell.letter === order.block && cell.ordered));
    const stations = cellsOfLine(state).filter((cell) => cell.kind === "station");
    const open = state.orders.filter((one) => one.status !== "delivered").length;
    assert.equal(stations.reduce((sum, cell) => sum + cell.asked, 0), open);
    assert.ok(stations.every((cell) => cell.waiting <= cell.asked));
  });

  it("tells a stop: the station, the reference missing, the stop so far", () => {
    const setup = LINE_PLANS.etroite;
    const state = createLine(setup, drawLineDay(3, setup));
    while (!isOver(state) && state.stopRun === 0) stepDay(state, LINE_RULES.kanban);
    assert.match(lineStatus(state), /ligne arrêtée : poste \d, il manque [A-F] · arrêt cumulé \d+ s/);
    assert.ok(cellsOfLine(state).some((cell) => cell.kind === "station" && cell.stopped));
    assert.ok(lanesOf(state).some((station) => station.lanes.some((lane) => lane.empty)));
  });
});
