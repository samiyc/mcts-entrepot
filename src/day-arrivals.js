/**
 * Orders that arrive during the day (Sami, 26/10/2026; docs/modele.md, La suite, step 5): with `setup.arrivals`
 * (`{ known, every, until }`), the first `known` orders of the list are there at the start, the next ones arrive one
 * after the other, `every` turns apart on average (free spells drawn at random from the day's seed), and none after the
 * cut-off `until` (the orders of the day are in by then: the last needs time to be served). An order not arrived
 * yet (`pending`) is hidden: no rule and no robot sees it, and the search draws again, in each world, when the orders
 * to come arrive and which block each is fetched from. Without `setup.arrivals`, every order is there at the start, as
 * before.
 */

/** The turn each order of the list arrives (0: there at the start), drawn from `rng`. */
export function drawArrivals(rng, setup, count, from = 0) {
  const { known, every, until = Infinity } = setup.arrivals;
  let t = from;
  return Array.from({ length: count }, (_, i) => {
    if (i < known) return from;
    t += Math.max(1, Math.round(-every * Math.log(1 - rng.next())));
    return Math.min(t, Math.max(from, until));
  });
}

/** The orders arrived this turn: open now, and seen. */
export function arriveOrders(state) {
  if (!state.day.arrivals) return;
  for (const order of state.orders) {
    if (order.status !== "pending" || state.day.arrivals[order.id - 1] > state.t) continue;
    Object.assign(order, { status: "open", arrivedAt: state.t });
    state.log.push({ t: state.t, type: "arrived", order: order.id });
  }
}

/**
 * A world of the search: the orders still to come arrive at turns drawn again after now, each from a block drawn
 * among the plan's (its truck kept: the trucks are known, not what they will carry).
 */
export function drawWorldOrders(world, state, rng) {
  if (!state.day.arrivals) return;
  const pending = world.orders.filter((order) => order.status === "pending");
  const blocks = [...state.warehouse.blocks.keys()].filter((block) => state.warehouse.blocks.get(block).length > 0);
  const times = drawArrivals(rng, { arrivals: { ...state.setup.arrivals, known: 0 } }, pending.length, state.t);
  const arrivals = [...state.day.arrivals];
  pending.forEach((order, i) => {
    order.block = blocks[rng.int(blocks.length)];
    arrivals[order.id - 1] = times[i];
  });
  world.day.arrivals = arrivals;
}

/** What only a day with arrivals measures: the turns from an order's arrival to its delivery, on average. */
export function arrivalMeasures(state) {
  if (!state.day.arrivals) return {};
  const served = state.orders.filter((order) => order.status === "delivered");
  const response = served.length ? served.reduce((sum, order) => sum + order.deliveredAt - (order.arrivedAt ?? 0), 0) / served.length : 0;
  return { meanResponse: response, arrived: state.orders.filter((order) => order.status !== "pending").length };
}
