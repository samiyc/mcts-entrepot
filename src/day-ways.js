import { besides, flood, isFetching, keyOf, orderOf, sameCell, truckOf } from "./day-basics.js";

/**
 * The ways pallets have to the trucks (simulate.js, split on 26/10/2026): floor sweeps through no other pallet, so
 * that none is ever shut in, and the `~` stretch a robot may back out along.
 */

/** Floor a pallet may count on: not the `~` aisle, which may be blocked when it has to go (Sami, 80 % blocked). */
const plainFloor = (warehouse, cell) => {
  const char = warehouse.plan.at(cell.x, cell.y);
  return warehouse.floor(char) && char !== "~";
};

/** Is there a floor way from `from` to `to` through no cell of `blocked` (pallets)? */
export function wayOut(state, from, to, blocked) {
  const enter = (next, key) => !(blocked.has(key) && !sameCell(next, to)) && plainFloor(state.warehouse, next);
  return flood(from, enter, (cell) => sameCell(cell, to)).found;
}

/** The cells holding a pallet: waiting on a bay, or about to be taken from it. */
export const palletCells = (state) => new Set(state.orders.filter((order) => order.cell && (order.status === "staged" || order.status === "toTruck")).map((order) => keyOf(order.cell)));

/** Can the pallet of `order`, on its bay, be carried into its truck without going through another pallet? */
export function clearToTruck(state, order) {
  // The cells promised to other pallets count too: one is on its way there.
  const pallets = new Set(state.orders.filter((other) => other.cell && other !== order).map((other) => keyOf(other.cell)));
  return wayOut(state, order.cell, truckOf(state, order).dock, pallets);
}

/** A robot on its way to fetch is judged from where it will pick, the way back from there. */
const pickupOf = (robot) => (robot.phase === "toPick" && robot.target ? robot.target : robot);
const palletMark = (order) => `${order.truck}:${keyOf(order.cell)}`;
const carriedMark = (state, robot) => {
  const order = orderOf(state, robot);
  const goal = order.cell ? keyOf(order.cell) : order.truck;
  return `${robot.phase}${keyOf(pickupOf(robot))}>${goal}`;
};
const shutMemo = new WeakMap();

/**
 * Would a pallet left on `cell` shut another in (Sami's waiting zones, 23/10: a zone is not a line, the loader got
 * boxed in a corner)? It must leave every pallet waiting or promised a way to its truck, and every robot carrying
 * one a way to where it goes, without going through another pallet.
 */
export function shutsIn(state, cell) {
  // The answer depends only on the pallets' cells and the loaded robots: remembered per warehouse, since the
  // search asks it again and again in worlds alike.
  const carried = state.robots.filter((robot) => (robot.phase === "toDrop" || isFetching(robot)) && robot.order);
  const pallets = state.orders.filter((order) => order.cell).map(palletMark);
  const signature = [keyOf(cell), pallets.join(" "), carried.map((robot) => carriedMark(state, robot)).join(" ")].join("|");
  if (!shutMemo.has(state.warehouse)) shutMemo.set(state.warehouse, new Map());
  const memo = shutMemo.get(state.warehouse);
  if (!memo.has(signature)) {
    if (memo.size > 200_000) memo.clear();
    memo.set(signature, shutsInNow(state, cell));
  }
  return memo.get(signature);
}

/**
 * One sweep a destination: the cells reached from it through no pallet. A pallet (or a robot with one) gets there
 * when it stands in that region or beside it: the same answer as a search from each, once.
 */
function reachesThrough(warehouse, blocked) {
  const regions = new Map();
  const regionOf = (to) => {
    if (!regions.has(keyOf(to))) regions.set(keyOf(to), flood(to, (next, key) => !blocked.has(key) && plainFloor(warehouse, next)).seen);
    return regions.get(keyOf(to));
  };
  return (from, to) => {
    const region = regionOf(to);
    return region.has(keyOf(from)) || besides(from).some((cell) => region.has(keyOf(cell)));
  };
}

/**
 * Is `robot` shut off from where it goes? With a pallet, where it drops it; on its way to fetch an order promised a
 * cell, that cell (in a one-cell aisle a pallet set down in front of it would shut its cell off for good); a loader on
 * its way to fetch an order it carries straight in, the truck.
 */
function robotShutIn(state, robot, reaches) {
  const order = orderOf(state, robot);
  const { dock } = truckOf(state, order);
  if (robot.phase === "toDrop") return !reaches(robot, order.cell ?? dock);
  if (!isFetching(robot) || order.status !== "assigned") return false;
  if (order.cell) return !reaches(pickupOf(robot), order.cell);
  return dock.bay.length > 0 && !reaches(pickupOf(robot), dock);
}

function shutsInNow(state, cell) {
  const blocked = new Set([keyOf(cell), ...state.orders.filter((order) => order.cell).map((order) => keyOf(order.cell))]);
  const reaches = reachesThrough(state.warehouse, blocked);
  if (state.orders.some((order) => order.cell && !reaches(order.cell, truckOf(state, order).dock))) return true;
  return state.robots.some((robot) => robot.order && robotShutIn(state, robot, reaches));
}

/** The `~` cells joined to the one `robot` stands on: the stretch it may back out along. */
export const stretchOf = (state, robot) => flood(robot, (next) => state.warehouse.plan.at(next.x, next.y) === "~").seen;
