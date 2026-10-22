import { astar, createReservations } from "mcts-commun/grid.js";
import { createRng } from "mcts-commun/random.js";
import { SIDES, distancesFrom, nearestPickup, readWarehouse } from "./warehouse.js";

/**
 * A day in the warehouse, turn by turn. Robots start at a charging point (`c`), or at the truck when the plan
 * has none; an idle robot gets an order from the rule, goes to a floor cell beside its block, takes a turn to
 * pick, goes back to its truck, takes a turn to drop. A robot with nothing to do goes back where it started.
 *
 * Trucks (Sami, 23/10/2026): the orders are split by `/` between the plan's docks, in reading order, and each
 * truck comes at its turn (`setup.trucks`, 0 by default). A dock with a bay (`w` cells) takes its orders on
 * the bay, one pallet a cell, before its truck is there: an order is only taken while its bay has a cell left
 * (claimed when it is taken), and a pallet waiting there is loaded, so delivered, when the truck comes. Once
 * the truck is there, a pallet dropped on the bay is loaded at once. A dock without a bay takes them on the
 * truck's cell, delivered when both the pallet and the truck are there.
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

/** The day's trucks: the orders split by `/`, one group a dock, each truck with its arrival turn. */
function trucksOf(setup, warehouse) {
  const groups = setup.orders.split("/");
  if (groups.length > warehouse.docks.length) throw new Error(`${groups.length} camions pour ${warehouse.docks.length} quai${warehouse.docks.length > 1 ? "s" : ""} (T) sur le plan`);
  return groups.map((blocks, i) => ({ id: i + 1, dock: warehouse.docks[i], at: setup.trucks?.[i] ?? 0, blocks }));
}

/** The start of a day: robots at their charging point (or the truck), orders open, nothing known of the blockage. */
export function createDay(setup, day) {
  const warehouse = readWarehouse(setup.text);
  const { dock, charges } = warehouse;
  const trucks = trucksOf(setup, warehouse);
  for (const block of new Set(setup.orders.replaceAll("/", ""))) if (!warehouse.blocks.get(block)?.length) throw new Error(`commande ${block} : pas de bloc ${block} accessible sur le plan`);
  const homes = Array.from({ length: setup.robots }, (_, i) => (charges.length ? charges[i % charges.length] : dock));
  return {
    warehouse,
    setup,
    day,
    t: 0,
    trucks,
    robots: homes.map((home, i) => ({ id: i + 1, x: home.x, y: home.y, home: { x: home.x, y: home.y }, phase: "idle", order: null, target: null, path: null, until: null, moves: 0, waits: 0 })),
    orders: trucks.flatMap((truck) => [...truck.blocks].map((block) => ({ block, truck: truck.id - 1 }))).map(({ block, truck }, i) => ({ id: i + 1, block, truck, status: "open", robot: null, deliveredAt: null, stagedAt: null, cell: null })),
    claims: new Map(),
    known: { blockedUntil: -1, seenAt: null },
    // Robots may share the truck's cell, and their charging points when there are fewer points than robots.
    reservations: createReservations({ shared: [dock, ...(setup.robots > charges.length ? charges : [])] }),
    log: [],
    replans: 0,
    stuck: 0,
    cursor: null,
  };
}

const isHome = (robot) => robot.x === robot.home.x && robot.y === robot.home.y;
const truckOf = (state, order) => state.trucks[order.truck];
const isThere = (state, truck) => state.t >= truck.at;
const keyOf = (cell) => `${cell.x},${cell.y}`;
/** The free cell of a truck's bay nearest the truck, or null (none left, or no bay). */
const freeBayCell = (state, truck) => truck.dock.bay.find((cell) => !state.claims.has(keyOf(cell))) ?? null;
/** Can an order be taken now: its truck is there, or has no bay, or its bay has a cell left. */
const canTake = (state, order) => {
  const truck = truckOf(state, order);
  return truck.dock.bay.length === 0 || isThere(state, truck) || freeBayCell(state, truck) !== null;
};
function claim(state, order, cell) {
  order.cell = cell;
  state.claims.set(keyOf(cell), order.id);
}
/** Where an order is dropped: its claimed bay cell, a free one, the bay's first, or the truck's cell. */
function dropCellOf(state, order) {
  const truck = truckOf(state, order);
  if (order.cell) return order.cell;
  if (truck.dock.bay.length === 0) return { x: truck.dock.x, y: truck.dock.y };
  const cell = freeBayCell(state, truck) ?? truck.dock.bay[0];
  claim(state, order, cell);
  return cell;
}
function deliver(state, order, t) {
  if (order.cell && state.claims.get(keyOf(order.cell)) === order.id) state.claims.delete(keyOf(order.cell));
  Object.assign(order, { status: "delivered", deliveredAt: t, cell: null });
}
const closed = (state) => state.t <= state.known.blockedUntil;
const blockedNow = (state, t) => Boolean(state.day.blockage) && t >= state.day.blockage.from && t < state.day.blockage.to;
const orderOf = (state, robot) => state.orders.find((order) => order.id === robot.order);

/** Plans `robot`'s leg to `target` from now and reserves it; keeps the old leg when no path is found. */
function planLeg(state, robot, target) {
  // A robot already in the blocked stretch when the pallet went down may back out along it.
  const shut = closed(state) && state.warehouse.plan.at(robot.x, robot.y) !== "~";
  const passable = (char) => state.warehouse.floor(char) && !(shut && char === "~");
  const path = astar(state.warehouse.plan, robot, target, { passable, reservations: state.reservations, unit: robot.id, start: state.t, horizon: LEG_HORIZON, park: true });
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
      // Kept as the target even when no leg is found now (a robot parked on the way): retried every turn.
      const cell = dropCellOf(state, order);
      if (!planLeg(state, robot, cell)) robot.target = cell;
    } else if (robot.phase === "dropping") {
      if (isThere(state, truckOf(state, order))) {
        deliver(state, order, state.t);
        state.log.push({ t: state.t, type: "delivered", robot: robot.id, order: order.id });
      } else {
        Object.assign(order, { status: "staged", stagedAt: state.t });
        state.log.push({ t: state.t, type: "staged", robot: robot.id, order: order.id });
      }
      Object.assign(robot, { phase: "idle", order: null, target: null });
    }
  }
}

