import { createReservations } from "mcts-commun/grid.js";
import { createRng } from "mcts-commun/random.js";
import { homesOf } from "./day-spots.js";
import { readLine } from "./line-plan.js";
import { drawBlockages } from "./simulate.js";

/**
 * A day of the assembly line (Sami, 26/10/2026; docs/recherche/feuille-de-route.md, step 1): what it hides, its start,
 * the takt, its measures. A station's line side holds, for each of its references, a lane of `bins` bins of
 * `binPieces` pieces: the bin in use (`pieces` left) and the full ones behind it (`full`). At each takt every station
 * takes a piece of each of its references; a bin emptied sends a request for a full one (the kanban). A lane with no
 * piece left at the takt **stops the whole line** until a bin comes. The turn and the choices are in line.js.
 */

/** The references the line uses, once each, in order. */
const refsOf = (setup) => [...new Set(setup.refs.replaceAll("/", ""))];

/**
 * The supplier shortages from turn `start` to the day's end: a reference missing at the supermarket, `shortagesPerHour`
 * times an hour on average, `shortageTurns` long (drawn between its bounds).
 */
export function drawShortages(rng, setup, start) {
  if (!setup.shortagesPerHour || setup.shortagesPerHour <= 0) return [];
  const rate = (setup.shortagesPerHour * setup.turnSeconds) / 3600;
  const refs = refsOf(setup);
  const [shortest, longest] = setup.shortageTurns;
  const shortages = [];
  for (let from = start + Math.round(-Math.log(1 - rng.next()) / rate); from < setup.horizon; from += Math.round(-Math.log(1 - rng.next()) / rate)) {
    shortages.push({ block: refs[rng.int(refs.length)], from, to: from + shortest + rng.int(longest - shortest + 1) });
  }
  return shortages;
}

/** What the day hides, drawn from a seed: the blockages of the `~` aisle, the shortages; and how full each lane starts. */
export function drawLineDay(seed, setup) {
  const rng = createRng(seed);
  const blockages = drawBlockages(rng, setup, 1);
  const shortages = drawShortages(rng, setup, 1);
  const lanes = setup.refs.split("/").reduce((sum, group) => sum + group.length, 0);
  // The line runs already: each bin in use is somewhere between full and nearly empty.
  const stock = Array.from({ length: lanes }, () => 1 + rng.int(setup.binPieces));
  return { blockages, shortages, stock };
}

/** The start of the day: the robots at home, every lane with its spare bins and its bin in use as drawn, nothing known. */
export function createLine(setup, day) {
  const { warehouse, stations, drawn } = readLine(setup.text, setup.refs);
  const homes = homesOf(warehouse, setup.robots);
  const reservations = createReservations();
  homes.forEach((home, i) => reservations.reserve(i + 1, [{ x: home.x, y: home.y, t: 0 }], { stay: true }));
  const lanes = stations.flatMap((station, s) => station.refs.map((ref) => ({ station: s, ref })));
  lanes.forEach((lane, i) => Object.assign(lane, { pieces: day.stock[i] ?? setup.binPieces, full: setup.bins - 1 }));
  return {
    kind: "ligne",
    warehouse,
    stations,
    drawn,
    setup,
    day,
    t: 0,
    trucks: [],
    robots: homes.map((home, i) => ({ id: i + 1, x: home.x, y: home.y, home: { x: home.x, y: home.y }, phase: "idle", order: null, target: null, queued: null, resume: null, blockedFor: 0, path: null, until: null, moves: 0, waits: 0 })),
    orders: [],
    lanes,
    claims: new Map(),
    queues: new Map(),
    known: { blockedUntil: -1, seenAt: null, short: {} },
    reservations,
    log: [],
    replans: 0,
    stuck: 0,
    cursor: null,
    nextTakt: setup.takt,
    produced: 0,
    stopped: 0,
    stopRun: 0,
    longestStop: 0,
    stops: {},
    maxWip: binsOnLine(lanes),
  };
}

/** The bins on the line side: in use, and full behind. */
export const binsOnLine = (lanes) => lanes.reduce((sum, lane) => sum + (lane.pieces > 0 ? 1 : 0) + lane.full, 0);
export const isShortNow = (state, block) => state.day.shortages.some((one) => one.block === block && state.t >= one.from && state.t < one.to);

/** A piece of lane `i` taken: its bin emptied sends a request, and the next full bin comes into use. */
function consume(state, i) {
  const lane = state.lanes[i];
  lane.pieces -= 1;
  if (lane.pieces > 0) return;
  state.orders.push({ id: state.orders.length + 1, block: lane.ref, station: lane.station, lane: i, status: "open", robot: null, at: state.t, deliveredAt: null, cell: null });
  if (lane.full === 0) return;
  lane.full -= 1;
  lane.pieces = state.setup.binPieces;
}

/** The takt: every station takes a piece of each reference, or the line stops while one is missing. */
export function takt(state) {
  const missing = state.lanes.findIndex((lane) => lane.pieces === 0);
  if (missing >= 0) {
    const key = `${state.lanes[missing].station + 1}:${state.lanes[missing].ref}`;
    if (state.stopRun === 0) state.log.push({ t: state.t, type: "stopped", lane: key });
    Object.assign(state, { stopped: state.stopped + 1, stopRun: state.stopRun + 1 });
    state.stops[key] = (state.stops[key] ?? 0) + 1;
    state.longestStop = Math.max(state.longestStop, state.stopRun);
    return;
  }
  state.lanes.forEach((_, i) => consume(state, i));
  Object.assign(state, { produced: state.produced + 1, nextTakt: state.t + state.setup.takt, stopRun: 0 });
}

/** A full bin brought to lane `i`: into use if the line waited for it, else behind the bin in use. */
export function bringBin(state, i) {
  const lane = state.lanes[i];
  if (lane.pieces === 0) lane.pieces = state.setup.binPieces;
  else lane.full += 1;
  state.maxWip = Math.max(state.maxWip, binsOnLine(state.lanes));
}

/**
 * The day's measures: the turns the line stood still (`stopped`, and in seconds), the vehicles made, the longest stop,
 * the stops by station and reference, the most bins on the line side, the requests served and how long they waited,
 * the robots' moves and waits.
 */
export function measuresOfLine(state) {
  const served = state.orders.filter((order) => order.status === "delivered");
  return {
    stopped: state.stopped,
    stoppedSeconds: state.stopped * state.setup.turnSeconds,
    produced: state.produced,
    longestStop: state.longestStop,
    stops: { ...state.stops },
    maxWip: state.maxWip,
    requests: state.orders.length,
    served: served.length,
    meanResponse: served.length ? served.reduce((sum, order) => sum + order.deliveredAt - order.at, 0) / served.length : 0,
    moves: state.robots.reduce((sum, robot) => sum + robot.moves, 0),
    waits: state.robots.reduce((sum, robot) => sum + robot.waits, 0),
    replans: state.replans,
    stuck: state.stuck,
    shortages: state.seenShortages ?? 0,
    blocked: state.day.blockages.length > 0,
  };
}
