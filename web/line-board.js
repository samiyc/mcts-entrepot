import { CELL, SYMBOLS, cellRect, centreX, centreY, crossOf, letterOf, robotMark, trailOf } from "./board.js";
import { svg } from "./dom.js";
import { carsOf, cellsOfLine, humanOf, robotsOfLine } from "./line-view.js";
import { blockageOf } from "./view.js";

/**
 * The board of an hour of the assembly line (Sami, 26/10/2026), drawn from line-view.js with the warehouse's pieces
 * (board.js): the supermarket's blocks (a short reference marked), the stations along the line (red while the line
 * stands still for one), their line side, the robots and their legs; under the stations, a row of its own, the
 * conveyor and its vehicles (29/10/2026).
 */
function stationMarks(cell) {
  const title = cell.stopped ? `Poste ${cell.id} : la ligne est arrêtée, il lui manque une pièce` : `Poste ${cell.id}`;
  return [svg("text", { x: centreX(cell), y: centreY(cell, 4), class: "letter station-id" }, `P${cell.id}`), svg("title", {}, title)];
}

function blockMarks(cell) {
  const plural = cell.stock > 1 ? "s" : "";
  const stock = cell.stock === null ? "" : ` · ${cell.stock} bac${plural} au supermarché`;
  const title = cell.short ? `Référence ${cell.letter} : plus de bac, les robots attendent${stock}` : `Référence ${cell.letter} du supermarché${stock}`;
  return [...letterOf(cell), svg("title", {}, title)];
}

/** What a cell shows over its square, in drawing order. */
const MARKS = [
  (cell, blockage) => (cell.kind === "blockable" && blockage.now ? crossOf(cell, blockage) : []),
  (cell) => (cell.kind === "block" ? blockMarks(cell) : []),
  (cell) => (cell.kind === "station" ? stationMarks(cell) : []),
  (cell) => (cell.kind === "return" ? [svg("title", {}, "Étagère de retour : les bacs vides y repartent")] : []),
  (cell) => (cell.kind === "charge" ? [svg("text", { x: centreX(cell), y: centreY(cell, 6), class: "symbol" }, SYMBOLS.charge)] : []),
];

/** A cell's square, with the line's own kinds: a station stopped, the supermarket's shelves, one short. */
function square(cell, blockage) {
  const rect = cellRect(cell, blockage);
  if (cell.kind === "block") rect.classList.add("shelf");
  if (cell.stopped) rect.classList.add("stopped");
  if (cell.short) rect.classList.add("short");
  return rect;
}

/** A vehicle on the conveyor, its model's colour with a mix of models. */
function carMark(car, y) {
  const model = car.model ?? "";
  const group = svg("g", { class: `car ${model}`.trim(), transform: `translate(${car.x * CELL + CELL / 2} ${y * CELL + CELL / 2})` });
  const title = model ? `Véhicule ${car.number} (${model})` : `Véhicule ${car.number}`;
  group.append(svg("title", {}, title), svg("rect", { x: -CELL / 2 + 3, y: -CELL / 2 + 5, width: CELL - 6, height: CELL - 10, rx: 5 }), svg("text", { y: 5, class: "symbol" }, "🚗"));
  return group;
}

/** The conveyor under the stations (row `y`), red while the line stands still, and its vehicles. */
function conveyor(state, y) {
  const band = svg("g", { class: `conveyor${state.stopRun > 0 ? " stopped" : ""}` });
  band.append(svg("title", {}, "La ligne : chaque véhicule avance d'un poste à chaque takt (55 s)"), svg("rect", { x: 0, y: y * CELL + 8, width: state.drawn.width * CELL, height: CELL - 16, rx: 4 }));
  return [band, ...carsOf(state).map((car) => carMark(car, y))];
}

/** The driver (step 3): a square badge, the bin it carries on its corner. */
function humanMark(human) {
  const group = svg("g", { class: "human", transform: `translate(${centreX(human)} ${centreY(human)})` });
  group.append(svg("title", {}, human.label), svg("rect", { x: -CELL / 2 + 5, y: -CELL / 2 + 5, width: CELL - 10, height: CELL - 10, rx: 6 }), svg("text", { y: 4, class: "robot-id" }, "C"));
  if (human.carrying) group.append(svg("rect", { x: 4, y: -CELL / 2 + 2, width: 10, height: 10, rx: 2, class: "parcel" }));
  return group;
}

/** The board of `state` (an hour of the line): its plan and conveyor, then the robots' legs, then the robots and the driver. */
export function lineBoard(state) {
  const { drawn } = state;
  const blockage = blockageOf(state);
  const map = svg("svg", { viewBox: `0 0 ${drawn.width * CELL} ${(drawn.height + 1) * CELL}`, class: "board line-board", role: "img", "aria-label": "La ligne, son supermarché et les robots" });
  for (const cell of cellsOfLine(state)) map.append(square(cell, blockage), ...MARKS.flatMap((marks) => marks(cell, blockage)));
  map.append(...conveyor(state, drawn.height));
  const robots = robotsOfLine(state);
  map.append(...robots.filter((robot) => robot.ahead.length > 1).map(trailOf), ...robots.map(robotMark));
  const human = humanOf(state);
  if (human) map.append(humanMark(human));
  return map;
}
