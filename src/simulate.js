import { astar, createReservations } from "mcts-commun/grid.js";
import { createRng } from "mcts-commun/random.js";
import { SIDES, distancesFrom, nearestPickup, readWarehouse } from "./warehouse.js";

/**
 * A day in the warehouse, turn by turn. Robots start at the truck; an idle robot gets an order from the rule,
 * goes to a floor cell beside its block, takes a turn to pick, goes back to the truck, takes a turn to drop.
 * Every leg is a path in space and time (A* of mcts-commun) reserved around the paths already reserved, so
 * robots never meet in a cell nor swap cells; the truck's cell is shared (moves in and out of it are still
 * reserved). A robot that ends a leg off the truck keeps its cell reserved until it leaves.
 *
 * What the day hides (`drawDay`): whether the `~` cells get blocked, and when. A robot sees it only beside
 * them; then every robot knows, and keeps away from them for the blockage's length.
 */
const LEG_HORIZON = 80;

/** What the day hides, drawn from a seed: the blockage, if any (`{ from, to }`, turns). */
export function drawDay(seed, setup) {
  const rng = createRng(seed);
  const blocked = rng.next() < setup.blocking;
  const from = 1 + rng.int(Math.max(1, setup.horizon - setup.duration - 1));
  return { blockage: blocked ? { from, to: from + setup.duration } : null };
}

/** The start of a day: robots at the truck, orders open, nothing known of the blockage. */
export function createDay(setup, day) {
  const warehouse = readWarehouse(setup.text);
  const { dock } = warehouse;
  for (const block of new Set(setup.orders)) if (!warehouse.blocks.get(block)?.length) throw new Error(`commande ${block} : pas de bloc ${block} accessible sur le plan`);
  return {
    warehouse,
    setup,
    day,
    t: 0,
    robots: Array.from({ length: setup.robots }, (_, i) => ({ id: i + 1, x: dock.x, y: dock.y, phase: "idle", order: null, target: null, path: null, until: null, moves: 0, waits: 0 })),
    orders: [...setup.orders].map((block, i) => ({ id: i + 1, block, status: "open", robot: null, deliveredAt: null })),
    known: { blockedUntil: -1, seenAt: null },
    reservations: createReservations({ shared: [dock] }),
    log: [],
    replans: 0,
    stuck: 0,
  };
}

const isDock = (state, cell) => cell.x === state.warehouse.dock.x && cell.y === state.warehouse.dock.y;
const closed = (state) => state.t <= state.known.blockedUntil;
const blockedNow = (state, t) => Boolean(state.day.blockage) && t >= state.day.blockage.from && t < state.day.blockage.to;
const orderOf = (state, robot) => state.orders.find((order) => order.id === robot.order);

/** Plans `robot`'s leg to `target` from now and reserves it; keeps the old leg when no path is found. */
function planLeg(state, robot, target) {
  // A robot already in the blocked stretch when the pallet went down may back out along it.
  const shut = closed(state) && state.warehouse.plan.at(robot.x, robot.y) !== "~";
  const passable = (char) => state.warehouse.floor(char) && !(shut && char === "~");
  const path = astar(state.warehouse.plan, robot, target, { passable, reservations: state.reservations, unit: robot.id, start: state.t, horizon: LEG_HORIZON });
  if (!path) return false;
  state.reservations.release(robot.id);
  state.reservations.reserve(robot.id, path, { stay: true });
  Object.assign(robot, { path, target });
  return true;
}

/** Holds `robot` where it stands, its cell reserved, when no leg can be found. */
function hold(state, robot) {
  const here = [{ x: robot.x, y: robot.y, t: state.t }];
  state.reservations.release(robot.id);
  state.reservations.reserve(robot.id, here, { stay: true });
  robot.path = here;
}

/**
 * A robot beside a `~` cell blocked for the coming move sees it (the pallet is down before anyone moves):
 * every robot knows, and those whose leg crosses one plan again, or hold where they are.
 */
function discover(state) {
  if (!blockedNow(state, state.t + 1) || closed(state)) return;
  const beside = (robot) => SIDES.some(([dx, dy]) => state.warehouse.plan.at(robot.x + dx, robot.y + dy) === "~");
  const seer = state.robots.find(beside);
  if (!seer) return;
  Object.assign(state.known, { blockedUntil: state.t + state.setup.duration, seenAt: state.t });
  state.log.push({ t: state.t, type: "blocked", robot: seer.id });
  for (const robot of state.robots) {
    const ahead = robot.path?.filter((step) => step.t > state.t) ?? [];
    if (robot.target && ahead.some((step) => state.warehouse.plan.at(step.x, step.y) === "~")) {
      state.replans += 1;
      if (!planLeg(state, robot, robot.target)) hold(state, robot);
    }
  }
}

