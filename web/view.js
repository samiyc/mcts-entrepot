import { isBlock } from "../src/warehouse.js";

/**
 * What the page shows of a day, pure and tested under Node (tests/view.test.js): the cells to draw, each
 * block's pending orders, the robots with what is left of their leg, the day in one line. The DOM layer
 * (app.js) only draws it.
 */
export const STATUS_LABELS = Object.freeze({ open: "en attente", assigned: "attribuée", carried: "en route vers le quai", staged: "prête devant le quai", toTruck: "un robot vient la charger", delivered: "livrée", pending: "pas encore arrivée", kit: "en attente de son assemblage", loading: "le chargeur la met dans le camion" });
const PHASE_LABELS = Object.freeze({ idle: "libre", toPick: "va chercher", picking: "prend", toDrop: "rapporte", dropping: "dépose", home: "rentre", relay: "attend un relais" });

/**
 * The dock loaders (day-loaders.js): `{ id, truck, walking, block, pallet, pallets }`, the truck it loads or goes to
 * (its number), the pallet it takes in (its block, and which of the truck's), or null at rest.
 */
export function loadersOf(state) {
  return (state.loaders ?? []).map((loader) => {
    const order = state.orders.find((one) => one.id === loader.order) ?? null;
    const mine = state.orders.filter((one) => one.truck === loader.truck);
    const done = mine.filter((one) => one.status === "delivered").length;
    return { id: loader.id, truck: loader.truck + 1, walking: loader.walking, block: order?.block ?? null, pallet: order ? done + 1 : null, pallets: mine.length };
  });
}

