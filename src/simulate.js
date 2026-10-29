import { createReservations } from "mcts-commun/grid.js";
import { createRng } from "mcts-commun/random.js";
import { arriveOrders, drawArrivals } from "./day-arrivals.js";
import { choose, nextChoice } from "./day-choice.js";
import { assemble, drawWorks, kitOrders, kitsOf, stationTrucks } from "./day-kits.js";
import { loadTrucks, loadersOf } from "./day-loaders.js";
import { measuresOf } from "./day-measures.js";
import { homesOf } from "./day-spots.js";
import { arrive, discover, finishActions, load, move, retry } from "./day-turn.js";
import { readWarehouse } from "./warehouse.js";

export { choose, nextChoice, measuresOf };

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
 * **Relays** (Sami, 23/10: two robots stuck nose to nose in a narrow aisle). A robot with a pallet stuck in front of
 * an empty one nearer its truck sets the pallet down where it stands, a waiting cell for a moment; it goes back to
 * fetch what the other was to fetch, and the other carries the pallet on: the robot nearest the truck makes the
 * short trips. `setup.relay: false` turns it off.
 *
 * What the day hides (`drawDay`): whether the `~` cells get blocked, and when. A robot sees it only beside
 * them; then every robot knows, and keeps away from them for a blockage's length. It happens again and again in a
 * day (`blocking`: the share of the time it is blocked).
 *
 * The parts of a day live beside it since 26/10/2026 (the lint budget): `day-basics.js`, `day-spots.js` (where robots
 * start and wait), `day-ways.js` (no pallet shut in), `day-legs.js` (paths and reservations), `day-bays.js`,
 * `day-queues.js` (the trucks' turns), `day-relays.js`, `day-turn.js` and `day-choice.js` (what a robot may take).
 */

/**
 * What the day hides, drawn from a seed: the blockages (`[{ from, to }]`, turns). The `~` aisle is blocked again
 * and again (Sami, 23/10: it was once a day at most), `duration` turns each time, with free spells between drawn at
 * random so that it is blocked `blocking` of the time on average (1: always). Then the day's orders (`drawOrders`).
 */
export function drawDay(seed, setup) {
  const rng = createRng(seed);
  const blockages = drawBlockages(rng, setup, 1);
  // The orders' arrivals (day-arrivals.js), then the kits' works (day-kits.js), drawn after the blockages: a day without them draws as before.
  const arrivals = setup.arrivals ? { arrivals: drawArrivals(rng, setup, setup.orders.replaceAll("/", "").length) } : {};
  return { blockages, ...arrivals, ...(setup.kits ? { works: drawWorks(rng, setup.kits) } : {}), ...drawOrders(rng, setup) };
}

/**
 * The day's orders (Sami, 29/10/2026: more variety from one day to the next), drawn last, the blockages as before:
 * each one a block of the plan's list drawn at random, each truck keeping its count. `drawOrders: false` keeps the
 * list as written.
 */
function drawOrders(rng, setup) {
  const blocks = [...new Set(setup.orders.replaceAll("/", ""))].sort();
  if (setup.drawOrders === false || !blocks.length) return {};
  return { orders: setup.orders.split("/").map((group) => [...group].map(() => blocks[rng.int(blocks.length)]).join("")).join("/") };
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

/** The day's trucks: its orders split by `/`, one group a dock, each truck with its arrival turn. */
function trucksOf(setup, list, warehouse) {
  const groups = list.split("/");
  if (groups.length > warehouse.docks.length) throw new Error(`${groups.length} camions pour ${warehouse.docks.length} quai${warehouse.docks.length > 1 ? "s" : ""} (T) sur le plan`);
  return groups.map((blocks, i) => ({ id: i + 1, dock: warehouse.docks[i], at: setup.trucks?.[i] ?? 0, blocks, loaders: {} }));
}

/** What the day hides, as a day keeps it: older callers give one `blockage` (or none), read as a list. */
const keptDay = ({ arrivals, works, orders, blockages, blockage }) => ({ ...(arrivals ? { arrivals } : {}), ...(works ? { works } : {}), ...(orders ? { orders } : {}), blockages: blockages ?? (blockage ? [blockage] : []) });

/** The start of a day: robots at their charging point (or near the first dock), orders open, nothing known of the blockage. */
export function createDay(setup, day) {
  const warehouse = readWarehouse(setup.text, { autoZones: setup.autoZones !== false });
  const list = day.orders ?? setup.orders;
  const docked = trucksOf(setup, list, warehouse);
  const trucks = [...docked, ...stationTrucks(setup, warehouse, docked.length)];
  for (const block of new Set(list.replaceAll("/", ""))) if (!warehouse.blocks.get(block)?.length) throw new Error(`commande ${block} : pas de bloc ${block} accessible sur le plan`);
  const homes = homesOf(warehouse, setup.robots);
  day = keptDay(day);
  const orders = docked.flatMap((truck) => [...truck.blocks].map((block) => ({ block, truck: truck.id - 1 }))).map(({ block, truck }, i) => ({ id: i + 1, block, truck, status: day.arrivals?.[i] > 0 ? "pending" : "open", robot: null, deliveredAt: null, stagedAt: null, cell: null }));
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
    orders: [...orders, ...kitOrders(setup, trucks, orders.length + 1)],
    kits: kitsOf(setup),
    // The dock loaders (day-loaders.js): they take the pallets into the trucks.
    loaders: loadersOf(setup, trucks),
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

/** The start of a turn, up to the robots' choices: blockages seen, legs retried, picks and drops ended. */
export function beginTurn(state) {
  arriveOrders(state);
  assemble(state);
  discover(state);
  retry(state);
  load(state);
  finishActions(state);
  loadTrucks(state);
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
    kits: state.kits?.map((kit) => ({ ...kit })) ?? null,
    loaders: state.loaders?.map((loader) => ({ ...loader })) ?? [],
    reservations: state.reservations.clone(),
    log: [],
  };
}

/** A whole day of `setup` (plans.js) from `seed` under `rule`: the final state and its measures. */
export function runDay(setup, seed, rule) {
  const state = createDay(setup, drawDay(seed, setup));
  while (!isOver(state)) stepDay(state, rule);
  return { state, measures: measuresOf(state) };
}