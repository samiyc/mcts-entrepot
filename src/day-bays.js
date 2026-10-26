import { closed, isFetching, isLoader, isThere, keyOf, loaderZone, sameCell, truckDone, truckOf, zoneOf } from "./day-basics.js";
import { shutsIn, wayOut } from "./day-ways.js";
import { distancesFrom, nearestPickup } from "./warehouse.js";

/**
 * The trucks' bays and waiting zones (simulate.js, split on 26/10/2026): which cell a pallet waits on, who may take
 * an order or load a pallet, where a robot drops what it carries.
 */

export function claim(state, order, cell) {
  order.cell = cell;
  state.claims.set(keyOf(cell), order.id);
}

export function release(state, order) {
  if (order.cell && state.claims.get(keyOf(order.cell)) === order.id) state.claims.delete(keyOf(order.cell));
  order.cell = null;
}

export function deliver(state, order, t) {
  release(state, order);
  Object.assign(order, { status: "delivered", deliveredAt: t });
}

/** Is `robot` on its way to pick on `cell`, or picking there (a bay cell may be beside a block)? */
const picksOn = (robot, cell) => isFetching(robot) && ((robot.target && sameCell(robot.target, cell)) || sameCell(robot, cell));
/** Can a pallet be left on bay cell `cell`: not claimed, shutting nobody in, and no robot on its way there to pick. */
const bayFree = (state, cell) => !state.claims.has(keyOf(cell)) && !shutsIn(state, cell) && !state.robots.some((robot) => picksOn(robot, cell));
/** The free cell of a truck's bay nearest the truck, or null (none left, or no bay). */
const freeBayCell = (state, truck) => truck.dock.bay.find((cell) => bayFree(state, cell)) ?? null;
/** Does `cell` touch `truck`'s dock: its door, kept free for the loaders once the truck is there? */
const atDoor = (truck, cell) => Math.abs(cell.x - truck.dock.x) + Math.abs(cell.y - truck.dock.y) === 1;

/**
 * The waiting cell `robot` would leave a pallet of `truck` on: the free one nearest the truck (Sami: as near as
 * can be), and, the truck there, for anyone but its loaders, never one at the truck's door (their way in).
 */
export function bayCellFor(state, truck, robot) {
  if (!isThere(state, truck) || isLoader(state, truck, robot)) return freeBayCell(state, truck);
  return truck.dock.bay.find((cell) => !atDoor(truck, cell) && bayFree(state, cell)) ?? null;
}

/** The pickup cell of `order` nearest `robot`, or null. */
const nearestPickupCell = (state, robot, order) => nearestPickup(state.warehouse, order.block, distancesFrom(state.warehouse, robot, closed(state)))?.cell ?? null;

/**
 * May a loader fetch `order` itself: only once no pallet waits in its zone, and no pallet waiting or promised stands
 * between where it will pick and the truck (set down meanwhile, it would shut the loader out with its own: a bay in
 * a one-cell aisle).
 */
function loaderMayFetch(state, order, robot, zone) {
  const truck = truckOf(state, order);
  const waits = (other) => other.truck === order.truck && other.cell && (other.status === "staged" || other.status === "toTruck") && zoneOf(truck, other.cell) === zone;
  if (state.orders.some(waits)) return false;
  const promised = new Set(state.orders.filter((other) => other.cell).map((other) => keyOf(other.cell)));
  return wayOut(state, order.cell ?? nearestPickupCell(state, robot, order) ?? robot, truck.dock, promised);
}

/**
 * Can `robot` take order `order` now. Without a bay, always. With one: a cell left on it, claimed when it sets off;
 * once the truck is there, its loader carries straight in, but only once no pallet of its truck waits on the bay
 * (with one in hand it could not get past them), and the others still need a cell on the bay (Sami's docks,
 * 23/10: four robots with a pallet each, the truck's only door behind a waiting pallet, nobody left to load it).
 */
export function canTake(state, order, robot) {
  const truck = truckOf(state, order);
  if (truck.dock.bay.length === 0) return true;
  const zone = loaderZone(state, truck, robot);
  if (isThere(state, truck) && zone !== null) return loaderMayFetch(state, order, robot, zone);
  return bayCellFor(state, truck, robot) !== null;
}

/**
 * May `robot` load `order`'s pallet into `truck`: it is that zone's loader, or the zone has none and the robot loads
 * no other zone of the truck (one robot a zone; no bay, or the truck gone, anyone).
 */
export function mayLoad(state, truck, robot, order) {
  if (truck.dock.bay.length === 0 || truckDone(state, truck)) return true;
  const loader = truck.loaders[zoneOf(truck, order.cell)];
  return loader === robot.id || (loader === undefined && !isLoader(state, truck, robot));
}

/** Into the truck: the order's waiting cell, if any, is given up. */
function dropInto(state, order, truck) {
  release(state, order);
  return { x: truck.dock.x, y: truck.dock.y };
}

/** Where `robot` drops `order` with its truck there: in it (a load, or the loader), else on the bay, never at the door. */
function dropWithTruckThere(state, order, robot, truck) {
  if (order.status === "toTruck" || isLoader(state, truck, robot)) return dropInto(state, order, truck);
  if (order.cell) return order.cell;
  // The truck there: the free cell nearest it, never at its door, so the loaders' way in stays open.
  const free = bayCellFor(state, truck, robot);
  if (!free) {
    // The bay is full: this pallet goes into the truck anyway.
    state.log.push({ t: state.t, type: "overflow", robot: robot.id, truck: truck.id });
    return dropInto(state, order, truck);
  }
  claim(state, order, free);
  return order.cell;
}

/**
 * Where `robot` drops an order: into the truck when it is there and the robot is its loader (or it has no bay),
 * else on the bay, its claimed cell, a free one, or the bay's first; a robot that is not the loader finding the
 * bay full goes into the truck.
 */
export function dropCellOf(state, order, robot) {
  const truck = truckOf(state, order);
  if (truck.dock.bay.length === 0) return dropInto(state, order, truck);
  if (isThere(state, truck)) return dropWithTruckThere(state, order, robot, truck);
  if (order.cell) return order.cell;
  const cell = freeBayCell(state, truck) ?? truck.dock.bay[0];
  claim(state, order, cell);
  return cell;
}
