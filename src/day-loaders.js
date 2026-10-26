import { humanLoads, isThere } from "./day-basics.js";
import { deliver, release } from "./day-bays.js";
import { WAREHOUSE } from "./warehouse-hypotheses.js";

/**
 * The dock loaders (Sami, 26/10/2026, the night: the 90 s of a pallet into a truck are a forklift driver's, driving
 * into the trailer; lifting takes seconds). The robots set their pallets on the dock's bay, or at its door, in a turn;
 * a loader takes them into the truck, `loadTurns` each (warehouse-hypotheses.js), one truck after the other. Two or
 * three only in a big warehouse, when as many trucks load together (`setup.dockLoaders`, 1 by default).
 *
 * A loader keeps to its truck while a pallet waits there, the one nearest the truck first; then it goes to the truck
 * there first that has some waiting and no other loader (the nearest dock between equals), a cell a turn, the robots'
 * speed. One loader a truck: one forklift at a time in a trailer. It is not on the grid (it reserves no cell): on the
 * grid, at the keys, with the robots slowing near it, is for later (docs/recherche/feuille-de-route.md).
 */

/** The day's loaders, at the first truck's dock: none when the robots load. */
export function loadersOf(setup, trucks) {
  const count = setup.dockLoaders ?? WAREHOUSE.dockLoaders;
  const first = trucks.findIndex((truck) => !truck.station);
  if (first < 0) return [];
  return Array.from({ length: count }, (_, i) => ({ id: i + 1, truck: first, order: null, until: null, walking: false, busy: 0, walked: 0 }));
}

/** The pallets of `truck` waiting for a loader: set down by a robot, the truck there. */
const waitingFor = (state, index) => state.orders.filter((order) => order.truck === index && order.status === "staged" && isThere(state, state.trucks[index]));

/** The waiting pallet nearest its truck: on the bay in its order (nearest the truck first), then those at the door. */
function nextPallet(state, waiting) {
  const bay = state.trucks[waiting[0].truck].dock.bay;
  const rank = (order) => (order.cell ? bay.findIndex((cell) => cell.x === order.cell.x && cell.y === order.cell.y) : -1);
  return [...waiting].sort((a, b) => rank(a) - rank(b) || a.id - b.id)[0];
}

const steps = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

/** The truck a free `loader` goes to: the one there first with pallets waiting and no other loader, the nearest between equals; or null. */
function nextTruck(state, loader) {
  const held = new Set(state.loaders.filter((other) => other !== loader && (other.order !== null || other.walking)).map((other) => other.truck));
  const here = state.trucks[loader.truck].dock;
  const open = state.trucks.map((truck, i) => ({ truck, i })).filter(({ truck, i }) => humanLoads(state, truck) && !held.has(i) && waitingFor(state, i).length > 0);
  open.sort((a, b) => a.truck.at - b.truck.at || steps(here, a.truck.dock) - steps(here, b.truck.dock) || a.i - b.i);
  return open[0]?.i ?? null;
}

/** `loader` takes `order` off its cell and into the truck, `loadTurns` from now. */
function startLoading(state, loader, order) {
  release(state, order);
  Object.assign(order, { status: "loading", loader: loader.id });
  Object.assign(loader, { order: order.id, until: state.t + (state.setup.loadTurns ?? WAREHOUSE.loadTurns) });
  state.log.push({ t: state.t, type: "loading", loader: loader.id, order: order.id });
}

/** A free `loader`: a pallet of its truck, or off to another truck (arrived at once when it is the same dock). */
function freeLoader(state, loader) {
  const mine = state.loaders.every((other) => other === loader || other.truck !== loader.truck || (other.order === null && !other.walking));
  const waiting = mine ? waitingFor(state, loader.truck) : [];
  if (waiting.length > 0) return startLoading(state, loader, nextPallet(state, waiting));
  const next = nextTruck(state, loader);
  if (next === null) return;
  const walk = steps(state.trucks[loader.truck].dock, state.trucks[next].dock);
  Object.assign(loader, { truck: next, walking: walk > 0, until: walk > 0 ? state.t + walk : null });
  state.log.push({ t: state.t, type: "loaderTo", loader: loader.id, truck: next + 1 });
  if (walk === 0) freeLoader(state, loader);
}

/** What ends now: a pallet in its truck, or a walk to a dock. */
function finish(state, loader) {
  if (loader.until !== state.t) return;
  if (loader.walking) Object.assign(loader, { walking: false, until: null });
  else {
    const order = state.orders.find((one) => one.id === loader.order);
    deliver(state, order, state.t);
    state.log.push({ t: state.t, type: "loaded", loader: loader.id, order: order.id });
    Object.assign(loader, { order: null, until: null });
  }
}

/** The loaders' busy and walking turns, and the most pallets waiting at a dock so far. */
function count(state) {
  for (const loader of state.loaders) {
    loader.busy += Number(loader.order !== null);
    loader.walked += Number(loader.walking);
  }
  const lane = Math.max(0, ...state.trucks.map((truck, i) => (humanLoads(state, truck) ? waitingFor(state, i).length : 0)));
  state.laneMax = Math.max(state.laneMax ?? 0, lane);
}

/** The loaders' turn: what ends now, then each free one to its next pallet; their turns counted. */
export function loadTrucks(state) {
  if (!state.loaders?.length) return;
  for (const loader of state.loaders) finish(state, loader);
  for (const loader of state.loaders) if (loader.order === null && !loader.walking) freeLoader(state, loader);
  count(state);
}

/** The loaders' measures: their busy share of the day so far, their walking turns, the most pallets waiting at a dock. */
export function loaderMeasures(state) {
  if (!state.loaders?.length) return {};
  const busy = state.loaders.reduce((sum, loader) => sum + loader.busy, 0);
  return { loaderBusy: state.t > 0 ? busy / (state.t * state.loaders.length) : 0, loaderWalk: state.loaders.reduce((sum, loader) => sum + loader.walked, 0), laneMax: state.laneMax ?? 0 };
}
