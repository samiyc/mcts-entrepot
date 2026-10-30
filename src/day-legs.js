import { astar } from "mcts-commun/grid.js";
import { besides, cellOfKey, closed, crossesAfter, keyOf, legHorizonOf, sameCell } from "./day-basics.js";
import { spotsOf } from "./day-spots.js";
import { palletCells, stretchOf } from "./day-ways.js";
import { distancesFrom } from "./warehouse.js";

/**
 * The robots' legs (simulate.js, split on 26/10/2026): each a path in space and time (A* of mcts-commun) reserved
 * around the paths already reserved, so robots never meet in a cell nor swap cells; a robot with no leg holds where it
 * stands, and the others plan around it.
 */

/** What a leg of `robot` to `target` may step through now, and the `~` stretch it may back out along (or null). */
function legRules(state, robot, target) {
  const closedNow = closed(state);
  // A robot already in the blocked stretch when the pallet went down may back out along it.
  // Only the stretch it stands in, not another blocked one beyond it (Sami's corridors: a robot backing out of
  // one `~` planned through the other, then would not step in, and another walked into its cell).
  const stretch = closedNow && state.warehouse.plan.at(robot.x, robot.y) === "~" ? stretchOf(state, robot) : null;
  // A robot passes under a pallet waiting on a bay, but not with one on its back (Sami, 23/10): two pallets never share a cell.
  const pallets = robot.phase === "toDrop" ? palletCells(state) : null;
  const isTarget = (x, y) => x === target.x && y === target.y;
  // A truck's cell is entered only to go into the truck, never crossed on the way elsewhere.
  const crossesTruck = (char, x, y) => char === "T" && !isTarget(x, y);
  const intoClosedAisle = (char, key) => closedNow && char === "~" && !stretch?.has(key);
  const ontoPallet = (key, x, y) => Boolean(pallets?.has(key)) && !isTarget(x, y);
  const passable = (char, x, y) => {
    const key = `${x},${y}`;
    return state.warehouse.floor(char) && !crossesTruck(char, x, y) && !intoClosedAisle(char, key) && !ontoPallet(key, x, y);
  };
  return { stretch, passable };
}

/** Can a leg to `target` be found at all? No search when the answer is known without one (each failed search sweeps the whole horizon). */
function worthSearching(state, robot, target, { stretch, passable }) {
  const freeFrom = (cell) => state.reservations.freeFrom(cell.x, cell.y, state.t + legHorizonOf(state), robot.id);
  // Out of reach on the floor itself, the aisle closed (no robot counted): no leg either (distances are remembered).
  if (!stretch && !distancesFrom(state.warehouse, robot, closed(state)).has(keyOf(target))) return false;
  // Someone parks on the target for good, or is due there past the horizon: no leg can end there, no need to search.
  if (!freeFrom(target)) return false;
  // Every way into the target held for good by others (a truck with one door, someone parked on it): no search either.
  const ways = besides(target).filter((cell) => passable(state.warehouse.plan.at(cell.x, cell.y), cell.x, cell.y));
  return sameCell(robot, target) || ways.some((cell) => sameCell(cell, robot) || freeFrom(cell));
}

