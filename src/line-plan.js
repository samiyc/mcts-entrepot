import { parsePlan } from "mcts-commun/grid.js";
import { LINE } from "./line-hypotheses.js";
import { SIDES, readWarehouse } from "./warehouse.js";

/**
 * The assembly line read from its plan (Sami, 26/10/2026: the line first; docs/recherche/ligne-cadencee.md). The
 * warehouse's legend, and two signs more:
 * - `P` a station of the line, in reading order;
 * - `b` a slot of its line side, where bins wait (a rack: robots do not cross it, they drop from the floor beside it),
 *   belonging to the nearest station;
 * - `r` the shelf where empty bins go back (step 2, when `returnEmpties`), a rack too.
 * The blocks `A`…`L` are the supermarket, a part reference each. A station takes, at each takt, a piece of each of its
 * references (`refs`, a group a station split by `/`, the stations in reading order).
 */
const manhattan = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

/** The floor cells beside `cells`, once each, in the order of the cells and SIDES. */
function floorBeside(warehouse, cells) {
  const keys = new Set(cells.map((cell) => `${cell.x},${cell.y}`));
  const found = new Map();
  for (const cell of cells) {
    for (const [dx, dy] of SIDES) {
      const side = { x: cell.x + dx, y: cell.y + dy };
      const key = `${side.x},${side.y}`;
      if (!keys.has(key) && warehouse.floor(warehouse.plan.at(side.x, side.y))) found.set(key, side);
    }
  }
  return [...found.values()];
}

/**
 * The line of `text` and its `refs`: the warehouse its robots move in (stations and slots are not floor), the
 * stations `{ id, x, y, refs, slots, access }` (`access`, where a robot drops a bin), the plan as drawn, and the cells
 * beside the return shelf (`returns`). The
 * stations also stand as the warehouse's docks, so that no robot waits in front of the line (day-spots.js).
 */
export function readLine(text, refs) {
  const drawn = parsePlan(text);
  const warehouse = readWarehouse(text.replace(/[Pbr]/g, "#"), { autoZones: false, trucks: false });
  const groups = refs.split("/");
  const stations = drawn.find("P").map((cell, i) => ({ id: i + 1, ...cell, refs: [...(groups[i] ?? "")], slots: [], access: [], bay: [], zones: [] }));
  if (stations.length === 0) throw new Error("la ligne n'a pas de poste (P)");
  if (groups.length !== stations.length) throw new Error(`${groups.length} groupes de références pour ${stations.length} postes (P)`);
  for (const slot of drawn.find("b")) stations.reduce((best, one) => (manhattan(one, slot) < manhattan(best, slot) ? one : best)).slots.push(slot);
  for (const station of stations) settle(warehouse, station);
  // Each station stands as a dock at its first drop cell, a floor cell (26/10/2026: the stations themselves are not
  // floor, so the spots measured from them found no aside cell, and robots could park in front of the line side).
  const docks = stations.map((station) => ({ ...station.access[0], bay: [], zones: [] }));
  Object.assign(warehouse, { docks, dock: docks[0] });
  return { warehouse, stations, drawn, returns: floorBeside(warehouse, drawn.find("r")) };
}

/** A station's drop cells, found; and every reference it takes, a block a robot reaches. */
function settle(warehouse, station) {
  station.access = floorBeside(warehouse, station.slots);
  if (station.access.length === 0) throw new Error(`le poste ${station.id} n'a pas de bord de ligne (b) qu'un robot atteigne`);
  for (const ref of station.refs) if (!warehouse.blocks.get(ref)?.length) throw new Error(`référence ${ref} : pas de bloc ${ref} accessible sur le plan`);
}

/**
 * The lines to start with (docs/recherche/feuille-de-route.md, step 1), at the figures of line-hypotheses.js: a takt of
 * 11 turns (55 s), an hour of the line (720 turns), two bins of 12 pieces a reference on the line side.
 */
const { supermarket: SUPERMARKET, ...FIGURES } = LINE;
const BASE = { ...FIGURES, blocking: 0.15, duration: 8, relay: false };
const SAMI_LINE = {
  text: ["c.AA.BB.CC.DD.EE.FF.......", "c.......~~~~~.............", "c.GG.HH.II.JJ.KK.LL.......", "c.........................", "..bb...bb...bb...bb...bb..", "###P####P####P####P####P##"].join("\n"),
  refs: "ABG/CDH/EI/FJ/KL",
  blocking: 0.3,
};
/** Sami's line with a return shelf for the empty bins (`rr`, row 3, at the supermarket's way out). */
const SAMI_SHELF = { ...SAMI_LINE, text: SAMI_LINE.text.replace("c.........................", "c.rr......................") };
export const LINE_PLANS = Object.freeze({
  petite: Object.freeze({
    ...BASE,
    label: "Petite ligne (3 postes, 6 références, 1 robot)",
    text: ["c..AA..BB..CC...", "c...............", "...DD..EE..FF...", "................", "...bb....bb...bb", "####P####P####P#"].join("\n"),
    refs: "AD/BE/CF",
    robots: 1,
  }),
  sami: Object.freeze({ ...BASE, ...SAMI_LINE, label: "Ligne de Sami (5 postes, 12 références, 2 robots, une allée qui se bloque)", robots: 2 }),
  seul: Object.freeze({ ...BASE, ...SAMI_LINE, label: "Ligne de Sami, un seul robot (le robot est la ressource rare)", robots: 1 }),
  // Step 2 (26/10/2026): the empty bins go back to the shelf r, beside the supermarket's way out.
  retours: Object.freeze({ ...BASE, ...SAMI_SHELF, label: "Ligne de Sami, les bacs vides rapportés (2 robots)", robots: 2, returnEmpties: true }),
  tournee: Object.freeze({ ...BASE, ...SAMI_SHELF, label: `Ligne de Sami, un robot qui porte ${LINE.tourBins} bacs (les vides rapportés)`, robots: 1, returnEmpties: true, capacity: LINE.tourBins }),
  // Step 2: two models, petrol and hybrid, each skipping the other's parts; the next 20 vehicles known.
  // Step 2: the supermarket fed from the warehouse, its stock seen, the orders' lead unknown; no supplier shortage, to see the stock alone.
  supermarche: Object.freeze({ ...BASE, ...SAMI_LINE, label: "Ligne de Sami, le supermarché réapprovisionné par l'entrepôt (2 robots)", robots: 2, supermarket: SUPERMARKET, shortagesPerHour: 0 }),
  melange: Object.freeze({ ...BASE, ...SAMI_LINE, label: "Ligne de Sami, essence et hybride mêlés (un robot)", robots: 1, models: LINE.mix }),
  etroite: Object.freeze({
    ...BASE,
    label: "Bord de ligne étroit (3 postes, un seul bac par référence, 2 robots)",
    text: ["c..AA..BB..CC...", "c...............", "c..DD..EE..FF...", "................", "...bb....bb...bb", "####P####P####P#"].join("\n"),
    refs: "AD/BE/CF",
    robots: 2,
    bins: 1,
  }),
});
