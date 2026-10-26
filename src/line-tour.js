import { closed, keyOf, sameCell } from "./day-basics.js";
import { planLeg } from "./day-legs.js";
import { bringBin } from "./line-day.js";
import { isEmptyAt, takeFromStock } from "./line-supermarket.js";
import { distancesFrom } from "./warehouse.js";

/**
 * A robot's round on the line (Sami, 26/10/2026; docs/recherche/feuille-de-route.md, step 2): pick a full bin, and
 * another while it can carry more (`setup.capacity`, 1 by default: one bin a trip); then the stations, the nearest
 * first, a turn to drop at each; at each, the empty bins waiting there taken back while there is room
 * (`setup.returnEmpties`); then the empties to the return shelf (`r`), a turn to set them down. With one bin a trip and
 * no empties, it is the round of step 1, move for move.
 */
const requestOf = (state, id) => state.orders.find((order) => order.id === id);
const nearestFirst = (state, robot, cells) => {
  const distances = distancesFrom(state.warehouse, robot, closed(state));
  return [...cells].sort((a, b) => (distances.get(keyOf(a)) ?? Infinity) - (distances.get(keyOf(b)) ?? Infinity));
};

/** `robot` off to the nearest of `cells`, the three nearest tried; kept as its target when none is reached now. */
function goTo(state, robot, cells) {
  const sorted = nearestFirst(state, robot, cells);
  if (!sorted.slice(0, 3).some((cell) => planLeg(state, robot, cell))) robot.target = sorted[0];
}

/** Of the bins `robot` carries, the one for the nearest station: the next to drop. */
function nextDrop(state, robot) {
  const distances = distancesFrom(state.warehouse, robot, closed(state));
  const reach = (request) => Math.min(...state.stations[request.station].access.map((cell) => distances.get(keyOf(cell)) ?? Infinity));
  return robot.load.map((id) => requestOf(state, id)).reduce((best, one) => (reach(one) < reach(best) ? one : best));
}

/** `robot` heads for the next station of its round. */
function toNextStation(state, robot) {
  const request = nextDrop(state, robot);
  Object.assign(robot, { phase: "toDrop", order: request.id });
  goTo(state, robot, state.stations[request.station].access);
}

/** The bins picked: the round starts (one more trip). */
export function startDelivery(state, robot) {
  state.trips = (state.trips ?? 0) + 1;
  toNextStation(state, robot);
}

/** A reference short at the supermarket, seen by `robot` come to pick it: it waits there, and every robot knows. */
function seeShort(state, robot, request) {
  if (state.known.short[request.block] === undefined) {
    state.known.short[request.block] = state.t;
    state.seenShortages = (state.seenShortages ?? 0) + 1;
    state.log.push({ t: state.t, type: "short", robot: robot.id, block: request.block });
  }
  robot.until = state.t + 1;
}

/** At the block: a full bin taken (then another, or the round), or the reference short, waited for. */
function picked(state, robot, request) {
  if (isEmptyAt(state, request.block)) return seeShort(state, robot, request);
  if (state.known.short[request.block] !== undefined) {
    delete state.known.short[request.block];
    state.log.push({ t: state.t, type: "restocked", block: request.block });
  }
  request.status = "carried";
  takeFromStock(state, request.block);
  robot.load.push(request.id);
  if (robot.load.length < (state.setup.capacity ?? 1)) Object.assign(robot, { phase: "loading", order: null, target: null });
  else startDelivery(state, robot);
}

/** At a station, the empty bins waiting there taken back, while the robot has room. */
function takeEmpties(state, robot, station) {
  const room = (state.setup.capacity ?? 1) - robot.load.length - robot.empties;
  const taken = Math.min(room, state.empties[station]);
  state.empties[station] -= taken;
  robot.empties += taken;
}

/** A bin dropped: the next station of the round, the empties to the shelf, or the robot free. */
function dropped(state, robot, request) {
  bringBin(state, request.lane);
  Object.assign(request, { status: "delivered", deliveredAt: state.t });
  state.log.push({ t: state.t, type: "delivered", robot: robot.id, order: request.id });
  robot.load = robot.load.filter((id) => id !== request.id);
  if (state.setup.returnEmpties) takeEmpties(state, robot, request.station);
  if (robot.load.length > 0) toNextStation(state, robot);
  else if (robot.empties > 0) {
    Object.assign(robot, { phase: "toReturn", order: null, target: null });
    goTo(state, robot, state.returns);
  } else Object.assign(robot, { phase: "idle", order: null, target: null });
}

/** The empties set down on the return shelf. */
function returned(state, robot) {
  state.returned = (state.returned ?? 0) + robot.empties;
  state.log.push({ t: state.t, type: "returned", robot: robot.id, bins: robot.empties });
  Object.assign(robot, { phase: "idle", empties: 0, target: null });
}

/** Picks, drops and returns that end now. */
export function finishActions(state) {
  for (const robot of state.robots) {
    if (robot.until !== state.t) continue;
    robot.until = null;
    if (robot.phase === "picking") picked(state, robot, requestOf(state, robot.order));
    else if (robot.phase === "dropping") dropped(state, robot, requestOf(state, robot.order));
    else if (robot.phase === "returning") returned(state, robot);
  }
}

/** Robots come to the return shelf: a turn to set the empties down (day-turn.js's `arrive` knows the rest). */
export function arriveAtShelf(state) {
  for (const robot of state.robots) if (robot.phase === "toReturn" && atShelf(state, robot)) Object.assign(robot, { phase: "returning", until: state.t + 1, target: null });
}

/** At its leg's end on the shelf's side (a leg may pass its target, waiting for a turn to park there). */
const atShelf = (state, robot) => Boolean(robot.target) && sameCell(robot, robot.target) && (robot.path?.at(-1)?.t ?? 0) <= state.t;
