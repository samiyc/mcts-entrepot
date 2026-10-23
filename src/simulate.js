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
 * **One loader a zone** (Sami, 23/10, evening, then late: one a zone, so two zones are loaded in turn), against
 * jams in front of the docks: once a truck is there, the first robot to take a pallet from one of its waiting
 * zones becomes that zone's loader, and only its loaders go into that truck. The other
 * robots drop their pallets on the bay (on the truck only when the bay is full). The loader takes the bay's
 * pallets first, then its own truck's orders, carried straight in; with nothing to do it waits off the bay. It
 * is free again once its truck has left. A robot passes under a pallet waiting on a bay, but not with one on
 * its back: two pallets never share a cell, so the bay is loaded from the truck's side first.
 *
 * What the day hides (`drawDay`): whether the `~` cells get blocked, and when. A robot sees it only beside
 * them; then every robot knows, and keeps away from them for a blockage's length. It happens again and again in a
 * day (`blocking`: the share of the time it is blocked).
 */
const LEG_HORIZON = 80;

/**
 * What the day hides, drawn from a seed: the blockages (`[{ from, to }]`, turns). The `~` aisle is blocked again
 * and again (Sami, 23/10: it was once a day at most), `duration` turns each time, with free spells between drawn at
 * random so that it is blocked `blocking` of the time on average (1: always).
 */
export function drawDay(seed, setup) {
  return { blockages: drawBlockages(createRng(seed), setup, 1) };
}

/** The blockages from turn `start` to the day's end, for `drawDay` and for the search's worlds. */
export function drawBlockages(rng, { blocking, duration, horizon }, start) {
  if (blocking <= 0) return [];
  // A free spell's mean length, for the aisle to be blocked `blocking` of the time.
  const free = (duration * (1 - Math.min(1, blocking))) / Math.min(1, blocking);
  const gap = () => Math.round(-free * Math.log(1 - rng.next()));
  const blockages = [];
  for (let from = start + gap(); from < horizon; from += duration + gap()) blockages.push({ from, to: from + duration });
  return blockages;
}

