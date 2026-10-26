import { isShortNow } from "./line-day.js";
import { usageOf } from "./line-models.js";

/**
 * The supermarket fed from the warehouse (Sami, 26/10/2026; docs/recherche/feuille-de-route.md, step 2): each reference
 * has a stock of full bins (`setup.supermarket.bins`), which every robot sees, as a warehouse system shows it. When it
 * falls to `reorder`, an order leaves for the warehouse; the bins come back after a lead time drawn between the bounds
 * of `lead`, which nobody knows (the search draws it again in each world). An empty reference is fetched by nobody; a
 * robot already there waits for the bins, as for a supplier shortage. Without `setup.supermarket`, the stock is
 * endless, as in step 1.
 *
 * The warehouse as a queue of pickers (`supermarket.warehouse`, `{ pickers, transport }`, a step towards playing the
 * warehouse itself): an order waits for a free picker, takes its drawn time (`lead`), then `transport` turns to come;
 * many references ordering together make the leads longer.
 */

/** The lead times of the day's orders, drawn in their order (a few more than an hour can need). */
export function drawLeads(rng, setup, count = 400) {
  const [shortest, longest] = setup.supermarket.lead;
  return Array.from({ length: count }, () => shortest + rng.int(longest - shortest + 1));
}

/** The turns each picker of the warehouse is free from (all now), or null without a queue of pickers. */
export const pickersOf = (setup) => (setup.supermarket?.warehouse ? Array.from({ length: setup.supermarket.warehouse.pickers }, () => 0) : null);

/** When an order placed now with `prep` turns of work starts and comes back: at once without a queue, else at the first free picker. */
function schedule(state, prep) {
  const warehouse = state.setup.supermarket.warehouse;
  if (!warehouse) return { start: state.t, at: state.t + prep };
  const i = state.pickersFree.indexOf(Math.min(...state.pickersFree));
  const start = Math.max(state.t, state.pickersFree[i]);
  state.pickersFree[i] = start + prep;
  return { start, at: start + prep + warehouse.transport };
}

/** The stock at the start: every reference full. */
export const stockOf = (setup) => (setup.supermarket ? Object.fromEntries([...new Set(setup.refs.replaceAll("/", ""))].map((ref) => [ref, setup.supermarket.bins])) : null);

/** Is there no full bin of `block` to take now: a supplier shortage, or the supermarket's stock out? */
export const isEmptyAt = (state, block) => isShortNow(state, block) || state.stock?.[block] === 0;

/** Does everyone know `block` out of stock (the stock is seen; a shortage only once a robot came)? */
export const knownOut = (state, block) => state.stock?.[block] === 0;

/**
 * The turns the stock of `block` lasts at the line's pace: its pieces over what the stations taking it use a turn (each
 * station a piece a takt, times the share of the vehicles known to come that take it).
 */
function turnsLeft(state, block) {
  const stations = state.lanes.filter((lane) => lane.ref === block).length;
  const perTurn = (stations * usageOf(state, block)) / state.setup.takt;
  return (state.stock[block] * state.setup.binPieces) / Math.max(perTurn, 1e-9);
}

/**
 * Does `block` need an order to the warehouse (Sami, 26/10/2026: the reorder point as a decision)? `policy` "point"
 * (the default): its stock fell to `reorder` bins. "cover": its stock no longer lasts the warehouse's mean lead time
 * at the line's pace (the queue of pickers counted when there is one), so a reference many stations take orders sooner,
 * one few take later.
 */
export function needsOrder(state, block) {
  const { policy = "point", reorder } = state.setup.supermarket;
  if (policy === "cover") return turnsLeft(state, block) < expectedLead(state);
  return state.stock[block] <= reorder;
}

/** The lead an order placed now should take: the mean work, and with a queue of pickers the wait for one and the way back. */
function expectedLead(state) {
  const { lead, warehouse } = state.setup.supermarket;
  const work = (lead[0] + lead[1]) / 2;
  if (!warehouse) return work;
  return Math.max(0, Math.min(...state.pickersFree) - state.t) + work + warehouse.transport;
}

/** A full bin of `block` taken: one less in stock, and an order to the warehouse when it falls to the reorder point. */
export function takeFromStock(state, block) {
  if (!state.stock) return;
  state.stock[block] -= 1;
  if (!needsOrder(state, block) || state.restocks.some((one) => one.block === block)) return;
  const k = state.ordered;
  state.ordered += 1;
  state.restocks.push({ block, orderedAt: state.t, ...schedule(state, state.day.leads[k % state.day.leads.length]) });
  state.log.push({ t: state.t, type: "ordered", block });
}

/** The orders from the warehouse come in: the reference full again; the stock held this turn counted. */
export function restock(state) {
  if (!state.stock) return;
  state.stockHeld = (state.stockHeld ?? 0) + Object.values(state.stock).reduce((sum, count) => sum + count, 0);
  for (const order of state.restocks.filter((one) => one.at <= state.t)) {
    state.stock[order.block] = state.setup.supermarket.bins;
    state.log.push({ t: state.t, type: "restockedFromWarehouse", block: order.block });
  }
  state.restocks = state.restocks.filter((one) => one.at > state.t);
}

/**
 * A world's orders: those under way come back after a lead drawn again (later than now), the ones after drawn afresh;
 * with a queue of pickers, each order under way keeps its start and the pickers are free again after the redrawn work.
 */
export function worldRestocks(state, rng) {
  if (!state.stock) return { restocks: state.restocks, leads: state.day.leads, pickersFree: state.pickersFree };
  const leads = drawLeads(rng, state.setup);
  const warehouse = state.setup.supermarket.warehouse;
  const transport = warehouse?.transport ?? 0;
  const restocks = state.restocks.map((one, i) => ({ ...one, at: Math.max(state.t + 1, one.start + leads[i] + transport) }));
  const pickersFree = warehouse ? pickersAfter(state.pickersFree.length, restocks, leads) : null;
  return { restocks, leads: [...state.day.leads.slice(0, state.ordered), ...leads], pickersFree };
}

/** The pickers' free turns after the orders under way, their work redrawn (`leads`, in the orders' order). */
function pickersAfter(count, restocks, leads) {
  const free = Array.from({ length: count }, () => 0);
  restocks.forEach((one, i) => {
    const j = free.indexOf(Math.min(...free));
    free[j] = Math.max(free[j], one.start + leads[i]);
  });
  return free;
}
