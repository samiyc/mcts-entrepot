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
 * (claimed when it is taken). The bay only keeps the pallet waiting (Sami, 23/10): once the truck is there, a
 * robot still has to take it from the bay into the truck (a "load", offered to idle robots before the orders
 * to fetch), and an order picked while the truck is there goes straight into it. A pallet is delivered when a
 * robot drops it on the truck's cell with the truck there; the truck leaves with its last pallet, and the
 * measure is how long trucks stay at the dock. A dock without a bay takes the pallets on the truck's cell,
 * delivered when both the pallet and the truck are there.
 * Every leg is a path in space and time (A* of mcts-commun) reserved around the paths already reserved, so
 * robots never meet in a cell nor swap cells. No cell is shared (Sami, 23/10, evening): one robot at a time on
 * a truck's cell or a charging point; robots without a charging point of their own start on the free floor
 * nearest the first dock. A robot that ends a leg keeps its cell reserved until it leaves. A truck's cell
 * takes robots one at a time, in the order they come: the others wait aside, on a cell whose loss cuts no aisle,
 * as do idle robots that cannot go home.
 *
 * **One loader a truck** (Sami, 23/10, evening), against jams in front of the docks: once a truck is there, the
 * first robot to take a pallet from its bay becomes its loader, and only it goes into that truck. The other
 * robots drop their pallets on the bay (on the truck only when the bay is full). The loader takes the bay's
 * pallets first, then its own truck's orders, carried straight in; with nothing to do it waits off the bay. It
 * is free again once its truck has left. A robot passes under a pallet waiting on a bay, but not with one on
 * its back: two pallets never share a cell, so the bay is loaded from the truck's side first.
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
  return groups.map((blocks, i) => ({ id: i + 1, dock: warehouse.docks[i], at: setup.trucks?.[i] ?? 0, blocks, loader: null }));
}

/**
 * Where the robots start and go back to: a charging point each, then (fewer points than robots, or none) the
 * free floor nearest the first dock, off the docks, the bays and the cells beside a block when it can.
 */
function homesOf(warehouse, robots) {
  const homes = warehouse.charges.slice(0, robots);
  const taken = new Set(homes.map(keyOf));
  const { docking } = spotsOf(warehouse);
  const aside = new Set(spotsOf(warehouse).aside);
  const { pickups } = spotsOf(warehouse);
  const near = [...distancesFrom(warehouse, warehouse.dock)].sort((a, b) => a[1] - b[1]).map(([key]) => key);
  for (const avoid of [(key) => !aside.has(key) || pickups.has(key), (key) => !aside.has(key), (key) => docking.has(key), () => false]) {
    for (const key of near) {
      if (homes.length >= robots) break;
      if (taken.has(key) || avoid(key)) continue;
      const [x, y] = key.split(",").map(Number);
      homes.push({ x, y });
      taken.add(key);
    }
  }
  if (homes.length < robots) throw new Error(`pas assez de place pour ${robots} robots`);
  return homes;
}

const spots = new WeakMap();
/**
 * The warehouse's cells by use, computed once: `docking` (the docks, their bays and the cells beside a dock),
 * `pickups` (beside a block), and `aside`, where a robot may wait without blocking anyone: floor off the docks,
 * not a `~`, whose loss leaves every other floor cell connected (no aisle of one cell); the cells off the
 * pickups first (`rank` 0), then the pickup cells (1).
 */
function spotsOf(warehouse) {
  if (spots.has(warehouse)) return spots.get(warehouse);
  const { plan } = warehouse;
  const docking = new Set(warehouse.docks.flatMap((one) => [keyOf(one), ...one.bay.map(keyOf), ...SIDES.map(([dx, dy]) => `${one.x + dx},${one.y + dy}`)]));
  const pickups = new Set([...warehouse.blocks.values()].flat().map(keyOf));
  const floor = [...distancesFrom(warehouse, warehouse.dock).keys()];
  const connectedWithout = (cut) => {
    const start = floor.find((key) => key !== cut);
    const seen = new Set([start, cut]);
    const queue = [start];
    for (let i = 0; i < queue.length; i += 1) {
      const [x, y] = queue[i].split(",").map(Number);
      for (const [dx, dy] of SIDES) {
        const key = `${x + dx},${y + dy}`;
        if (seen.has(key) || !warehouse.floor(plan.at(x + dx, y + dy))) continue;
        seen.add(key);
        queue.push(key);
      }
    }
    return seen.size === floor.length;
  };
  const pockets = floor.filter((key) => {
    const [x, y] = key.split(",").map(Number);
    return !docking.has(key) && plan.at(x, y) !== "~" && connectedWithout(key);
  });
  // Off the pickups first; in a narrow warehouse, a pickup cell in a side pocket will do.
  const aside = [...pockets.filter((key) => !pickups.has(key)), ...pockets.filter((key) => pickups.has(key))];
  const found = { docking, pickups, aside, rank: new Map(aside.map((key) => [key, pickups.has(key) ? 1 : 0])) };
  spots.set(warehouse, found);
  return found;
}

