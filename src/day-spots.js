import { cellOfKey, flood, keyOf } from "./day-basics.js";
import { distancesFrom } from "./warehouse.js";

const spots = new WeakMap();

/**
 * The warehouse's cells by use, computed once: `docking` (the docks, their bays and the floor up to two steps from a dock),
 * `pickups` (beside a block), and `aside`, where a robot may wait without blocking anyone: floor off the docks,
 * not a `~`, whose loss leaves every other floor cell connected (no aisle of one cell); the cells off the
 * pickups first (`rank` 0), then the pickup cells (1).
 */
export function spotsOf(warehouse) {
  if (spots.has(warehouse)) return spots.get(warehouse);
  const { plan } = warehouse;
  // Two cells around a dock: robots waiting right beside its door could shut in the one inside (Sami, 23/10).
  const nearDock = (one) => [...distancesFrom(warehouse, one)].filter(([, steps]) => steps <= 2).map(([key]) => key);
  const docking = new Set(warehouse.docks.flatMap((one) => [...one.bay.map(keyOf), ...nearDock(one)]));
  const pickups = new Set([...warehouse.blocks.values()].flat().map(keyOf));
  const floor = [...distancesFrom(warehouse, warehouse.dock).keys()];
  const connectedWithout = (cut) => {
    const start = cellOfKey(floor.find((key) => key !== cut));
    const { seen } = flood(start, (next, key) => key !== cut && warehouse.floor(plan.at(next.x, next.y)));
    return seen.size === floor.length - 1;
  };
  const pockets = floor.filter((key) => {
    const cell = cellOfKey(key);
    return !docking.has(key) && plan.at(cell.x, cell.y) !== "~" && connectedWithout(key);
  });
  // Off the pickups first; in a narrow warehouse, a pickup cell in a side pocket will do.
  const aside = [...pockets.filter((key) => !pickups.has(key)), ...pockets.filter((key) => pickups.has(key))];
  const found = { docking, pickups, aside, rank: new Map(aside.map((key) => [key, pickups.has(key) ? 1 : 0])) };
  spots.set(warehouse, found);
  return found;
}

/**
 * Where the robots start and go back to: a charging point each, then (fewer points than robots, or none) the
 * free floor nearest the first dock, off the docks, the bays and the cells beside a block when it can.
 */
export function homesOf(warehouse, robots) {
  const homes = warehouse.charges.slice(0, robots);
  const taken = new Set(homes.map(keyOf));
  const { docking, pickups } = spotsOf(warehouse);
  const aside = new Set(spotsOf(warehouse).aside);
  const near = [...distancesFrom(warehouse, warehouse.dock)].sort((a, b) => a[1] - b[1]).map(([key]) => key);
  const passes = [(key) => !aside.has(key) || pickups.has(key), (key) => !aside.has(key), (key) => docking.has(key), () => false];
  for (const avoid of passes) {
    const free = near.filter((key) => !taken.has(key) && !avoid(key)).slice(0, robots - homes.length);
    for (const key of free) {
      homes.push(cellOfKey(key));
      taken.add(key);
    }
  }
  if (homes.length < robots) throw new Error(`pas assez de place pour ${robots} robots`);
  return homes;
}
