import { SIDES } from "./warehouse.js";
import { WAREHOUSE } from "./warehouse-hypotheses.js";

/**
 * The small facts of a day that every part of it reads (simulate.js, split on 26/10/2026 under the lint budget):
 * cells and their keys, which truck an order goes to, whether it is there, what the robots know of the aisle.
 */

/** A leg is planned this many turns ahead at most. */
export const LEG_HORIZON = 80;
/** How far ahead `state`'s legs are planned: `state.legHorizon` in a search's lighter worlds (28/10/2026), else LEG_HORIZON. */
export const legHorizonOf = (state) => state.legHorizon ?? LEG_HORIZON;
/** `state` with its legs planned `legHorizon` turns ahead, for the worlds a search draws from it; itself without one. */
export const withLegHorizon = (state, legHorizon) => (legHorizon ? { ...state, legHorizon } : state);

export const keyOf = (cell) => `${cell.x},${cell.y}`;
export const cellOfKey = (key) => {
  const [x, y] = key.split(",").map(Number);
  return { x, y };
};
export const sameCell = (a, b) => a.x === b.x && a.y === b.y;
/** The four cells beside `cell`, in the order of SIDES. */
export const besides = (cell) => SIDES.map(([dx, dy]) => ({ x: cell.x + dx, y: cell.y + dy }));

export const isHome = (robot) => sameCell(robot, robot.home);
export const truckOf = (state, order) => state.trucks[order.truck];
export const isThere = (state, truck) => state.t >= truck.at;
export const isDock = (state, cell) => state.warehouse.docks.some((one) => sameCell(one, cell));
/** On its way to pick, or picking. */
export const isFetching = (robot) => robot.phase === "toPick" || robot.phase === "picking";

/** Do the robots think the `~` aisle closed now? */
export const closed = (state) => state.t <= state.known.blockedUntil;
/** Is the aisle really blocked at turn `t` (what the day hides)? */
export const blockedNow = (state, t) => state.day.blockages.some((blockage) => t >= blockage.from && t < blockage.to);

export const orderOf = (state, robot) => state.orders.find((order) => order.id === robot.order);
export const orderById = (state, id) => state.orders.find((one) => one.id === id) ?? null;

/** Has every pallet of `truck` gone in (the truck has left)? */
export const truckDone = (state, truck) => state.orders.every((order) => order.truck !== truck.id - 1 || order.status === "delivered");
/** The zone of `truck` holding `cell` (its index), or -1. */
export const zoneOf = (truck, cell) => truck.dock.zones.findIndex((zone) => zone.some((one) => sameCell(one, cell)));
/** Do the dock loaders (day-loaders.js) take `truck`'s pallets in, rather than the robots? Never an assembly station's. */
export const humanLoads = (state, truck) => !truck.station && (state.setup.dockLoaders ?? WAREHOUSE.dockLoaders) > 0;
/** The zone `robot` loads for `truck` (its index), or null: none, the truck gone, or loaded by the dock loaders. */
export const loaderZone = (state, truck, robot) => {
  if (humanLoads(state, truck) || truckDone(state, truck)) return null;
  const found = Object.entries(truck.loaders).find(([, id]) => id === robot.id);
  return found ? Number(found[0]) : null;
};
export const isLoader = (state, truck, robot) => loaderZone(state, truck, robot) !== null;

/** Does `mover`'s leg go through `cell` after now? */
export const crossesAfter = (state, mover, cell) => mover.path?.some((step) => step.t > state.t && sameCell(step, cell)) ?? false;

/**
 * The cells reached from `start`, stepping into those `enter(next, key)` lets through (`seen`, their keys); stops early
 * once `found(cell)` holds for a cell taken from the queue (`found: true`).
 * @param {{ x: number, y: number }} start
 * @param {(next: { x: number, y: number }, key: string) => boolean} enter
 * @param {(cell: { x: number, y: number }) => boolean} [found]
 */
export function flood(start, enter, found = () => false) {
  const seen = new Set([keyOf(start)]);
  const queue = [start];
  for (let i = 0; i < queue.length; i += 1) {
    if (found(queue[i])) return { seen, found: true };
    for (const next of besides(queue[i])) {
      const key = keyOf(next);
      if (seen.has(key) || !enter(next, key)) continue;
      seen.add(key);
      queue.push(next);
    }
  }
  return { seen, found: false };
}