/** The trucks: `{ id, x, y, at, there, left, loader }`, `left` the orders not yet loaded, `loader` the loader there or on its way. */
export function trucksOf(state) {
  const loaders = loadersOf(state);
  // The assembly stations are docks for the robots, not trucks (day-kits.js).
  return state.trucks.filter((truck) => !truck.station).map((truck) => ({
    id: truck.id,
    x: truck.dock.x,
    y: truck.dock.y,
    at: truck.at,
    there: state.t >= truck.at,
    left: state.orders.filter((order) => order.truck === truck.id - 1 && order.status !== "delivered").length,
    loader: loaders.find((loader) => loader.truck === truck.id) ?? null,
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
  if (char === "S") return { x, y, kind: "assembly", assembly: found(ctx.stations, key) };
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
  for (const order of state.orders) if (order.status !== "delivered" && order.status !== "pending") pending.set(order.block, (pending.get(order.block) ?? 0) + 1);
  const pallets = new Map(state.orders.filter((order) => (order.status === "staged" || order.status === "toTruck") && order.cell).map((order) => [`${order.cell.x},${order.cell.y}`, order.block]));
  const trucks = new Map(trucksOf(state).map((truck) => [`${truck.x},${truck.y}`, truck]));
  // Waiting zones made at the start for trucks the plan gave none.
  const autoBay = new Set([...state.warehouse.docks, ...(state.warehouse.stations ?? [])].filter((dock) => dock.auto).flatMap((dock) => dock.bay.map((cell) => `${cell.x},${cell.y}`)));
  const stations = new Map(stationsOf(state).map((station) => [`${station.x},${station.y}`, station]));
  // Where each robot starts and goes back to, when it is not a charging point.
  const homes = new Map(state.robots.filter((robot) => plan.at(robot.home.x, robot.home.y) !== "c").map((robot) => [`${robot.home.x},${robot.home.y}`, robot.id]));
  const ctx = { plan, pending, pallets, trucks, autoBay, homes, stations };
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
/** Where an order goes, as a robot's label says it: its truck when there are several, or the assembly station. */
function goesTo(state, order) {
  if (state.trucks[order.truck]?.station) return ", pour le poste d'assemblage";
  return trucksOf(state).length > 1 ? `, camion ${order.truck + 1}` : "";
}
function orderText(state, order) {
  const truck = goesTo(state, order);
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
/** A loader at work, as the status line says it; null at rest. */
function loaderText(loader, many) {
  const who = many ? `chargeur ${loader.id}` : "chargeur";
  if (loader.walking) return `${who} : vers le camion ${loader.truck}`;
  return loader.block ? `${who} : camion ${loader.truck}, palette ${loader.pallet} / ${loader.pallets}` : null;
}
function measuresText(state, measures) {
  const docks = trucksOf(state).length > 1 ? [`${measures.truckWait} tours à quai pour les camions`] : [];
  return [`fini au tour ${measures.finish}`, ...docks, `${measures.moves} pas, ${measures.waits} attente${plural(measures.waits)}`];
}

/** The day in one line. */
export function statusLine(state, measures) {
  const delivered = state.orders.filter((order) => order.status === "delivered").length;
  const parts = [`Tour ${state.t} / ${state.setup.horizon}`, `${delivered} / ${state.orders.length} commandes livrées`];
  const staged = state.orders.filter((order) => order.status === "staged" || order.status === "toTruck").length;
  if (staged > 0) parts.push(`${staged} prête${plural(staged)} devant les quais`);
  if (state.trucks.some((truck) => truck.at > 0)) parts.push(trucksOf(state).map(truckText).join(", "));
  const loaders = loadersOf(state);
  parts.push(...loaders.map((loader) => loaderText(loader, loaders.length > 1)).filter(Boolean));
  parts.push(corridorText(state));
  if (measures) parts.push(...measuresText(state, measures));
  return parts.join(" · ");
}

/** What an order is to a kit (day-kits.js): a part for the station, or the parcel assembled there; nothing else. */
function kitText(state, order) {
  if (order.kit === undefined) return "";
  return order.parcel ? `colis assemblé (kit ${order.kit + 1}) : ` : `pièce du kit ${order.kit + 1} : `;
}

/**
 * The assembly stations (day-kits.js): `{ x, y, kit, parts, partsIn, working, since }`, the kit at work or the next
 * one waiting for its parts; how long the work will take is hidden, as for the robots.
 */
export function stationsOf(state) {
  const stations = state.warehouse.stations ?? [];
  if (!state.kits) return [];
  return stations.map((station, s) => {
    const mine = state.kits.filter((kit) => kit.station === s && kit.doneAt === null);
    const kit = mine.find((one) => one.startedAt !== null) ?? mine[0] ?? null;
    const parts = kit ? state.orders.filter((order) => order.kit === kit.k && !order.parcel) : [];
    return { x: station.x, y: station.y, kit: kit ? kit.k + 1 : null, parts: parts.length, partsIn: parts.filter((order) => order.status === "delivered").length, working: Boolean(kit && kit.startedAt !== null), since: kit?.startedAt ?? null };
  });
}

/** The orders, in their order, with their state; an order not arrived yet keeps its block to itself (`?`). */
export function ordersOf(state) {
  return state.orders.map((order) => ({
    id: order.id,
    block: order.status === "pending" ? "?" : order.block,
    status: order.status,
    truck: trucksOf(state).length > 1 && !state.trucks[order.truck].station ? order.truck + 1 : null,
    label: kitText(state, order) + STATUS_LABELS[order.status] + (order.robot ? `, robot ${order.robot}` : "") + (order.loader ? `, chargeur ${order.loader}` : "") + (order.deliveredAt === null ? "" : ` au tour ${order.deliveredAt}`),
  }));
}

/**
 * The days of a comparison, by pairs (Sami, 26/10/2026, the stats tab): for each rule but the baseline (`base`, the list
 * order by default), how much less of `measure` (the turns trucks waited, by default) than under the baseline, day by
 * day (`diffs`, above 0 a gain), with the day's number, and the range they span (`low`, `high`, 0 always inside).
 */
export function pairedDays(runs, firstSeed, { base = "list", measure = "truckWait" } = {}) {
  const baseline = runs[base] ?? [];
  const rows = Object.entries(runs)
    .filter(([name]) => name !== base)
    .map(([name, measures]) => ({ name, diffs: measures.map((one, i) => ({ seed: firstSeed + i, gain: baseline[i][measure] - one[measure] })) }));
  const gains = rows.flatMap((row) => row.diffs.map((one) => one.gain));
  return { rows, low: Math.min(0, ...gains), high: Math.max(0, ...gains) };
}
