import { knownModels } from "../src/line-models.js";
import { isBlock } from "../src/warehouse.js";

/**
 * What the page shows of an hour of the assembly line (Sami, 26/10/2026), pure and tested under Node
 * (tests/line-view.test.js): the cells to draw, the line side's lanes, the robots, the hour in one line. The DOM layer
 * (line-board.js, tabs/ligne.js) only draws it.
 */
const PHASES = Object.freeze({ idle: "libre", toPick: "va chercher un bac", picking: "prend le bac", loading: "peut prendre un autre bac", toDrop: "porte ses bacs", dropping: "pose un bac", toReturn: "rapporte les bacs vides", returning: "pose les bacs vides", home: "rentre" });
const STATUS = Object.freeze({ open: "en attente", assigned: "un robot y va", carried: "en route", delivered: "posé" });
const plural = (count) => (count > 1 ? "s" : "");
export const clock = (state) => {
  const seconds = state.t * state.setup.turnSeconds;
  return `${Math.floor(seconds / 60)} min ${String(seconds % 60).padStart(2, "0")}`;
};
const minutes = (seconds) => (seconds < 60 ? `${seconds} s` : `${Math.floor(seconds / 60)} min ${String(seconds % 60).padStart(2, "0")}`);

/** The lane the line stands still for, or null while it runs. */
export const stoppedLane = (state) => (state.stopRun > 0 ? (state.lanes.find((lane) => lane.pieces === 0) ?? null) : null);

/** A block of the supermarket: its letter, the bins asked of it, whether it is out (a shortage seen, its stock empty), its stock. */
function blockView(state, char, waiting) {
  const stock = state.stock?.[char] ?? null;
  return { kind: "block", letter: char, pending: waiting.get(char) ?? 0, short: state.known.short[char] !== undefined || stock === 0, stock };
}

/** Every cell to draw: `{ x, y, kind, … }`, kind floor, block, station, slot, charge, blockable or wall. */
export function cellsOfLine(state) {
  const { drawn } = state;
  const waiting = new Map();
  for (const order of state.orders) if (order.status !== "delivered") waiting.set(order.block, (waiting.get(order.block) ?? 0) + 1);
  const stopped = stoppedLane(state);
  const stationAt = new Map(state.stations.map((station) => [`${station.x},${station.y}`, station]));
  const slotAt = new Map(state.stations.flatMap((station) => station.slots.map((slot) => [`${slot.x},${slot.y}`, station.id])));
  const kindOf = (char, x, y) => {
    if (char === "r") return { kind: "return" };
    const station = stationAt.get(`${x},${y}`);
    if (station) return { kind: "station", id: station.id, stopped: stopped?.station === station.id - 1 };
    if (slotAt.has(`${x},${y}`)) return { kind: "slot", station: slotAt.get(`${x},${y}`) };
    if (isBlock(char)) return blockView(state, char, waiting);
    return { kind: { c: "charge", "~": "blockable", ".": "floor" }[char] ?? "wall" };
  };
  return Array.from({ length: drawn.height }, (_, y) => Array.from({ length: drawn.width }, (__, x) => ({ x, y, ...kindOf(drawn.at(x, y), x, y) }))).flat();
}

/** A lane as shown: the reference, the pieces left in the bin in use, the full bins behind, the request out. */
function laneView(state, lane, i) {
  const out = state.orders.find((order) => order.lane === i && order.status !== "delivered");
  return { ref: lane.ref, pieces: lane.pieces, capacity: state.setup.binPieces, full: lane.full, request: out ? STATUS[out.status] : null, empty: lane.pieces === 0 };
}

/** Each station's lanes. */
export function lanesOf(state) {
  const views = state.lanes.map((lane, i) => ({ station: lane.station, view: laneView(state, lane, i) }));
  return state.stations.map((station, s) => ({ id: station.id, lanes: views.filter((one) => one.station === s).map((one) => one.view) }));
}

/** The robots: where they are, the bin they carry, what they do, the cells left on their leg. */
export const robotsOfLine = (state) => state.robots.map((robot) => robotView(state, robot));

/** What a robot does, in words: its phase, the bin it heads with, the full bins and the empties on its back. */
function robotLabel(robot, request) {
  const what = request ? ` (bac ${request.block} pour le poste ${request.station + 1})` : "";
  const load = robot.load.length > 1 ? `, ${robot.load.length} bacs pleins` : "";
  const empties = robot.empties > 0 ? `, ${robot.empties} vide${plural(robot.empties)}` : "";
  return `Robot ${robot.id} : ${PHASES[robot.phase] ?? robot.phase}${what}${load}${empties}`;
}

function robotView(state, robot) {
  const request = state.orders.find((order) => order.id === robot.order);
  const loaded = robot.load.length > 0 || robot.empties > 0;
  return {
    id: robot.id,
    x: robot.x,
    y: robot.y,
    carrying: loaded ? (request?.block ?? "∅") : null,
    label: robotLabel(robot, request),
    ahead: robot.target ? (robot.path ?? []).filter((step) => step.t >= state.t) : [],
  };
}

/** The driver (step 3), or null: where it is, what it carries, in words. */
export function humanOf(state) {
  const human = state.human;
  if (!human) return null;
  const request = state.orders.find((order) => order.id === human.load);
  const what = request ? `porte un bac ${request.block} pour le poste ${request.station + 1}` : "les mains libres";
  return { x: human.x, y: human.y, carrying: request?.block ?? null, label: `Le cariste (vous) : ${what}, ${human.delivered} bac${plural(human.delivered)} posé${plural(human.delivered)}` };
}

/**
 * The models known to come (a mix of models only): the vehicle being made first, `{ name, first, planned }` each;
 * with resequencing, those beyond the notice are as planned, they may still move.
 */
export const sequenceOf = (state) => knownModels(state).map((model, i) => ({ name: model.name, first: i === 0, planned: Boolean(state.setup.resequence) && i > state.setup.resequence.notice }));

/** The hour in one line. */
export function lineStatus(state) {
  const parts = [`Tour ${state.t} / ${state.setup.horizon} (${clock(state)})`, `${state.produced} véhicule${plural(state.produced)}`];
  const stopped = stoppedLane(state);
  parts.push(stopped ? `ligne arrêtée : poste ${stopped.station + 1}, il manque ${stopped.ref}` : "la ligne avance");
  if (state.stopped > 0) parts.push(`arrêt cumulé ${minutes(state.stopped * state.setup.turnSeconds)}`);
  const short = Object.keys(state.known.short);
  if (short.length) parts.push(`rupture vue : ${short.join(", ")}`);
  const out = state.stock ? Object.keys(state.stock).filter((ref) => state.stock[ref] === 0) : [];
  if (out.length) parts.push(`supermarché vide : ${out.join(", ")} (réappro en route)`);
  parts.push(state.t <= state.known.blockedUntil ? "allée bloquée" : "allées libres");
  const human = humanOf(state);
  if (human) parts.push(human.label);
  return parts.join(" · ");
}
