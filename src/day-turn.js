import { SIDES } from "./warehouse.js";
import { blockedNow, closed, humanLoads, isThere, orderOf, sameCell, truckOf } from "./day-basics.js";
import { aroundPallet, giveWay, planLeg, replanOrHold } from "./day-legs.js";
import { deliver, dropCellOf, release } from "./day-bays.js";
import { callQueues, goDrop, leaveQueue } from "./day-queues.js";
import { handOver, relays } from "./day-relays.js";
import { WAREHOUSE } from "./warehouse-hypotheses.js";

/**
 * What happens in a turn around the robots' choices (simulate.js, split on 26/10/2026): blockages seen, legs
 * retried, relays, picks and drops ended; then every robot moves, and those arrived start their work.
 */

/** The aisle reopened for the coming move, seen by a robot beside it. */
function seeReopened(state) {
  state.known.blockedUntil = state.t;
  state.log.push({ t: state.t, type: "reopened" });
}

/** The aisle blocked for the coming move, seen by `seer`: every robot knows, and those whose leg crosses it plan again, or hold where they are. */
function seeBlocked(state, seer) {
  Object.assign(state.known, { blockedUntil: state.t + state.setup.duration, seenAt: state.t, seen: (state.known.seen ?? 0) + 1 });
  state.log.push({ t: state.t, type: "blocked", robot: seer.id });
  for (const robot of state.robots) {
    const ahead = robot.path?.filter((step) => step.t > state.t) ?? [];
    // With a target, around the aisle; without one (a leg still running), stopped where it is.
    if (ahead.some((step) => state.warehouse.plan.at(step.x, step.y) === "~")) replanOrHold(state, robot);
  }
}

/**
 * A robot beside a `~` cell blocked for the coming move sees it (the pallet is down before anyone moves). Thought
 * closed but open again for the coming move, a robot beside it sees it free (Sami, 80 % blocked: the aisle reopened a
 * turn or two between blockages and nobody used it).
 */
export function discover(state) {
  const beside = (robot) => SIDES.some(([dx, dy]) => state.warehouse.plan.at(robot.x + dx, robot.y + dy) === "~");
  const coming = blockedNow(state, state.t + 1);
  if (closed(state)) {
    if (!coming && state.robots.some(beside)) seeReopened(state);
    return;
  }
  if (!coming) return;
  const seer = state.robots.find(beside);
  if (seer) seeBlocked(state, seer);
}

/** `robot` has picked `order`: off to drop it. A pallet left for a relay: its waiting cell is free again once taken. */
function picked(state, robot, order) {
  if (order.relayed) {
    release(state, order);
    order.relayed = false;
  }
  order.status = "carried";
  robot.phase = "toDrop";
  goDrop(state, robot, dropCellOf(state, order, robot));
}

/** `robot` has dropped `order`: delivered in its truck, or staged on a bay (or at the door, for the dock loaders). */
function dropped(state, robot, order) {
  leaveQueue(state, robot, robot);
  const truck = truckOf(state, order);
  if (isThere(state, truck) && sameCell(robot, truck.dock) && !humanLoads(state, truck)) {
    deliver(state, order, state.t);
    state.log.push({ t: state.t, type: "delivered", robot: robot.id, order: order.id });
  } else {
    Object.assign(order, { status: "staged", stagedAt: state.t });
    if (order.cell) aroundPallet(state, order.cell);
    state.log.push({ t: state.t, type: "staged", robot: robot.id, order: order.id });
  }
  Object.assign(robot, { phase: "idle", order: null, target: null });
}

/** Picks and drops that end now: an order carried, then delivered. */
export function finishActions(state) {
  for (const robot of state.robots) {
    if (robot.until !== state.t) continue;
    const order = orderOf(state, robot);
    robot.until = null;
    if (robot.phase === "picking") picked(state, robot, order);
    else if (robot.phase === "dropping" && robot.relay) handOver(state, robot, order);
    else if (robot.phase === "dropping") dropped(state, robot, order);
  }
}

/** A truck that has come takes the pallets left on its own cell (a dock without a bay; the dock loaders' trucks wait for them). */
export function load(state) {
  for (const order of state.orders) {
    if (order.status !== "staged" || order.cell || !isThere(state, truckOf(state, order)) || humanLoads(state, truckOf(state, order))) continue;
    deliver(state, order, state.t);
    state.log.push({ t: state.t, type: "loaded", order: order.id });
  }
}

