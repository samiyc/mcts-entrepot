import { isShortNow } from "./line-day.js";

/**
 * The supermarket fed from the warehouse (Sami, 26/10/2026; docs/recherche/feuille-de-route.md, step 2): each reference
 * has a stock of full bins (`setup.supermarket.bins`), which every robot sees, as a warehouse system shows it. When it
 * falls to `reorder`, an order leaves for the warehouse; the bins come back after a lead time drawn between the bounds
 * of `lead`, which nobody knows (the search draws it again in each world). An empty reference is fetched by nobody; a
 * robot already there waits for the bins, as for a supplier shortage. Without `setup.supermarket`, the stock is
 * endless, as in step 1.
 */

/** The lead times of the day's orders, drawn in their order (a few more than an hour can need). */
export function drawLeads(rng, setup, count = 400) {
  const [shortest, longest] = setup.supermarket.lead;
  return Array.from({ length: count }, () => shortest + rng.int(longest - shortest + 1));
}

/** The stock at the start: every reference full. */
export const stockOf = (setup) => (setup.supermarket ? Object.fromEntries([...new Set(setup.refs.replaceAll("/", ""))].map((ref) => [ref, setup.supermarket.bins])) : null);

/** Is there no full bin of `block` to take now: a supplier shortage, or the supermarket's stock out? */
export const isEmptyAt = (state, block) => isShortNow(state, block) || state.stock?.[block] === 0;

/** Does everyone know `block` out of stock (the stock is seen; a shortage only once a robot came)? */
export const knownOut = (state, block) => state.stock?.[block] === 0;

/** A full bin of `block` taken: one less in stock, and an order to the warehouse when it falls to the reorder point. */
export function takeFromStock(state, block) {
  if (!state.stock) return;
  state.stock[block] -= 1;
  const { reorder } = state.setup.supermarket;
  if (state.stock[block] > reorder || state.restocks.some((one) => one.block === block)) return;
  const k = state.ordered;
  state.ordered += 1;
  state.restocks.push({ block, orderedAt: state.t, at: state.t + state.day.leads[k % state.day.leads.length] });
  state.log.push({ t: state.t, type: "ordered", block });
}

/** The orders from the warehouse come in: the reference full again. */
export function restock(state) {
  if (!state.stock) return;
  for (const order of state.restocks.filter((one) => one.at <= state.t)) {
    state.stock[order.block] = state.setup.supermarket.bins;
    state.log.push({ t: state.t, type: "restockedFromWarehouse", block: order.block });
  }
  state.restocks = state.restocks.filter((one) => one.at > state.t);
}

/** A world's orders: those under way come back after a lead drawn again (later than now), the ones after drawn afresh. */
export function worldRestocks(state, rng) {
  if (!state.stock) return { restocks: state.restocks, leads: state.day.leads };
  const leads = drawLeads(rng, state.setup);
  const restocks = state.restocks.map((one, i) => ({ ...one, at: Math.max(state.t + 1, one.orderedAt + leads[i]) }));
  return { restocks, leads: [...state.day.leads.slice(0, state.ordered), ...leads] };
}
