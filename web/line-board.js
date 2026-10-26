import { CELL, SYMBOLS, cellRect, centreX, centreY, crossOf, letterOf, robotMark, trailOf } from "./board.js";
import { svg } from "./dom.js";
import { cellsOfLine, robotsOfLine } from "./line-view.js";
import { blockageOf } from "./view.js";

/**
 * The board of an hour of the assembly line (Sami, 26/10/2026), drawn from line-view.js with the warehouse's pieces
 * (board.js): the supermarket's blocks (a short reference marked), the stations along the line (red while the line
 * stands still for one), their line side, the robots and their legs.
 */
function stationMarks(cell) {
  const title = cell.stopped ? `Poste ${cell.id} : la ligne est arrêtée, il lui manque une pièce` : `Poste ${cell.id}`;
  return [svg("text", { x: centreX(cell), y: centreY(cell, 4), class: "letter station-id" }, `P${cell.id}`), svg("title", {}, title)];
}

function blockMarks(cell) {
  if (!cell.short) return letterOf(cell);
  return [...letterOf(cell), svg("title", {}, `Référence ${cell.letter} : rupture vue, les robots attendent les bacs`)];
}

/** What a cell shows over its square, in drawing order. */
const MARKS = [
  (cell, blockage) => (cell.kind === "blockable" && blockage.now ? crossOf(cell, blockage) : []),
  (cell) => (cell.kind === "block" ? blockMarks(cell) : []),
  (cell) => (cell.kind === "station" ? stationMarks(cell) : []),
  (cell) => (cell.kind === "charge" ? [svg("text", { x: centreX(cell), y: centreY(cell, 6), class: "symbol" }, SYMBOLS.charge)] : []),
];

/** A cell's square, with the line's own kinds: a station stopped, a block short. */
function square(cell, blockage) {
  const rect = cellRect(cell, blockage);
  if (cell.stopped) rect.classList.add("stopped");
  if (cell.short) rect.classList.add("short");
  return rect;
}

/** The board of `state` (an hour of the line): its plan, then the robots' legs, then the robots. */
export function lineBoard(state) {
  const { drawn } = state;
  const blockage = blockageOf(state);
  const map = svg("svg", { viewBox: `0 0 ${drawn.width * CELL} ${drawn.height * CELL}`, class: "board", role: "img", "aria-label": "La ligne, son supermarché et les robots" });
  for (const cell of cellsOfLine(state)) map.append(square(cell, blockage), ...MARKS.flatMap((marks) => marks(cell, blockage)));
  const robots = robotsOfLine(state);
  map.append(...robots.filter((robot) => robot.ahead.length > 1).map(trailOf), ...robots.map(robotMark));
  return map;
}
