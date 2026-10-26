import { LINE } from "./line-hypotheses.js";
import { usageOf } from "./line-models.js";
import { LINE_PLANS } from "./line-plan.js";
import { LINE_RULES } from "./line-rules.js";
import { isOver as lineOver, measuresOfLine, startLine, stepDay as stepLine } from "./line.js";
import { PLANS } from "./plans.js";
import { RULES } from "./rules.js";
import { beginTurn, choose, createDay, drawDay, endTurn, measuresOf, nextChoice } from "./simulate.js";

/**
 * The plant (Sami, 26/10/2026; docs/recherche/feuille-de-route.md: the warehouse and the line's supermarket played
 * together): the assembly line and the warehouse on one clock, a turn of 5 s in both. When the supermarket orders a
 * reference (line-supermarket.js, `source: "warehouse"`), the order arrives in the warehouse during its day, fetched
 * from the block of the same letter; once its pallet is brought to the warehouse's dock, the shuttle takes `transport`
 * turns to the supermarket, which is full again. Each keeps its own robots and its own rule (the line's given, the
 * warehouse's in `setup.warehouseRule`).
 */

/**
 * The vehicles the line can still make before it stops for reference `ref`: its pieces on the line side and the full bins
 * at the supermarket, over what each vehicle takes of it (its lanes, the share of the known vehicles that use it).
 */
export function vehiclesLeft(line, ref) {
  const lanes = line.lanes.filter((lane) => lane.ref === ref);
  const pieces = lanes.reduce((sum, lane) => sum + lane.pieces + lane.full * line.setup.binPieces, 0) + line.stock[ref] * line.setup.binPieces;
  return pieces / (usageOf(line, ref) * Math.max(1, lanes.length));
}

/** The order whose `key` is smallest, the nearest between equals. */
const leastBy = (key) => (robot, open, { reach, state }) => open.reduce((best, order) => (key(state, order) < key(state, best) || (key(state, order) === key(state, best) && reach(order) < reach(best)) ? order : best));

/**
 * The warehouse's rules in the plant: the warehouse's own, and two that look at the line (Sami, 26/10/2026: what linking
 * the two is for): `urgent`, the order whose reference the supermarket holds the fewest bins of first; `lineCover`,
 * the one the line will stop for first, its line side counted with its stock. The nearest between equals.
 */
export const WAREHOUSE_RULES = Object.freeze({
  ...RULES,
  urgent: leastBy((state, order) => state.plantLine.stock[order.block]),
  lineCover: leastBy((state, order) => vehiclesLeft(state.plantLine, order.block)),
});
export const WAREHOUSE_RULE_LABELS = Object.freeze({
  list: "dans l'ordre des commandes",
  nearest: "la plus proche",
  farthest: "la plus lointaine d'abord",
  truck: "le camion attendu d'abord",
  urgent: "la plus urgente pour la ligne",
  lineCover: "la couverture de la ligne",
});

/** The warehouse's seed beside the line's: drawn apart, so that the two days do not share their draws. */
const WAREHOUSE_SEED = 100_000;

/** The start of a plant's hour: the line with its supermarket, the warehouse with no order yet. */
export function startPlant(setup, seed) {
  const line = startLine(setup.line, seed);
  const warehouseSetup = { ...setup.warehouse, horizon: setup.line.horizon };
  const warehouse = createDay(warehouseSetup, drawDay(seed + WAREHOUSE_SEED, warehouseSetup));
  // The warehouse's rules may look at the line (`urgent`).
  warehouse.plantLine = line;
  return { kind: "usine", setup, line, warehouse, t: 0, seen: 0, sent: new Map(), cursor: null };
}

/** The supermarket's new orders, into the warehouse's day: an open order for the block of the same letter. */
function sendOrders(state) {
  const { line, warehouse } = state;
  for (const order of line.outbox.splice(0)) {
    const id = warehouse.orders.length + 1;
    warehouse.orders.push({ id, block: order.block, truck: 0, status: "open", robot: null, deliveredAt: null, stagedAt: null, cell: null, arrivedAt: warehouse.t });
    state.sent.set(id, order);
    warehouse.log.push({ t: warehouse.t, type: "arrived", order: id });
  }
}

/**
 * When a pallet brought to the dock at `t` reaches the supermarket: `transport` turns later, after the shuttle's next
 * departure when it leaves at fixed times (`setup.shuttleEvery`, the research's hint: a train on a timetable).
 */
const arrivalOf = (setup, t) => (setup.shuttleEvery ? Math.ceil(t / setup.shuttleEvery) * setup.shuttleEvery : t) + setup.transport;

/** The pallets brought to the warehouse's dock since last turn: on the shuttle, at the supermarket when it gets there. */
function shipPallets(state) {
  const { warehouse } = state;
  for (const event of warehouse.log.slice(state.seen)) {
    if (event.type !== "delivered" && event.type !== "loaded") continue;
    const order = state.sent.get(event.order);
    if (order) order.at = arrivalOf(state.setup, event.t);
  }
  state.seen = warehouse.log.length;
}