/** Plans `robot`'s leg to `target` from now and reserves it; keeps the old leg when no path is found. */
export function planLeg(state, robot, target) {
  const rules = legRules(state, robot, target);
  if (!worthSearching(state, robot, target, rules)) return false;
  const path = astar(state.warehouse.plan, robot, target, { passable: rules.passable, reservations: state.reservations, unit: robot.id, start: state.t, horizon: legHorizonOf(state), park: true });
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
export function hold(state, robot, depth = 0) {
  const here = [{ x: robot.x, y: robot.y, t: state.t }];
  state.reservations.release(robot.id);
  state.reservations.reserve(robot.id, here, { stay: true });
  robot.path = here;
  for (const other of state.robots) {
    if (other === robot || !crossesAfter(state, other, robot)) continue;
    state.replans += 1;
    const replanned = Boolean(other.target) && planLeg(state, other, other.target);
    if (!replanned && depth < state.robots.length) hold(state, other, depth + 1);
  }
}

/** `robot` plans again to its target, around what changed; with no target, or no leg, it holds where it is. */
export function replanOrHold(state, robot) {
  state.replans += 1;
  if (!robot.target || !planLeg(state, robot, robot.target)) hold(state, robot);
}

/** A pallet just left on `cell`: a loaded robot whose way crosses it goes around (two pallets never share a cell). */
export function aroundPallet(state, cell) {
  for (const robot of state.robots) {
    if (robot.phase !== "toDrop" || !robot.target || sameCell(robot.target, cell)) continue;
    if (crossesAfter(state, robot, cell)) replanOrHold(state, robot);
  }
}

/**
 * `robot`'s leg to the nearest pickup cell of `order` a leg reaches (the nearest may hold a robot parked there for
 * good). Not from under a pallet waiting on a bay: with the order on its back, the robot would hold two on one cell.
 */
export function legToPickup(state, robot, order, distances = distancesFrom(state.warehouse, robot, closed(state))) {
  const pallets = new Set(state.orders.filter((other) => other.cell).map((other) => keyOf(other.cell)));
  const cells = state.warehouse.blocks.get(order.block).filter((cell) => distances.has(keyOf(cell)) && !pallets.has(keyOf(cell)));
  cells.sort((a, b) => distances.get(keyOf(a)) - distances.get(keyOf(b)));
  // The three nearest at most: each leg not found searches the whole horizon (an aisle blocked most of the time).
  return cells.slice(0, 3).some((cell) => planLeg(state, robot, cell));
}

/** The cells `robot` may not wait on: the others' and their targets, and with a pallet on its back the pallets' (26/10/2026: one gave way onto a pallet set down for a relay). */
const takenBy = (state, robot) => {
  const others = state.robots.filter((other) => other !== robot).flatMap((other) => [keyOf(other), ...(other.target ? [keyOf(other.target)] : [])]);
  return new Set([...others, ...(robot.phase === "toDrop" ? palletCells(state) : [])]);
};

/** `robot` to the free aside cell nearest `near` (a dock it waits for, or where it stands); false when none is reached. */
export function goAside(state, robot, near) {
  const taken = takenBy(state, robot);
  const reach = distancesFrom(state.warehouse, robot, closed(state));
  const from = distancesFrom(state.warehouse, near, closed(state));
  const { aside, rank } = spotsOf(state.warehouse);
  const cells = aside.filter((key) => !taken.has(key) && reach.has(key)).sort((a, b) => rank.get(a) - rank.get(b) || (from.get(a) ?? Infinity) - (from.get(b) ?? Infinity));
  return cells.slice(0, 6).some((key) => key === keyOf(robot) || planLeg(state, robot, cellOfKey(key)));
}

/**
 * A loader with nothing to do: off the docks, the bays and the cells beside a block, to the nearest free cell; so is
 * a robot left on a pallet it set down for a relay (the taker must get to it).
 */
export function standBy(state, robot) {
  const { docking, pickups } = spotsOf(state.warehouse);
  const here = keyOf(robot);
  if (robot.target || (!docking.has(here) && !pickups.has(here) && !state.claims.has(here))) return;
  goAside(state, robot, robot);
}

/** `robot`, stuck, to the nearest free cell (an aside cell first) within four steps; its target kept for after. False when it has none. */
export function giveWay(state, robot) {
  const taken = takenBy(state, robot);
  const { aside, docking } = spotsOf(state.warehouse);
  const pocket = new Set(aside);
  const near = [...distancesFrom(state.warehouse, robot, closed(state))].filter(([key, steps]) => steps > 0 && steps <= 4 && !taken.has(key) && !docking.has(key)).sort((a, b) => Number(pocket.has(b[0])) - Number(pocket.has(a[0])) || a[1] - b[1]);
  const goal = robot.target;
  if (!near.some(([key]) => planLeg(state, robot, cellOfKey(key)))) return false;
  Object.assign(robot, { resume: goal, blockedFor: 0 });
  state.log.push({ t: state.t, type: "gaveWay", robot: robot.id });
  return true;
}