/** Picks and drops that end now: an order carried, then delivered. */
function finishActions(state) {
  for (const robot of state.robots) {
    if (robot.until !== state.t) continue;
    const order = orderOf(state, robot);
    robot.until = null;
    if (robot.phase === "picking") {
      order.status = "carried";
      robot.phase = "toDrop";
      planLeg(state, robot, state.warehouse.dock);
    } else if (robot.phase === "dropping") {
      Object.assign(order, { status: "delivered", deliveredAt: state.t });
      state.log.push({ t: state.t, type: "delivered", robot: robot.id, order: order.id });
      Object.assign(robot, { phase: "idle", order: null, target: null });
    }
  }
}

/** Idle robots get an order from the rule, or go back to the truck when none is left. */
function assign(state, rule) {
  for (const robot of state.robots.filter((one) => one.phase === "idle")) {
    const distances = distancesFrom(state.warehouse, robot, closed(state));
    const reach = (order) => nearestPickup(state.warehouse, order.block, distances)?.steps ?? Infinity;
    const open = state.orders.filter((order) => order.status === "open" && reach(order) < Infinity);
    if (open.length === 0) {
      if (!isDock(state, robot) && planLeg(state, robot, state.warehouse.dock)) robot.phase = "home";
      continue;
    }
    const chosen = rule({ id: robot.id, x: robot.x, y: robot.y }, open, { t: state.t, reach });
    const pickup = chosen && nearestPickup(state.warehouse, chosen.block, distances);
    if (!pickup || !planLeg(state, robot, pickup.cell)) continue;
    Object.assign(chosen, { status: "assigned", robot: robot.id });
    Object.assign(robot, { phase: "toPick", order: chosen.id });
    state.log.push({ t: state.t, type: "assigned", robot: robot.id, order: chosen.id });
  }
}

const positionAt = (path, t) => path.find((step) => step.t === t) ?? path.at(-1);

/** One turn: every robot to its leg's next cell, unless that cell is a blocked `~` it only now runs into. */
function move(state) {
  state.t += 1;
  for (const robot of state.robots) {
    if (!robot.path) continue;
    const next = positionAt(robot.path, state.t);
    const moving = next.x !== robot.x || next.y !== robot.y;
    const inside = state.warehouse.plan.at(robot.x, robot.y) === "~";
    if (moving && !inside && state.warehouse.plan.at(next.x, next.y) === "~" && blockedNow(state, state.t)) {
      state.stuck += 1;
      continue;
    }
    if (moving) robot.moves += 1;
    else if (robot.phase === "toPick" || robot.phase === "toDrop") robot.waits += 1;
    Object.assign(robot, { x: next.x, y: next.y });
  }
}

/** Robots that reached their leg's end: picking, dropping, or back home. */
function arrive(state) {
  for (const robot of state.robots) {
    if (!robot.target || robot.x !== robot.target.x || robot.y !== robot.target.y) continue;
    if (robot.phase === "toPick") Object.assign(robot, { phase: "picking", until: state.t + 1, target: null });
    else if (robot.phase === "toDrop") Object.assign(robot, { phase: "dropping", until: state.t + 1, target: null });
    else if (robot.phase === "home") Object.assign(robot, { phase: "idle", target: null });
  }
}

/** Robots held short of their target (no leg was found) try again. */
function retry(state) {
  for (const robot of state.robots) {
    const end = robot.path?.at(-1);
    const short = robot.target && end && end.t <= state.t && (end.x !== robot.target.x || end.y !== robot.target.y);
    if (short) planLeg(state, robot, robot.target);
  }
}

/** Plays one turn of `state` under `rule`; returns the state. */
export function stepDay(state, rule) {
  discover(state);
  retry(state);
  finishActions(state);
  assign(state, rule);
  move(state);
  arrive(state);
  return state;
}

/** Is the day over: every order delivered, or the horizon reached? */
export const isOver = (state) => state.t >= state.setup.horizon || state.orders.every((order) => order.status === "delivered");

/**
 * The day's measures: orders delivered by the horizon, the turn the last one was (the horizon when some are
 * left: the score a rule should keep low), the mean delivery turn, the robots' moves and waits, the legs
 * planned again after a blockage was seen, and the turns a robot ran into one.
 */
export function measuresOf(state) {
  const delivered = state.orders.filter((order) => order.status === "delivered");
  const all = delivered.length === state.orders.length;
  return {
    orders: state.orders.length,
    delivered: delivered.length,
    finish: all ? Math.max(0, ...delivered.map((order) => order.deliveredAt)) : state.setup.horizon,
    meanDelivery: delivered.length ? delivered.reduce((sum, order) => sum + order.deliveredAt, 0) / delivered.length : state.setup.horizon,
    moves: state.robots.reduce((sum, robot) => sum + robot.moves, 0),
    waits: state.robots.reduce((sum, robot) => sum + robot.waits, 0),
    replans: state.replans,
    stuck: state.stuck,
    blocked: Boolean(state.day.blockage),
    seenAt: state.known.seenAt,
  };
}

/** A whole day of `setup` (plans.js) from `seed` under `rule`: the final state and its measures. */
export function runDay(setup, seed, rule) {
  const state = createDay(setup, drawDay(seed, setup));
  while (!isOver(state)) stepDay(state, rule);
  return { state, measures: measuresOf(state) };
}