/** The first half of a plant's turn: the orders sent, a turn of the line under `rule`, its new orders sent, the warehouse's turn begun. */
function beginPlantTurn(state, rule) {
  sendOrders(state);
  stepLine(state.line, rule);
  sendOrders(state);
  beginTurn(state.warehouse);
}

/** The end of a plant's turn: the warehouse's robots moved, the pallets shipped, the clock. */
function endPlantTurn(state) {
  endTurn(state.warehouse);
  shipPallets(state);
  state.t = state.line.t;
}

/** What a warehouse rule is shown and given, as in simulate.js, and the plant (the plant's search reads it). */
const ask = (state, choice, rule) => rule({ id: choice.robot.id, x: choice.robot.x, y: choice.robot.y }, choice.open, { t: state.t, reach: choice.reach, state: state.warehouse, plant: state })?.id;

/** One turn of the plant: the line under `rule`, the warehouse under `warehouseRule` (by default the setup's), the pallets shipped. */
export function stepPlant(state, rule, warehouseRule = WAREHOUSE_RULES[state.setup.warehouseRule]) {
  if (state.warehouse.cursor === null) beginPlantTurn(state, rule);
  for (let choice = nextChoice(state.warehouse); choice; choice = nextChoice(state.warehouse)) choose(state.warehouse, choice, ask(state, choice, warehouseRule));
  endPlantTurn(state);
  return state;
}

export const isPlantOver = (state) => lineOver(state.line);

/** `choice` of the warehouse takes order `id` (a replay, the search). */
export const choosePlant = (state, choice, id) => choose(state.warehouse, choice, id);

/**
 * The plant played, the line under `rule`, to the warehouse's next choice: `{ robot, open, reach }`, or null once the
 * hour is over (or at `state.limit`, the search's worlds).
 */
export function advancePlant(state, rule) {
  for (;;) {
    if (state.warehouse.cursor === null) {
      if (isPlantOver(state) || state.t >= (state.limit ?? Infinity)) return null;
      beginPlantTurn(state, rule);
    }
    const choice = nextChoice(state.warehouse);
    if (choice) return choice;
    endPlantTurn(state);
  }
}

/**
 * The plant's measures: the line's (its stop first), and the warehouse's side: the orders it received and brought, and
 * the mean turns from the supermarket's order to its stock full again.
 */
export function measuresOfPlant(state) {
  const back = [...state.sent.values()].filter((order) => order.at !== Infinity && order.at <= state.line.t);
  const warehouse = measuresOf(state.warehouse);
  return {
    ...measuresOfLine(state.line),
    warehouseOrders: state.warehouse.orders.length,
    warehouseDelivered: warehouse.delivered,
    supplyLead: back.length ? back.reduce((sum, order) => sum + order.at - order.orderedAt, 0) / back.length : 0,
    warehouseMoves: warehouse.moves,
  };
}

/** A whole hour of the plant from `seed`, the line under `rule`, the warehouse under `warehouseRule`: the final state and its measures. */
export function runPlant(setup, seed, rule, warehouseRule = WAREHOUSE_RULES[setup.warehouseRule]) {
  const state = startPlant(setup, seed);
  while (!isPlantOver(state)) stepPlant(state, rule, warehouseRule);
  return { state, measures: measuresOfPlant(state) };
}

/**
 * The plants to start with: Sami's line and its tight supermarket (3 bins a reference, an order at 1), fed by Sami's
 * warehouse (12 blocks, 4 robots, its dock the shuttle to the supermarket), 5 minutes of shuttle (a hypothesis).
 */
const line = { ...LINE_PLANS.supermarche, supermarket: { ...LINE_PLANS.supermarche.supermarket, source: "warehouse" } };
const warehouse = { ...PLANS.sami, orders: "" };
export const PLANT_PLANS = Object.freeze({
  usine: Object.freeze({ label: "L'usine : la ligne de Sami et son supermarché, servi par l'entrepôt de Sami (4 robots)", line, warehouse, transport: LINE.shuttle, warehouseRule: "list" }),
  vite: Object.freeze({ label: "L'usine, le supermarché commandé à 2 bacs", line: { ...line, supermarket: { ...line.supermarket, reorder: 2 } }, warehouse, transport: LINE.shuttle, warehouseRule: "list" }),
  // The shuttle on a timetable (26/10/2026, docs/recherche/hypotheses.md): a departure every 20 minutes, 5 of ride.
  train: Object.freeze({ label: "L'usine, la navette à heure fixe (un départ toutes les 20 minutes)", line, warehouse, transport: LINE.shuttle, shuttleEvery: LINE.shuttleEvery, warehouseRule: "list" }),
});

export { LINE_RULES as PLANT_RULES };
