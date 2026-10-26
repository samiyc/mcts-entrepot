import { svg } from "./dom.js";
import { blockageOf, cellsOf, robotsOf } from "./view.js";

/** The board of a day, drawn from view.js (app.js, split on 26/10/2026): the cells and their marks, the robots and their legs. */
const CELL = 34;
const SYMBOLS = Object.freeze({ charge: "⚡", truck: "🚚" });
const centreX = (cell) => cell.x * CELL + CELL / 2;
const centreY = (cell, dy = 0) => cell.y * CELL + CELL / 2 + dy;

function cellRect(cell, blockage) {
  const seen = blockage.seen ? " seen" : "";
  const kind = cell.kind === "blockable" && blockage.now ? `blockable blocked${seen}` : cell.kind;
  const done = cell.kind === "block" && cell.pending === 0 ? " done" : "";
  return svg("rect", { x: cell.x * CELL + 1, y: cell.y * CELL + 1, width: CELL - 2, height: CELL - 2, rx: 4, class: `cell ${kind}${done}` });
}

/** A blocked `~`: a cross, faint while the robots do not know yet. */
function crossOf(cell, blockage) {
  const seen = blockage.seen ? " seen" : "";
  const title = blockage.seen ? "Allée bloquée : les robots le savent" : "Allée bloquée : aucun robot ne l'a encore vue";
  return [svg("text", { x: centreX(cell), y: centreY(cell, 6), class: `symbol cross${seen}` }, "❌"), svg("title", {}, title)];
}

function letterOf(cell) {
  const text = cell.pending > 1 ? `${cell.letter}×${cell.pending}` : cell.letter;
  return [svg("text", { x: centreX(cell), y: centreY(cell, 5), class: "letter" }, text)];
}

function truckTitle(truck, gone) {
  if (gone) return `Camion ${truck.id} : chargé, parti`;
  if (!truck.there) return `Camion ${truck.id} : attendu au tour ${truck.at}`;
  const plural = truck.left > 1 ? "s" : "";
  return `Camion ${truck.id} : à quai, ${truck.left} commande${plural} à charger`;
}

function dockText(truck, there, gone) {
  if (gone) return "parti";
  return there ? SYMBOLS.truck : String(truck.at);
}

function dockMarks(cell) {
  const { truck } = cell;
  const there = !truck || (truck.there && truck.left > 0);
  const gone = truck && truck.left === 0 && truck.there;
  const marks = [svg("text", { x: centreX(cell), y: centreY(cell, there ? 7 : 4), class: `letter dock-letter${there ? " truck" : " due"}` }, dockText(truck, there, gone))];
  if (truck) marks.push(svg("title", {}, truckTitle(truck, gone)));
  return marks;
}

function homeMarks(cell) {
  return [
    svg("circle", { cx: centreX(cell), cy: centreY(cell), r: CELL / 2 - 6, class: "home" }),
    svg("text", { x: centreX(cell), y: centreY(cell, 4), class: "home-id" }, String(cell.home)),
    svg("title", {}, `Départ du robot ${cell.home} : il part d'ici et y revient (pas de borne « c » pour lui)`),
  ];
}

function palletMarks(cell) {
  const relay = cell.kind === "floor" ? " relay" : "";
  return [svg("rect", { x: cell.x * CELL + 7, y: cell.y * CELL + 7, width: CELL - 14, height: CELL - 14, rx: 3, class: `parcel${relay}` }), svg("text", { x: centreX(cell), y: centreY(cell, 4), class: "letter pallet" }, cell.pallet)];
}

/** What a cell shows over its square, in drawing order. */
const MARKS = [
  (cell, blockage) => (cell.kind === "blockable" && blockage.now ? crossOf(cell, blockage) : []),
  (cell) => (cell.kind === "block" ? letterOf(cell) : []),
  (cell) => (cell.kind === "dock" ? dockMarks(cell) : []),
  (cell) => (cell.home ? homeMarks(cell) : []),
  (cell) => (cell.kind === "charge" ? [svg("text", { x: centreX(cell), y: centreY(cell, 6), class: "symbol" }, SYMBOLS.charge)] : []),
  (cell) => (cell.pallet ? palletMarks(cell) : []),
];

function robotMark(robot) {
  const group = svg("g", { class: `robot r${robot.id}`, transform: `translate(${centreX(robot)} ${centreY(robot)})` });
  group.append(svg("title", {}, robot.label), svg("circle", { r: CELL / 2 - 5 }), svg("text", { y: 4, class: "robot-id" }, String(robot.id)));
  if (robot.carrying) group.append(svg("rect", { x: 4, y: -CELL / 2 + 2, width: 10, height: 10, rx: 2, class: "parcel" }));
  return group;
}

const trailOf = (robot) => svg("polyline", { points: robot.ahead.map((step) => `${centreX(step)},${centreY(step)}`).join(" "), class: `trail r${robot.id}` });

/** The board of `day`: its plan, then the robots' legs, then the robots. */
export function board(day) {
  const { plan } = day.warehouse;
  const blockage = blockageOf(day);
  const map = svg("svg", { viewBox: `0 0 ${plan.width * CELL} ${plan.height * CELL}`, class: "board", role: "img", "aria-label": "Le plan de l'entrepôt et les robots" });
  for (const cell of cellsOf(day)) map.append(cellRect(cell, blockage), ...MARKS.flatMap((marks) => marks(cell, blockage)));
  const robots = robotsOf(day);
  map.append(...robots.filter((robot) => robot.ahead.length > 1).map(trailOf), ...robots.map(robotMark));
  return map;
}