/** Is `robot` held short of its target (no leg was found)? */
const heldShort = (state, robot) => {
  const end = robot.path?.at(-1);
  return Boolean(robot.target && end && end.t <= state.t && !sameCell(end, robot.target));
};
/** `robot` held short tries again: its turns held so far, 0 once a leg is found. */
const retryLeg = (state, robot) => {
  if (!heldShort(state, robot)) return 0;
  return planLeg(state, robot, robot.target) ? 0 : (robot.blockedFor ?? 0) + 1;
};

/**
 * Robots held short of their target try again. Two of them nose to nose in a one-cell aisle each see the other
 * parked for good: a relay when one carries a pallet and the other is empty; else the one held longest (the higher
 * number between equals) gives way, to the nearest free cell off the aisle, lets the other pass, and sets off again.
 */
export function retry(state) {
  callQueues(state);
  for (const robot of state.robots) robot.blockedFor = retryLeg(state, robot);
  if (relays(state)) return;
  const stuck = state.robots.filter((robot) => robot.blockedFor >= 2 && !robot.resume).sort((a, b) => b.blockedFor - a.blockedFor || b.id - a.id)[0];
  if (stuck) giveWay(state, stuck);
}

const positionAt = (path, t) => path.find((step) => step.t === t) ?? path.at(-1);
/** Would `robot` step from outside into a `~` cell blocked now (it only now runs into it)? */
const runsInto = (state, robot, next) => state.warehouse.plan.at(robot.x, robot.y) !== "~" && state.warehouse.plan.at(next.x, next.y) === "~" && blockedNow(state, state.t);

function step(state, robot) {
  const next = positionAt(robot.path, state.t);
  const moving = !sameCell(next, robot);
  if (moving && runsInto(state, robot, next)) {
    state.stuck += 1;
    return;
  }
  if (moving) robot.moves += 1;
  else if (robot.phase === "toPick" || robot.phase === "toDrop") robot.waits += 1;
  Object.assign(robot, { x: next.x, y: next.y });
}

/** One turn: every robot to its leg's next cell, unless that cell is a blocked `~` it only now runs into. */
export function move(state) {
  state.t += 1;
  for (const robot of state.robots) if (robot.path) step(state, robot);
}

/** Arrived at the leg's end only: a leg may pass its target, waiting for a turn to park there. */
const hasArrived = (state, robot) => Boolean(robot.target) && sameCell(robot, robot.target) && (robot.path?.at(-1)?.t ?? 0) <= state.t;

/** Does `robot` set its pallet into its truck now (the truck there, the robot at its dock)? */
const intoTruck = (state, robot) => {
  const order = orderOf(state, robot);
  if (!order || robot.relay) return false;
  const truck = truckOf(state, order);
  // The line has no truck: its bins take a turn; a part set down at an assembly station too.
  return Boolean(truck) && !humanLoads(state, truck) && !truck.station && isThere(state, truck) && sameCell(robot, truck.dock);
};

/**
 * At its drop cell: `robot` drops, unless it only waited aside for a truck's turn. Into a truck it takes
 * `setup.loadTurns` (warehouse-hypotheses.js: 90 s), elsewhere a turn: always a turn when the dock loaders load.
 */
function atDrop(state, robot) {
  if (robot.queued && !robot.relay) robot.target = null;
  else Object.assign(robot, { phase: "dropping", until: state.t + (intoTruck(state, robot) ? (state.setup.loadTurns ?? WAREHOUSE.loadTurns) : 1), target: null });
}

/** Robots that reached their leg's end: picking, dropping, or back home. */
export function arrive(state) {
  for (const robot of state.robots) {
    if (!hasArrived(state, robot)) continue;
    // Out of the way for another: back to its own target, retried from next turn.
    if (robot.resume) Object.assign(robot, { target: robot.resume, resume: null });
    else if (robot.phase === "toPick") Object.assign(robot, { phase: "picking", until: state.t + 1, target: null });
    else if (robot.phase === "toDrop") atDrop(state, robot);
    else if (robot.phase === "home") Object.assign(robot, { phase: "idle", target: null });
  }
}
