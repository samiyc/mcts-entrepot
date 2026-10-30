import { besides, closed, keyOf, orderById, orderOf } from "./day-basics.js";
import { claim, release } from "./day-bays.js";
import { aroundPallet, hold, legToPickup, planLeg } from "./day-legs.js";
import { goDrop, leaveQueues, queueOf } from "./day-queues.js";
import { distancesFrom } from "./warehouse.js";

/**
 * **Relays** (Sami, 23/10: two robots stuck nose to nose in a narrow aisle; simulate.js, split on 26/10/2026). A robot
 * with a pallet stuck in front of an empty one nearer its truck sets the pallet down where it stands, a waiting cell
 * for a moment; it goes back to fetch what the other was to fetch, and the other carries the pallet on: the robot
 * nearest the truck makes the short trips. `setup.relay: false` turns it off.
 */

/** A relay nobody completes in this many turns is called off. */
const RELAY_PATIENCE = 20;
const isEmpty = (state, robot) => robot.until === null && (robot.phase === "idle" || robot.phase === "home" || (robot.phase === "toPick" && orderOf(state, robot)?.status === "assigned"));

/** A robot with a pallet stuck short of its target, or waiting aside for a truck nobody is using (a robot parked on the only way). */
function stuckWithPallet(state, loaded) {
  if (loaded.phase !== "toDrop" || loaded.until !== null || loaded.relay) return false;
  const waiting = loaded.queued && !queueOf(state, loaded.queued).busy && state.t - loaded.queuedAt >= 2;
  return Boolean(loaded.target && loaded.blockedFor >= 2) || Boolean(waiting);
}

/**
 * Where the pallet would wait for `taker`: the loaded robot's own cell when the two touch, else the free floor cell
 * beside the taker nearest the loaded robot (Sami's temporary waiting zone); null when there is none.
 */
function relayCell(state, { loaded, taker, near }, { homes, busy }) {
  if (near.get(keyOf(taker)) === 1) {
    const free = state.warehouse.plan.at(loaded.x, loaded.y) === "." && !state.claims.has(keyOf(loaded)) && !homes.has(keyOf(loaded));
    return free ? { x: loaded.x, y: loaded.y } : null;
  }
  const cells = besides(taker).filter((cell) => state.warehouse.plan.at(cell.x, cell.y) === "." && !busy.has(keyOf(cell)) && near.has(keyOf(cell)));
  cells.sort((a, b) => near.get(keyOf(a)) - near.get(keyOf(b)));
  return cells[0] ?? null;
}

/**
 * Was the relay of `loaded` to `taker` called off less than `RELAY_PATIENCE` turns ago? Then not again so soon: called
 * off, the same pair started again the same turn, the call-off undone (30/10/2026, the quality review).
 */
const calledOff = (state, loaded, taker) => loaded.calledOff?.taker === taker.id && state.t - loaded.calledOff.at < RELAY_PATIENCE;

/** The empty robot nearer the drop cell than `loaded` that would take its pallet, the nearest such to it, with the waiting cell; or null. */
function takerFor(state, loaded, taken) {
  const toDrop = distancesFrom(state.warehouse, loaded.target ?? loaded.queued, closed(state));
  const near = distancesFrom(state.warehouse, loaded, closed(state));
  const mine = toDrop.get(keyOf(loaded)) ?? Infinity;
  const nearer = (other) => other !== loaded && isEmpty(state, other) && (toDrop.get(keyOf(other)) ?? Infinity) < mine && near.has(keyOf(other)) && !calledOff(state, loaded, other);
  const takers = state.robots.filter(nearer).sort((a, b) => near.get(keyOf(a)) - near.get(keyOf(b)));
  for (const taker of takers) {
    const cell = relayCell(state, { loaded, taker, near }, taken);
    if (cell) return { loaded, taker, cell };
  }
  return null;
}

/**
 * A relay to start, or null: a robot with a pallet stuck for two turns (`loaded`) and an empty robot (going to
 * fetch, idle or going home) nearer the pallet's drop cell (`taker`), the nearest such to it; `cell`, where the
 * pallet will wait.
 */
function relayPair(state) {
  if (state.setup.relay === false) return null;
  // Never on a robot's home: it would go back there and sit on the pallet.
  const homes = new Set(state.robots.map((robot) => keyOf(robot.home)));
  const busy = new Set([...state.robots.map(keyOf), ...state.claims.keys(), ...homes]);
  for (const loaded of state.robots) {
    const pair = stuckWithPallet(state, loaded) ? takerFor(state, loaded, { homes, busy }) : null;
    if (pair) return pair;
  }
  return null;
}

