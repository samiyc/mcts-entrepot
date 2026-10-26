/**
 * The assembly stations (Sami, 26/10/2026; docs/modele.md, La suite, step 4): a specialist at a station `S` assembles a
 * kit from parts the robots fetch from the blocks and bring to the station: a few small parts put into a bigger parcel,
 * or a long work (wiring). Once assembled, the kit is a parcel the robots carry to its truck.
 *
 * `setup.kits`: `[{ parts, truck, work: [min, max], station }]`, the blocks of its parts, the truck its parcel goes to
 * (an index, as an order's), its work in turns, drawn between the bounds, and its station (an index, 0 by default).
 * A station is a dock that is always there (`station: true`, read by warehouse.js): the robots queue there to set a
 * part down, a turn each. A kit starts when all its parts are in and its station's specialist is free; its parcel is
 * picked at the station. How long a work takes is hidden until it ends: the search draws it again.
 */

/** The block name of station `s`'s parcels, picked on the station's cell. */
export const stationBlock = (s) => `S${s + 1}`;

/** The stations as docks always there, after the trucks (`from` of them), and their parcels' pickups in `warehouse.blocks`. */
export function stationTrucks(setup, warehouse, from) {
  if (!setup.kits) return [];
  if (warehouse.stations.length === 0) throw new Error("des assemblages, mais le plan n'a pas de poste d'assemblage (S)");
  warehouse.stations.forEach((station, s) => warehouse.blocks.set(stationBlock(s), [{ x: station.x, y: station.y }]));
  return warehouse.stations.map((station, s) => ({ id: from + s + 1, dock: station, at: 0, blocks: "", loaders: {}, station: true }));
}

/**
 * The kits' orders, numbered after the `first - 1` others: each part an order to its station, then each kit's parcel,
 * waiting (`status: "kit"`, no rule sees it) until its kit is assembled.
 */
export function kitOrders(setup, trucks, first) {
  if (!setup.kits) return [];
  const base = { robot: null, deliveredAt: null, stagedAt: null, cell: null };
  const stationOf = (kit) => trucks.findIndex((truck) => truck.station) + (kit.station ?? 0);
  const parts = setup.kits.flatMap((kit, k) => [...kit.parts].map((block) => ({ block, truck: stationOf(kit), kit: k, status: "open" })));
  const parcels = setup.kits.map((kit, k) => ({ block: stationBlock(kit.station ?? 0), truck: kit.truck, kit: k, parcel: true, status: "kit" }));
  return [...parts, ...parcels].map((order, i) => ({ id: first + i, ...base, ...order }));
}

/** Each kit's work in turns, drawn between its bounds. */
export const drawWorks = (rng, kits) => kits.map(({ work: [min, max] }) => min + rng.int(max - min + 1));

/** The kits as the day starts: none begun. */
export const kitsOf = (setup) => setup.kits?.map((kit, k) => ({ k, station: kit.station ?? 0, startedAt: null, until: null, doneAt: null })) ?? null;

const partsIn = (state, k) => state.orders.every((order) => order.kit !== k || order.parcel || order.status === "delivered");
const busy = (state, station) => state.kits.some((kit) => kit.station === station && kit.startedAt !== null && kit.doneAt === null);

/** The kits whose work ends now: their parcel released, open to the rules. */
function finishKits(state) {
  for (const kit of state.kits) {
    if (kit.startedAt === null || kit.doneAt !== null || state.t < kit.until) continue;
    kit.doneAt = state.t;
    const parcel = state.orders.find((order) => order.parcel && order.kit === kit.k);
    parcel.status = "open";
    state.log.push({ t: state.t, type: "assembled", kit: kit.k, order: parcel.id });
  }
}

/** The specialists at work: a kit done releases its parcel, a free specialist starts the first kit whose parts are all in. */
export function assemble(state) {
  if (!state.kits) return;
  finishKits(state);
  for (const kit of state.kits) {
    if (kit.startedAt !== null || busy(state, kit.station) || !partsIn(state, kit.k)) continue;
    Object.assign(kit, { startedAt: state.t, until: state.t + state.day.works[kit.k] });
    state.log.push({ t: state.t, type: "assembling", kit: kit.k });
  }
}

/** A world's works: a kit under way ends after a work drawn again (later than now), the ones to come drawn afresh. */
export function drawWorldKits(world, state, rng) {
  if (!state.kits) return;
  const works = drawWorks(rng, state.setup.kits);
  world.kits = state.kits.map((kit) => (kit.startedAt !== null && kit.doneAt === null ? { ...kit, until: Math.max(state.t + 1, kit.startedAt + works[kit.k]) } : { ...kit }));
  world.day = { ...world.day, works };
}

/** The kits' measures: how many were assembled, the mean turn their parcel was ready, and the turns the specialists waited for parts. */
export function kitMeasures(state) {
  if (!state.kits) return {};
  const done = state.kits.filter((kit) => kit.doneAt !== null);
  const started = state.kits.filter((kit) => kit.startedAt !== null);
  return {
    kits: state.kits.length,
    assembled: done.length,
    meanAssembled: done.length ? done.reduce((sum, kit) => sum + kit.doneAt, 0) / done.length : state.setup.horizon,
    firstStart: started.length ? Math.min(...started.map((kit) => kit.startedAt)) : state.setup.horizon,
  };
}