/** The day's trucks: the orders split by `/`, one group a dock, each truck with its arrival turn. */
function trucksOf(setup, warehouse) {
  const groups = setup.orders.split("/");
  if (groups.length > warehouse.docks.length) throw new Error(`${groups.length} camions pour ${warehouse.docks.length} quai${warehouse.docks.length > 1 ? "s" : ""} (T) sur le plan`);
  return groups.map((blocks, i) => ({ id: i + 1, dock: warehouse.docks[i], at: setup.trucks?.[i] ?? 0, blocks, loaders: {} }));
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
 * The warehouse's cells by use, computed once: `docking` (the docks, their bays and the floor up to two steps from a dock),
 * `pickups` (beside a block), and `aside`, where a robot may wait without blocking anyone: floor off the docks,
 * not a `~`, whose loss leaves every other floor cell connected (no aisle of one cell); the cells off the
 * pickups first (`rank` 0), then the pickup cells (1).
 */
function spotsOf(warehouse) {
  if (spots.has(warehouse)) return spots.get(warehouse);
  const { plan } = warehouse;
  // Two cells around a dock: robots waiting right beside its door could shut in the one inside (Sami, 23/10).
  const docking = new Set(warehouse.docks.flatMap((one) => [...one.bay.map(keyOf), ...[...distancesFrom(warehouse, one)].filter(([, steps]) => steps <= 2).map(([key]) => key)]));
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
  const warehouse = readWarehouse(setup.text, { autoZones: setup.autoZones !== false });
  const trucks = trucksOf(setup, warehouse);
  for (const block of new Set(setup.orders.replaceAll("/", ""))) if (!warehouse.blocks.get(block)?.length) throw new Error(`commande ${block} : pas de bloc ${block} accessible sur le plan`);
  const homes = homesOf(warehouse, setup.robots);
  // Older callers give one `blockage` (or none): read as a list.
  day = { blockages: day.blockages ?? (day.blockage ? [day.blockage] : []) };
  // Every robot holds its starting cell: nobody plans through a robot standing still.
  const reservations = createReservations();
  homes.forEach((home, i) => reservations.reserve(i + 1, [{ x: home.x, y: home.y, t: 0 }], { stay: true }));
  return {
    warehouse,
    setup,
    day,
    t: 0,
    trucks,
    robots: homes.map((home, i) => ({ id: i + 1, x: home.x, y: home.y, home: { x: home.x, y: home.y }, phase: "idle", order: null, target: null, queued: null, resume: null, blockedFor: 0, path: null, until: null, moves: 0, waits: 0 })),
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
/** Can a pallet be left on bay cell `cell`: not claimed, and no robot on its way there to pick (a bay cell may be beside a block). */
const bayFree = (state, cell) => !state.claims.has(keyOf(cell)) && !shutsIn(state, cell) && !state.robots.some((robot) => (robot.phase === "toPick" || robot.phase === "picking") && ((robot.target && keyOf(robot.target) === keyOf(cell)) || keyOf(robot) === keyOf(cell)));
const freeBayCell = (state, truck) => truck.dock.bay.find((cell) => bayFree(state, cell)) ?? null;
/** Does `cell` touch `truck`'s dock: its door, kept free for the loaders once the truck is there? */
const atDoor = (truck, cell) => Math.abs(cell.x - truck.dock.x) + Math.abs(cell.y - truck.dock.y) === 1;
/**
 * The waiting cell `robot` would leave a pallet of `truck` on: the free one nearest the truck (Sami: as near as
 * can be), and, the truck there, for anyone but its loaders, never one at the truck's door (their way in).
 */
function bayCellFor(state, truck, robot) {
  if (!isThere(state, truck) || isLoader(state, truck, robot)) return freeBayCell(state, truck);
  return truck.dock.bay.find((cell) => !atDoor(truck, cell) && bayFree(state, cell)) ?? null;
}
/** The zone of `truck` holding `cell` (its index), or -1. */
const zoneOf = (truck, cell) => truck.dock.zones.findIndex((zone) => zone.some((one) => one.x === cell.x && one.y === cell.y));
/** The zone `robot` loads for `truck` (its index), or null: none, or the truck gone. */
const loaderZone = (state, truck, robot) => {
  if (truckDone(state, truck)) return null;
  const found = Object.entries(truck.loaders).find(([, id]) => id === robot.id);
  return found ? Number(found[0]) : null;
};
const isLoader = (state, truck, robot) => loaderZone(state, truck, robot) !== null;
/** Can an order be taken now: its truck is there, or has no bay, or its bay has a cell left. */
/**
 * Can `robot` take order `order` now. Without a bay, always. With one: a cell left on it, claimed when it sets off;
 * once the truck is there, its loader carries straight in, but only once no pallet of its truck waits on the bay
 * (with one in hand it could not get past them), and the others still need a cell on the bay (Sami's docks,
 * 23/10: four robots with a pallet each, the truck's only door behind a waiting pallet, nobody left to load it).
 */
/** The pickup cell of `order` nearest `robot`, or null. */
const nearestPickupCell = (state, robot, order) => nearestPickup(state.warehouse, order.block, distancesFrom(state.warehouse, robot, closed(state)))?.cell ?? null;
const canTake = (state, order, robot) => {
  const truck = truckOf(state, order);
  if (truck.dock.bay.length === 0) return true;
  // A loader fetches itself only once no pallet waits in its zone.
  const zone = loaderZone(state, truck, robot);
  // And no pallet waiting or promised may stand between it and the truck: set down meanwhile, it would shut the
  // loader out with its own (a bay in a one-cell aisle).
  if (isThere(state, truck) && zone !== null) {
    if (state.orders.some((other) => other.truck === order.truck && other.cell && (other.status === "staged" || other.status === "toTruck") && zoneOf(truck, other.cell) === zone)) return false;
    return wayOut(state, order.cell ?? nearestPickupCell(state, robot, order) ?? robot, truck.dock, new Set(state.orders.filter((other) => other.cell).map((other) => keyOf(other.cell))));
  }
  return bayCellFor(state, truck, robot) !== null;
};
function claim(state, order, cell) {
  order.cell = cell;
  state.claims.set(keyOf(cell), order.id);
}

/** A pallet just left on `cell`: a loaded robot whose way crosses it goes around (two pallets never share a cell). */
function aroundPallet(state, cell) {
  for (const robot of state.robots) {
    if (robot.phase !== "toDrop" || !robot.target || (robot.target.x === cell.x && robot.target.y === cell.y)) continue;
    if (!robot.path?.some((step) => step.t > state.t && step.x === cell.x && step.y === cell.y)) continue;
    state.replans += 1;
    if (!planLeg(state, robot, robot.target)) hold(state, robot);
  }
}
function release(state, order) {
  if (order.cell && state.claims.get(keyOf(order.cell)) === order.id) state.claims.delete(keyOf(order.cell));
  order.cell = null;
}
/** Has every pallet of `truck` gone in (the truck has left)? */
const truckDone = (state, truck) => state.orders.every((order) => order.truck !== truck.id - 1 || order.status === "delivered");
/**
 * May `robot` load `order`'s pallet into `truck`: it is that zone's loader, or the zone has none and the robot loads
 * no other zone of the truck (one robot a zone; no bay, or the truck gone, anyone).
 */
const mayLoad = (state, truck, robot, order) => {
  if (truck.dock.bay.length === 0 || truckDone(state, truck)) return true;
  const loader = truck.loaders[zoneOf(truck, order.cell)];
  return loader === robot.id || (loader === undefined && !isLoader(state, truck, robot));
};
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
    if (order.status === "toTruck" || isLoader(state, truck, robot)) return into();
    if (!order.cell) {
      // The truck there: the free cell nearest it, never at its door, so the loaders' way in stays open.
      const free = bayCellFor(state, truck, robot);
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
const blockedNow = (state, t) => state.day.blockages.some((blockage) => t >= blockage.from && t < blockage.to);
const orderOf = (state, robot) => state.orders.find((order) => order.id === robot.order);

/** The cells holding a pallet: waiting on a bay, or about to be taken from it. */
const palletCells = (state) => new Set(state.orders.filter((order) => order.cell && (order.status === "staged" || order.status === "toTruck")).map((order) => keyOf(order.cell)));

/** Can the pallet of `order`, on its bay, be carried into its truck without going through another pallet? */
function clearToTruck(state, order) {
  // The cells promised to other pallets count too: one is on its way there.
  const pallets = new Set(state.orders.filter((other) => other.cell && other !== order).map((other) => keyOf(other.cell)));
  return wayOut(state, order.cell, truckOf(state, order).dock, pallets);
}

/** Is there a floor way from `from` to `to` through no cell of `blocked` (pallets)? */
function wayOut(state, from, to, blocked) {
  const seen = new Set([keyOf(from)]);
  const queue = [from];
  for (let i = 0; i < queue.length; i += 1) {
    const cell = queue[i];
    if (cell.x === to.x && cell.y === to.y) return true;
    for (const [dx, dy] of SIDES) {
      const next = { x: cell.x + dx, y: cell.y + dy };
      const key = keyOf(next);
      if (seen.has(key) || (blocked.has(key) && (next.x !== to.x || next.y !== to.y)) || !state.warehouse.floor(state.warehouse.plan.at(next.x, next.y))) continue;
      seen.add(key);
      queue.push(next);
    }
  }
  return false;
}

/**
 * Would a pallet left on `cell` shut another in (Sami's waiting zones, 23/10: a zone is not a line, the loader got
 * boxed in a corner)? It must leave every pallet waiting or promised a way to its truck, and every robot carrying
 * one a way to where it goes, without going through another pallet.
 */
function shutsIn(state, cell) {
  // The answer depends only on the pallets' cells and the loaded robots: remembered per warehouse, since the
  // search asks it again and again in worlds alike.
  const carried = state.robots.filter((robot) => (robot.phase === "toDrop" || robot.phase === "toPick" || robot.phase === "picking") && robot.order);
  const signature = `${keyOf(cell)}|${state.orders.filter((order) => order.cell).map((order) => `${order.truck}:${keyOf(order.cell)}`).join(" ")}|${carried.map((robot) => `${robot.phase}${keyOf(robot.phase === "toPick" && robot.target ? robot.target : robot)}>${orderOf(state, robot).cell ? keyOf(orderOf(state, robot).cell) : orderOf(state, robot).truck}`).join(" ")}`;
  if (!shutMemo.has(state.warehouse)) shutMemo.set(state.warehouse, new Map());
  const memo = shutMemo.get(state.warehouse);
  if (!memo.has(signature)) {
    if (memo.size > 200_000) memo.clear();
    memo.set(signature, shutsInNow(state, cell));
  }
  return memo.get(signature);
}
const shutMemo = new WeakMap();

function shutsInNow(state, cell) {
  const blocked = new Set([keyOf(cell), ...state.orders.filter((order) => order.cell).map((order) => keyOf(order.cell))]);
  // One sweep a destination: the cells reached from it through no pallet. A pallet (or a robot with one) gets
  // there when it stands in that region or beside it: the same answer as a search from each, once.
  const regions = new Map();
  const regionOf = (to) => {
    if (!regions.has(keyOf(to))) {
      const seen = new Set([keyOf(to)]);
      const queue = [to];
      for (let i = 0; i < queue.length; i += 1) {
        for (const [dx, dy] of SIDES) {
          const next = { x: queue[i].x + dx, y: queue[i].y + dy };
          const key = keyOf(next);
          if (seen.has(key) || blocked.has(key) || !state.warehouse.floor(state.warehouse.plan.at(next.x, next.y))) continue;
          seen.add(key);
          queue.push(next);
        }
      }
      regions.set(keyOf(to), seen);
    }
    return regions.get(keyOf(to));
  };
  const reaches = (from, to) => {
    const region = regionOf(to);
    return region.has(keyOf(from)) || SIDES.some(([dx, dy]) => region.has(`${from.x + dx},${from.y + dy}`));
  };
  // A robot on its way to fetch is judged from where it will pick, the way back from there.
  const pickupOf = (robot) => (robot.phase === "toPick" && robot.target ? robot.target : robot);
  for (const order of state.orders) if (order.cell && !reaches(order.cell, truckOf(state, order).dock)) return true;
  for (const robot of state.robots) {
    if (!robot.order) continue;
    const order = orderOf(state, robot);
    // A robot with a pallet must reach where it goes; one on its way to fetch an order promised a cell, that cell
    // (in a one-cell aisle a pallet set down in front of it would shut its cell off for good).
    if (robot.phase === "toDrop" && !reaches(robot, order.cell ?? truckOf(state, order).dock)) return true;
    if ((robot.phase === "toPick" || robot.phase === "picking") && order.status === "assigned" && order.cell && !reaches(pickupOf(robot), order.cell)) return true;
    // A loader on its way to fetch an order it carries straight in: the truck.
    if ((robot.phase === "toPick" || robot.phase === "picking") && order.status === "assigned" && !order.cell && truckOf(state, order).dock.bay.length > 0 && !reaches(pickupOf(robot), truckOf(state, order).dock)) return true;
  }
  return false;
}

/** The `~` cells joined to the one `robot` stands on: the stretch it may back out along. */
function stretchOf(state, robot) {
  const seen = new Set([keyOf(robot)]);
  const queue = [robot];
  for (let i = 0; i < queue.length; i += 1) {
    for (const [dx, dy] of SIDES) {
      const next = { x: queue[i].x + dx, y: queue[i].y + dy };
      if (seen.has(keyOf(next)) || state.warehouse.plan.at(next.x, next.y) !== "~") continue;
      seen.add(keyOf(next));
      queue.push(next);
    }
  }
  return seen;
}

/** Plans `robot`'s leg to `target` from now and reserves it; keeps the old leg when no path is found. */
function planLeg(state, robot, target) {
  // A robot already in the blocked stretch when the pallet went down may back out along it.
  // Only the stretch it stands in, not another blocked one beyond it (Sami's corridors: a robot backing out of
  // one `~` planned through the other, then would not step in, and another walked into its cell).
  const stretch = closed(state) && state.warehouse.plan.at(robot.x, robot.y) === "~" ? stretchOf(state, robot) : null;
  // A robot passes under a pallet waiting on a bay, but not with one on its back (Sami, 23/10): two pallets never share a cell.
  const pallets = robot.phase === "toDrop" ? palletCells(state) : null;
  // A truck's cell is entered only to go into the truck, never crossed on the way elsewhere.
  const passable = (char, x, y) => state.warehouse.floor(char) && !(char === "T" && (x !== target.x || y !== target.y)) && !(closed(state) && char === "~" && !stretch?.has(`${x},${y}`)) && !(pallets?.has(`${x},${y}`) && (x !== target.x || y !== target.y));
  // Out of reach on the floor itself, the aisle closed (no robot counted): no leg either (distances are remembered).
  if (!stretch && !distancesFrom(state.warehouse, robot, closed(state)).has(keyOf(target))) return false;
  // Someone parks on the target for good, or is due there past the horizon: no leg can end there, no need to search.
  if (!state.reservations.freeFrom(target.x, target.y, state.t + LEG_HORIZON, robot.id)) return false;
  // Every way into the target held for good by others (a truck with one door, someone parked on it): no search either.
  const ways = SIDES.map(([dx, dy]) => ({ x: target.x + dx, y: target.y + dy })).filter((cell) => passable(state.warehouse.plan.at(cell.x, cell.y), cell.x, cell.y));
  if ((robot.x !== target.x || robot.y !== target.y) && !ways.some((cell) => (cell.x === robot.x && cell.y === robot.y) || state.reservations.freeFrom(cell.x, cell.y, state.t + LEG_HORIZON, robot.id))) return false;
  const path = astar(state.warehouse.plan, robot, target, { passable, reservations: state.reservations, unit: robot.id, start: state.t, horizon: LEG_HORIZON, park: true });
  if (!path) return false;
  state.reservations.release(robot.id);
  state.reservations.reserve(robot.id, path, { stay: true });
  Object.assign(robot, { path, target });
  return true;
}

/**
 * Holds `robot` where it stands, its cell reserved, when no leg can be found. Robots that had planned through that
 * cell plan again around it (or hold too): a robot held never has another walk into it.
 */
function hold(state, robot, depth = 0) {
  const here = [{ x: robot.x, y: robot.y, t: state.t }];
  state.reservations.release(robot.id);
  state.reservations.reserve(robot.id, here, { stay: true });
  robot.path = here;
  for (const other of state.robots) {
    if (other === robot || !other.path?.some((step) => step.t > state.t && step.x === robot.x && step.y === robot.y)) continue;
    state.replans += 1;
    if ((!other.target || !planLeg(state, other, other.target)) && depth < state.robots.length) hold(state, other, depth + 1);
  }
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
  Object.assign(state.known, { blockedUntil: state.t + state.setup.duration, seenAt: state.t, seen: (state.known.seen ?? 0) + 1 });
  state.log.push({ t: state.t, type: "blocked", robot: seer.id });
  for (const robot of state.robots) {
    const ahead = robot.path?.filter((step) => step.t > state.t) ?? [];
    if (!ahead.some((step) => state.warehouse.plan.at(step.x, step.y) === "~")) continue;
    // With a target, around the aisle; without one (a leg still running), stopped where it is.
    state.replans += 1;
    if (!robot.target || !planLeg(state, robot, robot.target)) hold(state, robot);
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
        if (order.cell) aroundPallet(state, order.cell);
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
    const loads = state.orders.filter((order) => order.status === "staged" && order.cell && isThere(state, truckOf(state, order)) && reach(order) < Infinity && mayLoad(state, truckOf(state, order), robot, order) && clearToTruck(state, order) && !state.robots.some((other) => other !== robot && other.x === order.cell.x && other.y === order.cell.y));
    // Whether a truck takes one more pallet is the same for all its orders: asked once per truck, except for a
    // loader, whose answer depends on where the order is picked (its way back to the truck).
    const takes = new Map();
    const canTakeFor = (order) => {
      if (isLoader(state, truckOf(state, order), robot)) return canTake(state, order, robot);
      if (!takes.has(order.truck)) takes.set(order.truck, canTake(state, order, robot));
      return takes.get(order.truck);
    };
    const fetches = state.orders.filter((order) => order.status === "open" && reach(order) < Infinity && canTakeFor(order));
    // A zone's loader keeps to it: its zone's pallets, then its truck's orders, else it waits off the bay.
    const loading = state.trucks.find((truck) => isLoader(state, truck, robot));
    if (loading) {
      const zone = loaderZone(state, loading, robot);
      const mine = [...loads.filter((order) => truckOf(state, order) === loading && zoneOf(loading, order.cell) === zone), ...fetches.filter((order) => truckOf(state, order) === loading)];
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
  if (planLeg(state, robot, cell)) return;
  // No way into the truck now (someone still inside, its only door held): wait aside, never on the door.
  if (isDock(state, cell)) wait(state, robot, cell);
  else robot.target = cell;
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
    // A load: to the pallet on the bay, picked up like an order, then into the truck. Not reached: out of the way.
    if (!planLeg(state, robot, chosen.cell)) {
      standBy(state, robot);
      return;
    }
    const truck = truckOf(state, chosen);
    const zone = zoneOf(truck, chosen.cell);
    if (truck.loaders[zone] === undefined) {
      truck.loaders[zone] = robot.id;
      state.log.push({ t: state.t, type: "loader", robot: robot.id, truck: truck.id, zone });
    }
    Object.assign(chosen, { status: "toTruck", robot: robot.id });
    Object.assign(robot, { phase: "toPick", order: chosen.id });
    state.log.push({ t: state.t, type: "load", robot: robot.id, order: chosen.id });
    return;
  }
  // The nearest pickup cell a leg reaches: the nearest may hold a robot parked there for good.
  // Not from under a pallet waiting on a bay: with the order on its back, the robot would hold two on one cell.
  const pallets = new Set(state.orders.filter((order) => order.cell).map((order) => keyOf(order.cell)));
  const cells = state.warehouse.blocks.get(chosen.block).filter((cell) => distances.has(`${cell.x},${cell.y}`) && !pallets.has(keyOf(cell)));
  cells.sort((a, b) => distances.get(`${a.x},${a.y}`) - distances.get(`${b.x},${b.y}`));
  if (!cells.some((cell) => planLeg(state, robot, cell))) {
    standBy(state, robot);
    return;
  }
  Object.assign(chosen, { status: "assigned", robot: robot.id });
  const truck = truckOf(state, chosen);
  if (truck.dock.bay.length > 0 && (!isThere(state, truck) || !isLoader(state, truck, robot))) claim(state, chosen, bayCellFor(state, truck, robot));
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
    // Arrived at the leg's end only: a leg may pass its target, waiting for a turn to park there.
    if (!robot.target || robot.x !== robot.target.x || robot.y !== robot.target.y || (robot.path?.at(-1)?.t ?? 0) > state.t) continue;
    // Out of the way for another: back to its own target, retried from next turn.
    if (robot.resume) Object.assign(robot, { target: robot.resume, resume: null });
    else if (robot.phase === "toPick") Object.assign(robot, { phase: "picking", until: state.t + 1, target: null });
    else if (robot.phase === "toDrop" && robot.queued) robot.target = null;
    else if (robot.phase === "toDrop") Object.assign(robot, { phase: "dropping", until: state.t + 1, target: null });
    else if (robot.phase === "home") Object.assign(robot, { phase: "idle", target: null });
  }
}

/**
 * Robots held short of their target (no leg was found) try again. Two of them nose to nose in a one-cell aisle
 * each see the other parked for good: the one held longest (the higher number between equals) gives way, to the
 * nearest free cell off the aisle, lets the other pass, and sets off again from there.
 */
function retry(state) {
  callQueues(state);
  for (const robot of state.robots) {
    const end = robot.path?.at(-1);
    const short = robot.target && end && end.t <= state.t && (end.x !== robot.target.x || end.y !== robot.target.y);
    if (!short) {
      robot.blockedFor = 0;
      continue;
    }
    robot.blockedFor = planLeg(state, robot, robot.target) ? 0 : (robot.blockedFor ?? 0) + 1;
  }
  const stuck = state.robots.filter((robot) => robot.blockedFor >= 2 && !robot.resume).sort((a, b) => b.blockedFor - a.blockedFor || b.id - a.id)[0];
  if (stuck) giveWay(state, stuck);
}

/** `robot`, stuck, to the nearest free cell (an aside cell first) within four steps; its target kept for after. */
function giveWay(state, robot) {
  const taken = new Set(state.robots.filter((other) => other !== robot).flatMap((other) => [keyOf(other), ...(other.target ? [keyOf(other.target)] : [])]));
  const { aside, docking } = spotsOf(state.warehouse);
  const pocket = new Set(aside);
  const near = [...distancesFrom(state.warehouse, robot, closed(state))].filter(([key, steps]) => steps > 0 && steps <= 4 && !taken.has(key) && !docking.has(key)).sort((a, b) => Number(pocket.has(b[0])) - Number(pocket.has(a[0])) || a[1] - b[1]);
  const goal = robot.target;
  for (const [key] of near) {
    const [x, y] = key.split(",").map(Number);
    if (planLeg(state, robot, { x, y })) {
      Object.assign(robot, { resume: goal, blockedFor: 0 });
      state.log.push({ t: state.t, type: "gaveWay", robot: robot.id });
      return;
    }
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
    trucks: state.trucks.map((truck) => ({ ...truck, loaders: { ...truck.loaders } })),
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
    blocked: state.day.blockages.length > 0,
    blockages: state.day.blockages.filter((blockage) => blockage.from <= state.t).length,
    seenAt: state.known.seenAt,
  };
}

/** A whole day of `setup` (plans.js) from `seed` under `rule`: the final state and its measures. */
export function runDay(setup, seed, rule) {
  const state = createDay(setup, drawDay(seed, setup));
  while (!isOver(state)) stepDay(state, rule);
  return { state, measures: measuresOf(state) };
}
