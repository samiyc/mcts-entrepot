import { arrivalMeasures } from "./day-arrivals.js";
import { truckOf } from "./day-basics.js";
import { kitMeasures } from "./day-kits.js";
import { loaderMeasures } from "./day-loaders.js";

/** A day's measures (simulate.js, split on 26/10/2026 for the lint budget). */

/** The turn `truck` left with its last pallet: its arrival when it has none, the horizon when one is still missing. */
function leftAt(state, truck) {
  const mine = state.orders.filter((order) => order.truck === truck.id - 1);
  if (mine.length === 0) return truck.at;
  if (mine.some((order) => order.status !== "delivered")) return state.setup.horizon;
  return Math.max(...mine.map((order) => order.deliveredAt));
}

/**
 * The day's measures: orders delivered by the horizon, the turn the last one was (the horizon when some are
 * left: the score a rule should keep low), the mean delivery turn, the robots' moves and waits, the legs
 * planned again after a blockage was seen, and the turns a robot ran into one; the turns trucks waited at
 * their dock for their last pallet (`truckWait`, summed), and the orders ready on a bay before their truck.
 */
export function measuresOf(state) {
  const delivered = state.orders.filter((order) => order.status === "delivered");
  const all = delivered.length === state.orders.length;
  return {
    orders: state.orders.length,
    delivered: delivered.length,
    finish: all ? Math.max(0, ...delivered.map((order) => order.deliveredAt)) : state.setup.horizon,
    meanDelivery: delivered.length ? delivered.reduce((sum, order) => sum + order.deliveredAt, 0) / delivered.length : state.setup.horizon,
    moves: state.robots.reduce((sum, robot) => sum + robot.moves, 0),
    waits: state.robots.reduce((sum, robot) => sum + robot.waits, 0),
    replans: state.replans,
    stuck: state.stuck,
    // The assembly stations (day-kits.js) are docks, not trucks: they wait for nothing.
    truckWait: state.trucks.reduce((sum, truck) => sum + (truck.station ? 0 : Math.max(0, leftAt(state, truck) - truck.at)), 0),
    early: state.orders.filter((order) => order.stagedAt !== null && order.stagedAt < truckOf(state, order).at).length,
    relays: state.relays ?? 0,
    blocked: state.day.blockages.length > 0,
    blockages: state.day.blockages.filter((blockage) => blockage.from <= state.t).length,
    seenAt: state.known.seenAt,
    ...arrivalMeasures(state),
    ...kitMeasures(state),
    ...loaderMeasures(state),
  };
}
