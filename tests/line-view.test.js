import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { LINE_PLANS } from "../src/line-plan.js";
import { LINE_RULES } from "../src/line-rules.js";
import { createLine, drawLineDay, isOver, stepDay } from "../src/line.js";
import { cellsOfLine, lanesOf, lineStatus, robotsOfLine } from "../web/line-view.js";

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

  it("tells a stop: the station, the reference missing, the stop so far", () => {
    const setup = LINE_PLANS.etroite;
    const state = createLine(setup, drawLineDay(3, setup));
    while (!isOver(state) && state.stopRun === 0) stepDay(state, LINE_RULES.kanban);
    assert.match(lineStatus(state), /ligne arrêtée : poste \d, il manque [A-F] · arrêt cumulé \d+ s/);
    assert.ok(cellsOfLine(state).some((cell) => cell.kind === "station" && cell.stopped));
    assert.ok(lanesOf(state).some((station) => station.lanes.some((lane) => lane.empty)));
  });
});
