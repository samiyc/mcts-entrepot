import { isBlock } from "../src/warehouse.js";

/**
 * What the page shows of a day, pure and tested under Node (tests/view.test.js): the cells to draw, each
 * block's pending orders, the robots with what is left of their leg, the day in one line. The DOM layer
 * (app.js) only draws it.
 */
export const STATUS_LABELS = Object.freeze({ open: "en attente", assigned: "attribuée", carried: "en route vers le camion", delivered: "livrée" });
const PHASE_LABELS = Object.freeze({ idle: "libre", toPick: "va chercher", picking: "prend", toDrop: "rapporte", dropping: "dépose", home: "rentre" });

/** The blockage as the page tells it: none, coming (hidden), on and not yet seen, on and seen, over. */
export function blockageOf(state) {
  const blockage = state.day.blockage;
  if (!blockage || state.t < blockage.from) return { now: false, seen: false };
  const now = state.t < blockage.to;
  return { now, seen: state.known.seenAt !== null };
}

/** Every cell to draw: `{ x, y, kind, letter, pending }`, kind floor, block, dock, blockable or wall. */
export function cellsOf(state) {
  const { plan } = state.warehouse;
  const pending = new Map();
  for (const order of state.orders) if (order.status !== "delivered") pending.set(order.block, (pending.get(order.block) ?? 0) + 1);
  const cells = [];
  for (let y = 0; y < plan.height; y += 1) {
    for (let x = 0; x < plan.width; x += 1) {
      const char = plan.at(x, y);
      if (char === "T") cells.push({ x, y, kind: "dock" });
      else if (char === "~") cells.push({ x, y, kind: "blockable" });
      else if (char === ".") cells.push({ x, y, kind: "floor" });
      else if (isBlock(char)) cells.push({ x, y, kind: "block", letter: char, pending: pending.get(char) ?? 0 });
      else cells.push({ x, y, kind: "wall" });
    }
  }
  return cells;
}

/** The robots: where they are, what they carry, what they do, and the cells left on their leg. */
export function robotsOf(state) {
  return state.robots.map((robot) => {
    const order = state.orders.find((one) => one.id === robot.order);
    return {
      id: robot.id,
      x: robot.x,
      y: robot.y,
      carrying: order?.status === "carried" ? order.block : null,
      label: `Robot ${robot.id} : ${PHASE_LABELS[robot.phase]}${order ? ` (commande ${order.id}, bloc ${order.block})` : ""}`,
      ahead: robot.target ? (robot.path ?? []).filter((step) => step.t >= state.t) : [],
    };
  });
}

/** The day in one line. */
export function statusLine(state, measures) {
  const delivered = state.orders.filter((order) => order.status === "delivered").length;
  const blockage = blockageOf(state);
  const corridor = state.day.blockage && blockage.now ? `allée bloquée${blockage.seen ? ` (vue au tour ${state.known.seenAt})` : ", pas encore vue"}` : "allées libres";
  const parts = [`Tour ${state.t} / ${state.setup.horizon}`, `${delivered} / ${state.orders.length} commandes livrées`, corridor];
  if (measures) parts.push(`fini au tour ${measures.finish}`, `${measures.moves} pas, ${measures.waits} attente${measures.waits > 1 ? "s" : ""}`);
  return parts.join(" · ");
}

/** The orders, in their order, with their state. */
export function ordersOf(state) {
  return state.orders.map((order) => ({
    id: order.id,
    block: order.block,
    status: order.status,
    label: STATUS_LABELS[order.status] + (order.robot ? `, robot ${order.robot}` : "") + (order.deliveredAt === null ? "" : ` au tour ${order.deliveredAt}`),
  }));
}
