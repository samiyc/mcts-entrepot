import { closed, isHome, isLoader, isThere, keyOf, loaderZone, sameCell, truckOf, zoneOf } from "./day-basics.js";
import { bayCellFor, canTake, claim, mayLoad } from "./day-bays.js";
import { legToPickup, planLeg, standBy } from "./day-legs.js";
import { clearToTruck } from "./day-ways.js";
import { distancesFrom, nearestPickup } from "./warehouse.js";

/**
 * The robots' choices (simulate.js, split on 26/10/2026): what an idle robot may take, a pallet to load or an order
 * to fetch, and what follows once the rule has chosen.
 */

/** The pallets on a bay whose truck is there that `robot` may load now. */
function loadsFor(state, robot, reach) {
  const loadable = (order) =>
    order.status === "staged" && order.cell && isThere(state, truckOf(state, order)) && reach(order) < Infinity && mayLoad(state, truckOf(state, order), robot, order) && clearToTruck(state, order) && !state.robots.some((other) => other !== robot && sameCell(other, order.cell));
  return state.orders.filter(loadable);
}

/**
 * The open orders `robot` may fetch now. Whether a truck takes one more pallet is the same for all its orders: asked
 * once per truck, except for a loader, whose answer depends on where the order is picked (its way back to the truck).
 */
function fetchesFor(state, robot, reach) {
  const takes = new Map();
  const canTakeFor = (order) => {
    if (isLoader(state, truckOf(state, order), robot)) return canTake(state, order, robot);
    if (!takes.has(order.truck)) takes.set(order.truck, canTake(state, order, robot));
    return takes.get(order.truck);
  };
  return state.orders.filter((order) => order.status === "open" && reach(order) < Infinity && canTakeFor(order));
}

/** A zone's loader keeps to it: its zone's pallets, then its truck's orders, else it waits off the bay (null). */
function loaderChoice(state, robot, loading, { loads, fetches, reach, distances }) {
  const zone = loaderZone(state, loading, robot);
  const mine = [...loads.filter((order) => truckOf(state, order) === loading && zoneOf(loading, order.cell) === zone), ...fetches.filter((order) => truckOf(state, order) === loading)];
  if (mine.length > 0) return { robot, open: mine, reach, distances };
  standBy(state, robot);
  return null;
}

/** The choice of idle `robot`, or null: with nothing it can take, it goes back where it started on the way. */
function choiceOf(state, robot) {
  const distances = distancesFrom(state.warehouse, robot, closed(state));
  const reach = (order) => (order.status === "staged" ? (distances.get(keyOf(order.cell)) ?? Infinity) : (nearestPickup(state.warehouse, order.block, distances)?.steps ?? Infinity));
  const loads = loadsFor(state, robot, reach);
  const fetches = fetchesFor(state, robot, reach);
  const loading = state.trucks.find((truck) => isLoader(state, truck, robot));
  if (loading) return loaderChoice(state, robot, loading, { loads, fetches, reach, distances });
  const open = [...loads, ...fetches];
  if (open.length > 0) return { robot, open, reach, distances };
  if (robot.phase === "idle" && !isHome(robot)) {
    if (planLeg(state, robot, robot.home)) robot.phase = "home";
    else standBy(state, robot);
  }
  return null;
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
    const choice = choiceOf(state, robot);
    if (choice) return choice;
  }
  return null;
}

/** A load: to the pallet on the bay, picked up like an order, then into the truck. Not reached: out of the way. */
function takeLoad(state, robot, chosen) {
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
}

/** An order to fetch: a leg to its block, and its waiting cell claimed (but for the loader of a truck there). */
function takeOrder(state, { robot, distances }, chosen) {
  if (!legToPickup(state, robot, chosen, distances)) {
    standBy(state, robot);
    return;
  }
  Object.assign(chosen, { status: "assigned", robot: robot.id });
  const truck = truckOf(state, chosen);
  if (truck.dock.bay.length > 0 && (!isThere(state, truck) || !isLoader(state, truck, robot))) claim(state, chosen, bayCellFor(state, truck, robot));
  Object.assign(robot, { phase: "toPick", order: chosen.id });
  state.log.push({ t: state.t, type: "assigned", robot: robot.id, order: chosen.id });
}

/** `choice.robot` takes order `id` (when a leg to it is found), and the turn moves to the next robot. */
export function choose(state, choice, id) {
  state.cursor += 1;
  const chosen = state.orders.find((order) => order.id === id && (order.status === "open" || order.status === "staged"));
  if (!chosen) return;
  if (chosen.status === "staged") takeLoad(state, choice.robot, chosen);
  else takeOrder(state, choice, chosen);
}