/** The start of a day: robots at their charging point (or near the first dock), orders open, nothing known of the blockage. */
export function createDay(setup, day) {
  const warehouse = readWarehouse(setup.text);
  const trucks = trucksOf(setup, warehouse);
  for (const block of new Set(setup.orders.replaceAll("/", ""))) if (!warehouse.blocks.get(block)?.length) throw new Error(`commande ${block} : pas de bloc ${block} accessible sur le plan`);
  const homes = homesOf(warehouse, setup.robots);
  // Every robot holds its starting cell: nobody plans through a robot standing still.
  const reservations = createReservations();
  homes.forEach((home, i) => reservations.reserve(i + 1, [{ x: home.x, y: home.y, t: 0 }], { stay: true }));
  return {
    warehouse,
    setup,
    day,
    t: 0,
    trucks,
    robots: homes.map((home, i) => ({ id: i + 1, x: home.x, y: home.y, home: { x: home.x, y: home.y }, phase: "idle", order: null, target: null, queued: null, path: null, until: null, moves: 0, waits: 0 })),
    orders: trucks.flatMap((truck) => [...truck.blocks].map((block) => ({ block, truck: truck.id - 1 }))).map(({ block, truck }, i) => ({ id: i + 1, block, truck, status: "open", robot: null, deliveredAt: null, stagedAt: null, cell: null })),
    claims: new Map(),
    // One robot at a time goes into a truck's cell: the others wait their turn aside, in order.
    queues: new Map(),
    known: { blockedUntil: -1, seenAt: null },
    // No cell is shared: one robot a cell, the trucks' cells too.
    reservations,
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
function release(state, order) {
  if (order.cell && state.claims.get(keyOf(order.cell)) === order.id) state.claims.delete(keyOf(order.cell));
  order.cell = null;
}
/** Has every pallet of `truck` gone in (the truck has left)? */
const truckDone = (state, truck) => state.orders.every((order) => order.truck !== truck.id - 1 || order.status === "delivered");
/** Is `robot` the one that may go into `truck`: its loader, or anyone while it has none (or no bay)? */
const mayLoad = (state, truck, robot) => truck.dock.bay.length === 0 || !truck.loader || truck.loader === robot.id || truckDone(state, truck);
/**
 * Where `robot` drops an order: into the truck when it is there and the robot is its loader (or it has no bay),
 * else on the bay, its claimed cell, a free one, or the bay's first; a robot that is not the loader finding the
 * bay full goes into the truck.
 */
function dropCellOf(state, order, robot) {
  const truck = truckOf(state, order);
  const into = () => {
    release(state, order);
    return { x: truck.dock.x, y: truck.dock.y };
  };
  if (truck.dock.bay.length === 0) return into();
  if (isThere(state, truck)) {
    if (order.status === "toTruck" || truck.loader === robot.id) return into();
    if (!order.cell) {
      // The truck there, the bay is a stack the loader empties from the truck's side: drop at its far end, never
      // on the cell at the truck's door, so the loader's way in stays open.
      const free = [...truck.dock.bay].reverse().find((cell, i, cells) => i < cells.length - 1 && !state.claims.has(keyOf(cell)));
      if (!free) {
        // The bay is full: this pallet goes into the truck anyway.
        state.log.push({ t: state.t, type: "overflow", robot: robot.id, truck: truck.id });
        return into();
      }
      claim(state, order, free);
    }
    return order.cell;
  }
  if (order.cell) return order.cell;
  const cell = freeBayCell(state, truck) ?? truck.dock.bay[0];
  claim(state, order, cell);
  return cell;
}
function deliver(state, order, t) {
  release(state, order);
  Object.assign(order, { status: "delivered", deliveredAt: t });
}
const closed = (state) => state.t <= state.known.blockedUntil;
const blockedNow = (state, t) => Boolean(state.day.blockage) && t >= state.day.blockage.from && t < state.day.blockage.to;
const orderOf = (state, robot) => state.orders.find((order) => order.id === robot.order);

/** The cells holding a pallet: waiting on a bay, or about to be taken from it. */
const palletCells = (state) => new Set(state.orders.filter((order) => order.cell && (order.status === "staged" || order.status === "toTruck")).map((order) => keyOf(order.cell)));

/** Can the pallet of `order`, on its bay, be carried into its truck without going through another pallet? */
function clearToTruck(state, order) {
  const { dock } = truckOf(state, order);
  // The cells promised to other pallets count too: one is on its way there.
  const pallets = new Set(state.orders.filter((other) => other.cell && other !== order).map((other) => keyOf(other.cell)));
  const seen = new Set([keyOf(order.cell)]);
  const queue = [order.cell];
  for (let i = 0; i < queue.length; i += 1) {
    const cell = queue[i];
    if (cell.x === dock.x && cell.y === dock.y) return true;
    for (const [dx, dy] of SIDES) {
      const next = { x: cell.x + dx, y: cell.y + dy };
      const key = keyOf(next);
      if (seen.has(key) || pallets.has(key) || !state.warehouse.floor(state.warehouse.plan.at(next.x, next.y))) continue;
      seen.add(key);
      queue.push(next);
    }
  }
  return false;
}

/** Plans `robot`'s leg to `target` from now and reserves it; keeps the old leg when no path is found. */
function planLeg(state, robot, target) {
  // A robot already in the blocked stretch when the pallet went down may back out along it.
  const shut = closed(state) && state.warehouse.plan.at(robot.x, robot.y) !== "~";
  // A robot passes under a pallet waiting on a bay, but not with one on its back (Sami, 23/10): two pallets never share a cell.
  const pallets = robot.phase === "toDrop" ? palletCells(state) : null;
  const passable = (char, x, y) => state.warehouse.floor(char) && !(shut && char === "~") && !(pallets?.has(`${x},${y}`) && (x !== target.x || y !== target.y));
  // Someone parks on the target for good, or is due there past the horizon: no leg can end there, no need to search.
  if (!state.reservations.freeFrom(target.x, target.y, state.t + LEG_HORIZON, robot.id)) return false;
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
      goDrop(state, robot, dropCellOf(state, order, robot));
    } else if (robot.phase === "dropping") {
      leaveQueue(state, robot, robot);
      const truck = truckOf(state, order);
      if (isThere(state, truck) && robot.x === truck.dock.x && robot.y === truck.dock.y) {
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

/** A truck that has come takes the pallets left on its own cell (a dock without a bay). */
function load(state) {
  for (const order of state.orders) {
    if (order.status !== "staged" || order.cell || !isThere(state, truckOf(state, order))) continue;
    deliver(state, order, state.t);
    state.log.push({ t: state.t, type: "loaded", order: order.id });
  }
}

/**
 * The next idle robot of this turn that has an order to choose: `{ robot, open, reach }`, or null once every
 * robot has had its turn. `open` lists first the pallets on a bay whose truck is there (to load), then the
 * orders to fetch; `reach` is the distance to the pallet, or to the block. An idle robot with nothing it can
 * take goes back where it started on the way.
 */
export function nextChoice(state) {
  for (; state.cursor < state.robots.length; state.cursor += 1) {
    const robot = state.robots[state.cursor];
    // A robot on its way back home may still be given an order.
    if (robot.phase !== "idle" && robot.phase !== "home") continue;
    const distances = distancesFrom(state.warehouse, robot, closed(state));
    const reach = (order) => (order.status === "staged" ? (distances.get(keyOf(order.cell)) ?? Infinity) : (nearestPickup(state.warehouse, order.block, distances)?.steps ?? Infinity));
    const loads = state.orders.filter((order) => order.status === "staged" && order.cell && isThere(state, truckOf(state, order)) && reach(order) < Infinity && mayLoad(state, truckOf(state, order), robot) && clearToTruck(state, order));
    const fetches = state.orders.filter((order) => order.status === "open" && reach(order) < Infinity && canTake(state, order));
    // A truck's loader keeps to it: its bay's pallets, then its orders, else it waits off the bay.
    const loading = state.trucks.find((truck) => truck.loader === robot.id && !truckDone(state, truck));
    if (loading) {
      const mine = [...loads, ...fetches].filter((order) => truckOf(state, order) === loading);
      if (mine.length > 0) return { robot, open: mine, reach, distances };
      standBy(state, robot);
      continue;
    }
    const open = [...loads, ...fetches];
    if (open.length > 0) return { robot, open, reach, distances };
    if (robot.phase === "idle" && !isHome(robot)) {
      if (planLeg(state, robot, robot.home)) robot.phase = "home";
      else standBy(state, robot);
    }
  }
  return null;
}

/** A loader with nothing to do: off the docks, the bays and the cells beside a block, to the nearest free cell. */
function standBy(state, robot) {
  const { docking, pickups } = spotsOf(state.warehouse);
  if (robot.target || (!docking.has(keyOf(robot)) && !pickups.has(keyOf(robot)))) return;
  goAside(state, robot, robot);
}

/** `robot` to the free aside cell nearest `near` (a dock it waits for, or where it stands); false when none is reached. */
function goAside(state, robot, near) {
  const taken = new Set(state.robots.filter((other) => other !== robot).flatMap((other) => [keyOf(other), ...(other.target ? [keyOf(other.target)] : [])]));
  const reach = distancesFrom(state.warehouse, robot, closed(state));
  const from = distancesFrom(state.warehouse, near, closed(state));
  const { aside, rank } = spotsOf(state.warehouse);
  const cells = aside.filter((key) => !taken.has(key) && reach.has(key)).sort((a, b) => rank.get(a) - rank.get(b) || (from.get(a) ?? Infinity) - (from.get(b) ?? Infinity));
  for (const key of cells.slice(0, 6)) {
    const [x, y] = key.split(",").map(Number);
    if (key === keyOf(robot) || planLeg(state, robot, { x, y })) return true;
  }
  return false;
}

const isDock = (state, cell) => state.warehouse.docks.some((one) => one.x === cell.x && one.y === cell.y);

/** The robots of a truck's queue: the one going there or dropping (`busy`), and those waiting, in order. */
function queueOf(state, cell) {
  const members = (state.queues.get(keyOf(cell)) ?? []).map((id) => state.robots.find((one) => one.id === id));
  const busy = members.find((robot) => robot.phase === "dropping" || (robot.phase === "toDrop" && !robot.queued)) ?? null;
  return { members, busy };
}

/** `robot` waits its turn for `cell` (a truck's), aside. */
function wait(state, robot, cell) {
  robot.queued = cell;
  if (!goAside(state, robot, cell)) hold(state, robot);
}

/**
 * `robot` sets off to drop at `cell`. A truck's cell takes one robot at a time: it joins the cell's queue and,
 * while another goes there, waits aside (`robot.queued`, the cell it waits for). The target is kept when no
 * leg is found now (a robot parked on the way): retried every turn.
 */
function goDrop(state, robot, cell) {
  if (isDock(state, cell)) {
    const queue = state.queues.get(keyOf(cell)) ?? [];
    if (!queue.includes(robot.id)) queue.push(robot.id);
    state.queues.set(keyOf(cell), queue);
    const { busy } = queueOf(state, cell);
    if (busy && busy !== robot) {
      wait(state, robot, cell);
      return;
    }
  }
  robot.queued = null;
  if (!planLeg(state, robot, cell)) robot.target = cell;
}

/**
 * Each truck's turn: the robot going there keeps it while its leg reaches the truck. Otherwise the first in
 * the queue a leg takes there goes (in a narrow aisle, the one stuck behind gives way), and the others wait.
 */
function callQueues(state) {
  for (const [key, queue] of state.queues) {
    const [x, y] = key.split(",").map(Number);
    const cell = { x, y };
    const { members, busy } = queueOf(state, cell);
    if (busy?.phase === "dropping") continue;
    const end = busy?.path?.at(-1);
    if (busy && end && end.x === x && end.y === y) continue;
    const next = members.find((robot) => robot.phase === "toDrop" && robot.until === null && planLeg(state, robot, cell));
    if (!next) continue;
    next.queued = null;
    state.queues.set(key, [next.id, ...queue.filter((id) => id !== next.id)]);
    if (busy && busy !== next) wait(state, busy, cell);
  }
}

/** `robot` is done with `cell` (a truck's): out of its queue. */
function leaveQueue(state, robot, cell) {
  const queue = state.queues.get(keyOf(cell));
  if (queue) state.queues.set(keyOf(cell), queue.filter((id) => id !== robot.id));
}

/** `choice.robot` takes order `id` (when a leg to it is found), and the turn moves to the next robot. */
export function choose(state, choice, id) {
  state.cursor += 1;
  const { robot, distances } = choice;
  const chosen = state.orders.find((order) => order.id === id && (order.status === "open" || order.status === "staged"));
  if (!chosen) return;
  if (chosen.status === "staged") {
    // A load: to the pallet on the bay, picked up like an order, then into the truck.
    if (!planLeg(state, robot, chosen.cell)) return;
    const truck = truckOf(state, chosen);
    if (!truck.loader || truckDone(state, truck)) {
      truck.loader = robot.id;
      state.log.push({ t: state.t, type: "loader", robot: robot.id, truck: truck.id });
    }
    Object.assign(chosen, { status: "toTruck", robot: robot.id });
    Object.assign(robot, { phase: "toPick", order: chosen.id });
    state.log.push({ t: state.t, type: "load", robot: robot.id, order: chosen.id });
    return;
  }
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
    else if (robot.phase === "toDrop" && robot.queued) robot.target = null;
    else if (robot.phase === "toDrop") Object.assign(robot, { phase: "dropping", until: state.t + 1, target: null });
    else if (robot.phase === "home") Object.assign(robot, { phase: "idle", target: null });
  }
}

/** Robots held short of their target (no leg was found) try again. */
function retry(state) {
  callQueues(state);
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
    trucks: state.trucks.map((truck) => ({ ...truck })),
    claims: new Map(state.claims),
    queues: new Map([...state.queues].map(([key, queue]) => [key, [...queue]])),
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