/**
 * The relay starts: the loaded robot goes to the waiting cell (or is on it) and sets its pallet down, a turn; the
 * taker waits where it is. False when the loaded robot finds no leg there.
 */
function startRelay(state, { loaded, taker, cell }) {
  const here = loaded.x === cell.x && loaded.y === cell.y;
  const goal = loaded.target ?? loaded.queued;
  if (!here && !planLeg(state, loaded, cell)) return false;
  leaveQueues(state, loaded);
  Object.assign(loaded, { relay: taker.id, relayGoal: goal, resume: null, blockedFor: 0, queued: null });
  if (here) {
    Object.assign(loaded, { phase: "dropping", until: state.t + 1, target: null });
    hold(state, loaded);
  }
  Object.assign(taker, { relayOrder: taker.order, relaySince: state.t, phase: "relay", target: null, resume: null, blockedFor: 0 });
  hold(state, taker);
  state.relays = (state.relays ?? 0) + 1;
  state.log.push({ t: state.t, type: "relay", robot: loaded.id, to: taker.id, order: loaded.order, cell });
  return true;
}

/** `robot` cannot get to `order` from here: the order is open again, the robot idle. */
function giveUp(state, robot, order) {
  release(state, order);
  Object.assign(order, { status: "open", robot: null });
  Object.assign(robot, { phase: "idle", order: null });
}

/** The relay called off, `loaded` still has its pallet: back to where it was to drop it. */
function backToDrop(state, loaded) {
  const goal = loaded.relayGoal;
  Object.assign(loaded, { relay: null, relayGoal: null, target: null });
  goDrop(state, loaded, goal);
}

/** The relay called off, `taker` back to the order it was to fetch (or idle). */
function backToFetch(state, taker) {
  const theirs = orderById(state, taker.relayOrder);
  Object.assign(taker, { phase: theirs ? "toPick" : "idle", order: theirs?.id ?? null, relayOrder: null, relaySince: null });
  if (theirs && !legToPickup(state, taker, theirs)) giveUp(state, taker, theirs);
}

/** A relay nobody completed in time: the loaded robot back to its drop cell, the taker back to what it was doing. */
function callOff(state, taker) {
  const loaded = state.robots.find((one) => one.relay === taker.id);
  if (loaded) loaded.calledOff = { taker: taker.id, at: state.t };
  if (loaded?.phase === "toDrop") backToDrop(state, loaded);
  backToFetch(state, taker);
  state.log.push({ t: state.t, type: "relayOff", robot: loaded?.id ?? null, to: taker.id });
}

/** The pallet is down: the taker goes for it, the robot that set it down goes for what the taker was to fetch. */
export function handOver(state, robot, order) {
  const taker = state.robots.find((one) => one.id === robot.relay);
  leaveQueues(state, robot);
  release(state, order);
  claim(state, order, { x: robot.x, y: robot.y });
  Object.assign(order, { status: "toTruck", robot: taker.id, relayed: true });
  aroundPallet(state, order.cell);
  const theirs = orderById(state, taker.relayOrder);
  Object.assign(robot, { phase: "idle", order: null, target: null, relay: null, relayGoal: null });
  if (theirs) {
    Object.assign(theirs, { robot: robot.id });
    Object.assign(robot, { phase: "toPick", order: theirs.id });
    // No way to it from here: the order is open again.
    if (!legToPickup(state, robot, theirs)) giveUp(state, robot, theirs);
  }
  Object.assign(taker, { phase: "toPick", order: order.id, relayOrder: null, relaySince: null });
  // Kept as its target when the cell is still held: retried every turn until the other has left it.
  if (!planLeg(state, taker, order.cell)) taker.target = order.cell;
}

/**
 * Is the pallet being set down for `taker` now? The hand-over is then next turn: called off meanwhile, the taker went back
 * to its order and took the pallet too, its order left to nobody (30/10/2026, the three docks day 133).
 */
const settingDown = (state, taker) => state.robots.some((one) => one.relay === taker.id && one.phase === "dropping");

/** The relays of this turn: those that took too long called off, then one started if a pair is found (true). */
export function relays(state) {
  for (const robot of state.robots) if (robot.phase === "relay" && state.t - robot.relaySince >= RELAY_PATIENCE && !settingDown(state, robot)) callOff(state, robot);
  const pair = relayPair(state);
  return Boolean(pair) && startRelay(state, pair);
}