/** A truck that has come loads the pallets waiting for it. */
function load(state) {
  for (const order of state.orders) {
    if (order.status !== "staged" || !isThere(state, truckOf(state, order))) continue;
    deliver(state, order, state.t);
    state.log.push({ t: state.t, type: "loaded", order: order.id });
  }
}

/**
 * The next idle robot of this turn that has an order to choose: `{ robot, open, reach }`, or null once every
 * robot has had its turn. An idle robot with no order it can take goes back where it started on the way.
 */
export function nextChoice(state) {
  for (; state.cursor < state.robots.length; state.cursor += 1) {
    const robot = state.robots[state.cursor];
    // A robot on its way back home may still be given an order.
    if (robot.phase !== "idle" && robot.phase !== "home") continue;
    const distances = distancesFrom(state.warehouse, robot, closed(state));
    const reach = (order) => nearestPickup(state.warehouse, order.block, distances)?.steps ?? Infinity;
    const open = state.orders.filter((order) => order.status === "open" && reach(order) < Infinity && canTake(state, order));
    if (open.length > 0) return { robot, open, reach, distances };
    if (robot.phase === "idle" && !isHome(robot) && planLeg(state, robot, robot.home)) robot.phase = "home";
  }
  return null;
}

/** `choice.robot` takes order `id` (when a leg to it is found), and the turn moves to the next robot. */
export function choose(state, choice, id) {
  state.cursor += 1;
  const { robot, distances } = choice;
  const chosen = state.orders.find((order) => order.id === id && order.status === "open");
  if (!chosen) return;
  // The nearest pickup cell a leg reaches: the nearest may hold a robot parked there for good.
  const cells = state.warehouse.blocks.get(chosen.block).filter((cell) => distances.has(`${cell.x},${cell.y}`));
  cells.sort((a, b) => distances.get(`${a.x},${a.y}`) - distances.get(`${b.x},${b.y}`));
  if (!cells.some((cell) => planLeg(state, robot, cell))) return;
  Object.assign(chosen, { status: "assigned", robot: robot.id });
  const truck = truckOf(state, chosen);
  if (truck.dock.bay.length > 0 && !isThere(state, truck)) claim(state, chosen, freeBayCell(state, truck));
  Object.assign(robot, { phase: "toPick", order: chosen.id });
  state.log.push({ t: state.t, type: "assigned", robot: robot.id, order: chosen.id });
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

/** The start of a turn, up to the robots' choices: blockages seen, legs retried, picks and drops ended. */
export function beginTurn(state) {
  discover(state);
  retry(state);
  load(state);
  finishActions(state);
  state.cursor = 0;
}

/** The end of a turn, after the choices: every robot moves, and those arrived start their work. */
export function endTurn(state) {
  move(state);
  arrive(state);
  state.cursor = null;
}

/** What a rule is shown and given: the robot, the open orders, and `{ t, reach, state }` (only the search reads `state`). */
const ask = (state, choice, rule) => rule({ id: choice.robot.id, x: choice.robot.x, y: choice.robot.y }, choice.open, { t: state.t, reach: choice.reach, state })?.id;

/** Plays one turn of `state` under `rule`; returns the state. */
export function stepDay(state, rule) {
  if (state.cursor === null) beginTurn(state);
  for (let choice = nextChoice(state); choice; choice = nextChoice(state)) choose(state, choice, ask(state, choice, rule));
  endTurn(state);
  return state;
}

/** Is the day over: every order delivered, or the horizon reached? */
export const isOver = (state) => state.t >= state.setup.horizon || state.orders.every((order) => order.status === "delivered");

/** Runs the day to its next choice (turns go by while nobody has one): the choice, or null once the day is over. */
export function advance(state) {
  for (;;) {
    if (state.cursor === null) {
      if (isOver(state)) return null;
      beginTurn(state);
    }
    const choice = nextChoice(state);
    if (choice) return choice;
    endTurn(state);
  }
}

/** A copy of `state` the search may play forward: robots, orders, knowledge and reservations copied. */
export function cloneDay(state) {
  return {
    ...state,
    robots: state.robots.map((robot) => ({ ...robot })),
    orders: state.orders.map((order) => ({ ...order })),
    claims: new Map(state.claims),
    known: { ...state.known },
    reservations: state.reservations.clone(),
    log: [],
  };
}

/**
 * The day's measures: orders delivered by the horizon, the turn the last one was (the horizon when some are
 * left: the score a rule should keep low), the mean delivery turn, the robots' moves and waits, the legs
 * planned again after a blockage was seen, and the turns a robot ran into one; the turns trucks waited at
 * their dock for their last pallet (`truckWait`, summed), and the orders ready on a bay before their truck.
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
    truckWait: state.trucks.reduce((sum, truck) => {
      const mine = state.orders.filter((order) => order.truck === truck.id - 1);
      const left = mine.length === 0 ? truck.at : mine.some((order) => order.status !== "delivered") ? state.setup.horizon : Math.max(...mine.map((order) => order.deliveredAt));
      return sum + Math.max(0, left - truck.at);
    }, 0),
    early: state.orders.filter((order) => order.stagedAt !== null && order.stagedAt < truckOf(state, order).at).length,
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
