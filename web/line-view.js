import { isBlock } from "../src/warehouse.js";

/**
 * What the page shows of an hour of the assembly line (Sami, 26/10/2026), pure and tested under Node
 * (tests/line-view.test.js): the cells to draw, the line side's lanes, the robots, the hour in one line. The DOM layer
 * (line-board.js, tabs/ligne.js) only draws it.
 */
const PHASES = Object.freeze({ idle: "libre", toPick: "va chercher un bac", picking: "prend le bac", toDrop: "porte le bac", dropping: "pose le bac", home: "rentre" });
const STATUS = Object.freeze({ open: "en attente", assigned: "un robot y va", carried: "en route", delivered: "posé" });
const plural = (count) => (count > 1 ? "s" : "");
export const clock = (state) => {
  const seconds = state.t * state.setup.turnSeconds;
  return `${Math.floor(seconds / 60)} min ${String(seconds % 60).padStart(2, "0")}`;
};
const minutes = (seconds) => (seconds < 60 ? `${seconds} s` : `${Math.floor(seconds / 60)} min ${String(seconds % 60).padStart(2, "0")}`);

/** The lane the line stands still for, or null while it runs. */
export const stoppedLane = (state) => (state.stopRun > 0 ? (state.lanes.find((lane) => lane.pieces === 0) ?? null) : null);

/** Every cell to draw: `{ x, y, kind, … }`, kind floor, block, station, slot, charge, blockable or wall. */
export function cellsOfLine(state) {
  const { drawn } = state;
  const waiting = new Map();
  for (const order of state.orders) if (order.status !== "delivered") waiting.set(order.block, (waiting.get(order.block) ?? 0) + 1);
  const stopped = stoppedLane(state);
  const stationAt = new Map(state.stations.map((station) => [`${station.x},${station.y}`, station]));
  const slotAt = new Map(state.stations.flatMap((station) => station.slots.map((slot) => [`${slot.x},${slot.y}`, station.id])));
  const kindOf = (char, x, y) => {
    const station = stationAt.get(`${x},${y}`);
    if (station) return { kind: "station", id: station.id, stopped: stopped?.station === station.id - 1 };
    if (slotAt.has(`${x},${y}`)) return { kind: "slot", station: slotAt.get(`${x},${y}`) };
    if (isBlock(char)) return { kind: "block", letter: char, pending: waiting.get(char) ?? 0, short: state.known.short[char] !== undefined };
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
export function robotsOfLine(state) {
  return state.robots.map((robot) => {
    const request = state.orders.find((order) => order.id === robot.order);
    const what = request ? ` (bac ${request.block} pour le poste ${request.station + 1})` : "";
    return {
      id: robot.id,
      x: robot.x,
      y: robot.y,
      carrying: request?.status === "carried" ? request.block : null,
      label: `Robot ${robot.id} : ${PHASES[robot.phase] ?? robot.phase}${what}`,
      ahead: robot.target ? (robot.path ?? []).filter((step) => step.t >= state.t) : [],
    };
  });
}

/** The hour in one line. */
export function lineStatus(state) {
  const parts = [`Tour ${state.t} / ${state.setup.horizon} (${clock(state)})`, `${state.produced} véhicule${plural(state.produced)}`];
  const stopped = stoppedLane(state);
  parts.push(stopped ? `ligne arrêtée : poste ${stopped.station + 1}, il manque ${stopped.ref}` : "la ligne avance");
  if (state.stopped > 0) parts.push(`arrêt cumulé ${minutes(state.stopped * state.setup.turnSeconds)}`);
  const short = Object.keys(state.known.short);
  if (short.length) parts.push(`rupture vue : ${short.join(", ")}`);
  parts.push(state.t <= state.known.blockedUntil ? "allée bloquée" : "allées libres");
  return parts.join(" · ");
}
