import { isBlock } from "../src/warehouse.js";

/**
 * What the page shows of a day, pure and tested under Node (tests/view.test.js): the cells to draw, each
 * block's pending orders, the robots with what is left of their leg, the day in one line. The DOM layer
 * (app.js) only draws it.
 */
export const STATUS_LABELS = Object.freeze({ open: "en attente", assigned: "attribuée", carried: "en route vers le quai", staged: "prête devant le quai", toTruck: "un robot vient la charger", delivered: "livrée" });
const PHASE_LABELS = Object.freeze({ idle: "libre", toPick: "va chercher", picking: "prend", toDrop: "rapporte", dropping: "dépose", home: "rentre", relay: "attend un relais" });

/** The trucks: `{ id, x, y, at, there, left }`, `left` the orders not yet loaded. */
export function trucksOf(state) {
  return state.trucks.map((truck) => ({
    id: truck.id,
    x: truck.dock.x,
    y: truck.dock.y,
    at: truck.at,
    there: state.t >= truck.at,
    left: state.orders.filter((order) => order.truck === truck.id - 1 && order.status !== "delivered").length,
  }));
}

/** The blockage as the page tells it: none, coming (hidden), on and not yet seen, on and seen, over. */
export function blockageOf(state) {
  const now = state.day.blockages.some((blockage) => state.t >= blockage.from && state.t < blockage.to);
  // Seen: the robots know it (the one they saw, still on for them).
  return { now, seen: now && state.known.seenAt !== null && state.t <= state.known.blockedUntil };
}

const found = (map, key) => map.get(key) ?? null;
const plural = (count) => (count > 1 ? "s" : "");

/** A cell that is neither a dock, a bay nor plain floor: a charging point, the `~` aisle, a block, a wall. */
function otherCell(ctx, char, x, y) {
  if (char === "c") return { x, y, kind: "charge" };
  if (char === "~") return { x, y, kind: "blockable" };
  if (isBlock(char)) return { x, y, kind: "block", letter: char, pending: ctx.pending.get(char) ?? 0 };
  return { x, y, kind: "wall" };
}

function cellAt(ctx, x, y) {
  const char = ctx.plan.at(x, y);
  const key = `${x},${y}`;
  if (char === "T") return { x, y, kind: "dock", truck: found(ctx.trucks, key) };
  if (char === "w" || ctx.autoBay.has(key)) return { x, y, kind: "bay", pallet: found(ctx.pallets, key), auto: char !== "w" };
  if (char === ".") return { x, y, kind: "floor", home: found(ctx.homes, key), pallet: found(ctx.pallets, key) };
  return otherCell(ctx, char, x, y);
}

/**
 * Every cell to draw: `{ x, y, kind, letter, pending, pallet, truck }`, kind floor, block, dock, bay, charge,
 * blockable or wall; a bay cell with the block of the pallet waiting there, a dock with its truck; a floor cell
 * with the pallet left there for a relay (Sami, 23/10: a waiting cell for a moment).
 */
export function cellsOf(state) {
  const { plan } = state.warehouse;
  const pending = new Map();
  for (const order of state.orders) if (order.status !== "delivered") pending.set(order.block, (pending.get(order.block) ?? 0) + 1);
  const pallets = new Map(state.orders.filter((order) => (order.status === "staged" || order.status === "toTruck") && order.cell).map((order) => [`${order.cell.x},${order.cell.y}`, order.block]));
  const trucks = new Map(trucksOf(state).map((truck) => [`${truck.x},${truck.y}`, truck]));
  // Waiting zones made at the start for trucks the plan gave none.
  const autoBay = new Set(state.warehouse.docks.filter((dock) => dock.auto).flatMap((dock) => dock.bay.map((cell) => `${cell.x},${cell.y}`)));
  // Where each robot starts and goes back to, when it is not a charging point.
  const homes = new Map(state.robots.filter((robot) => plan.at(robot.home.x, robot.home.y) !== "c").map((robot) => [`${robot.home.x},${robot.home.y}`, robot.id]));
  const ctx = { plan, pending, pallets, trucks, autoBay, homes };
  const rows = Array.from({ length: plan.height }, (_, y) => y);
  return rows.flatMap((y) => Array.from({ length: plan.width }, (__, x) => cellAt(ctx, x, y)));
}

/** The truck `robot` loads, while it has pallets left; or undefined. */
const loadingOf = (state, robot) => state.trucks.find((truck) => Object.values(truck.loaders).includes(robot.id) && state.orders.some((one) => one.truck === truck.id - 1 && one.status !== "delivered"));
/** The zone `robot` loads, when its truck has more than one. */
function zoneText(loading, robot) {
  if (loading.dock.zones.length <= 1) return "";
  const zone = Number(Object.entries(loading.loaders).find(([, id]) => id === robot.id)[0]) + 1;
  return `, zone ${zone}`;
}
function orderText(state, order) {
  const truck = state.trucks.length > 1 ? `, camion ${order.truck + 1}` : "";
  return ` (commande ${order.id}, bloc ${order.block}${truck})`;
}
function robotLabel(state, robot, order) {
  const loading = loadingOf(state, robot);
  const parts = [`Robot ${robot.id}`];
  if (loading) parts.push(` (charge le camion ${loading.id}${zoneText(loading, robot)})`);
  if (robot.queued) parts.push(", attend son tour au camion");
  parts.push(` : ${PHASE_LABELS[robot.phase]}`);
  if (order) parts.push(orderText(state, order));
  return parts.join("");
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
      label: robotLabel(state, robot, order),
      ahead: robot.target ? (robot.path ?? []).filter((step) => step.t >= state.t) : [],
    };
  });
}

function corridorText(state) {
  const blockage = blockageOf(state);
  if (!blockage.now) return "allées libres";
  return blockage.seen ? `allée bloquée (vue au tour ${state.known.seenAt})` : "allée bloquée, pas encore vue";
}
function truckText(truck) {
  if (truck.left === 0) return `camion ${truck.id} parti`;
  return truck.there ? `camion ${truck.id} à quai` : `camion ${truck.id} au tour ${truck.at}`;
}
function measuresText(state, measures) {
  const docks = state.trucks.length > 1 ? [`${measures.truckWait} tours à quai pour les camions`] : [];
  return [`fini au tour ${measures.finish}`, ...docks, `${measures.moves} pas, ${measures.waits} attente${plural(measures.waits)}`];
}

/** The day in one line. */
export function statusLine(state, measures) {
  const delivered = state.orders.filter((order) => order.status === "delivered").length;
  const parts = [`Tour ${state.t} / ${state.setup.horizon}`, `${delivered} / ${state.orders.length} commandes livrées`];
  const staged = state.orders.filter((order) => order.status === "staged" || order.status === "toTruck").length;
  if (staged > 0) parts.push(`${staged} prête${plural(staged)} devant les quais`);
  if (state.trucks.some((truck) => truck.at > 0)) parts.push(trucksOf(state).map(truckText).join(", "));
  parts.push(corridorText(state));
  if (measures) parts.push(...measuresText(state, measures));
  return parts.join(" · ");
}

/** The orders, in their order, with their state. */
export function ordersOf(state) {
  return state.orders.map((order) => ({
    id: order.id,
    block: order.block,
    status: order.status,
    truck: state.trucks.length > 1 ? order.truck + 1 : null,
    label: STATUS_LABELS[order.status] + (order.robot ? `, robot ${order.robot}` : "") + (order.deliveredAt === null ? "" : ` au tour ${order.deliveredAt}`),
  }));
}
