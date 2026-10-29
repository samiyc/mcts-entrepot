import { WAREHOUSE } from "./warehouse-hypotheses.js";

/**
 * Warehouses drawn as text (Sami, 22/10/2026: change the warehouse to test other configurations; very simple
 * plans first). The legend:
 * - `.` the floor, where robots move;
 * - a capital letter, a block of shelves (not passable): an order is fetched from a floor cell beside it;
 * - `T` a truck's dock, where orders are dropped, one robot at a time (23/10/2026);
 * - `w` a bay cell in front of a dock (floor): one pallet waits there for its truck (23/10/2026); a group of `w`
 *   touching no dock is a waiting zone of the nearest truck;
 * - `c` a charging point (floor), where a robot starts and goes back when it has nothing to do (23/10/2026);
 * - `~` floor that may get blocked for a while (a pallet left in the aisle), seen only by a robot next to it;
 * - `#` a wall, or the outside.
 * Each plan comes with its robots and its orders (block letters, in the order they come, one group a truck
 * split by `/`, the docks in reading order), the trucks' arrival turns (`trucks`, 0 when left out);
 * `blocking` is the share of the time the `~` cells are blocked (23/10/2026: again and again, `duration` turns each
 * time, at unknown turns; it was once a day at most). Sami's test settings are the defaults: 80 % of the time, 8 turns
 * at a time. The days are long enough for every rule to finish with 90 s to set a pallet into a truck (26/10/2026,
 * warehouse-hypotheses.js; `loadTurns: 1` plays the days as before, on the shorter horizons they had).
 */
export const PLANS = Object.freeze({
  petit: Object.freeze({
    label: "Petit entrepôt (9 × 4, 2 robots)",
    text: [".........", ".AA..BB..", "....~....", ".CC..DD.T"].join("\n"),
    robots: 2,
    orders: "ABCDBA",
    blocking: 0.8,
    duration: 8,
    horizon: 220,
  }),
  sami: Object.freeze({
    label: "Le plan de Sami (13 × 7, 4 robots, des bornes et deux zones d'attente)",
    text: ["c........www#", "AA.BB.CC.DDw#", "c.~~~~......#", "EE.FF.GG.HH.T", "c...........#", "II.JJ.KK.LLw#", "c........www#"].join("\n"),
    robots: 4,
    orders: "ABCDEFGHIJKL",
    blocking: 0.8,
    duration: 8,
    horizon: 420,
  }),
  quais: Object.freeze({
    label: "Trois quais et leurs camions (16 × 7, 4 robots, Sami, avec des obstacles)",
    text: ["c..#...........#", "AA.BB.CC.DD.wwwT", "c...~~~...#....#", "EE.FF.GG.HH.wwwT", "c..#...........#", "II.JJ.KK.LL.wwwT", "c......~~~#....#"].join("\n"),
    robots: 4,
    orders: "AFKD/EJCH/IBGL",
    trucks: Object.freeze([20, 40, 60]),
    blocking: 0.8,
    duration: 8,
    horizon: 300,
  }),
  couloirs: Object.freeze({
    label: "Deux couloirs étroits (13 × 5, 3 robots)",
    text: ["#############", "#AAAA.~.BBBB#", "#...........T", "#CCCC.~.DDDD#", "#############"].join("\n"),
    robots: 3,
    orders: "ABCDACBD",
    blocking: 0.8,
    duration: 8,
    horizon: 280,
  }),
  // Orders that arrive during the day (26/10/2026, day-arrivals.js): Sami's plan, 4 orders known at the start, then one
  // every 15 turns on average (a hypothesis), hidden until it comes; none after turn 200, the cut-off.
  flux: Object.freeze({
    label: "Le plan de Sami, les commandes au fil de la journée (4 au départ, puis une tous les 15 tours environ)",
    text: ["c........www#", "AA.BB.CC.DDw#", "c.~~~~......#", "EE.FF.GG.HH.T", "c...........#", "II.JJ.KK.LLw#", "c........www#"].join("\n"),
    robots: 4,
    orders: "ABCDEFGHIJKL",
    arrivals: Object.freeze({ known: 4, every: 15, until: 200 }),
    blocking: 0.8,
    duration: 8,
    horizon: 420,
  }),
  // An assembly station (26/10/2026, day-kits.js): Sami's plan, a station S under the bottom left charging point; a
  // specialist wires I and J together, then packs K and L, both parcels to the truck with the 8 other orders.
  assemblage: Object.freeze({
    label: "Le plan de Sami et un poste d'assemblage (un spécialiste : un câblage, une mise en colis)",
    text: ["c........www#", "AA.BB.CC.DDw#", "c.~~~~......#", "EE.FF.GG.HH.T", "c...........#", "II.JJ.KK.LLw#", "c........www#", "#S###########"].join("\n"),
    robots: 4,
    orders: "ABCDEFGH",
    // Its orders as written (29/10/2026): drawn, they bring out rare jams at the station (docs/recherche/feuille-de-route.md).
    drawOrders: false,
    kits: Object.freeze([Object.freeze({ parts: "IJ", truck: 0, work: WAREHOUSE.works.wiring }), Object.freeze({ parts: "KL", truck: 0, work: WAREHOUSE.works.packing })]),
    blocking: 0.8,
    duration: 8,
    horizon: 480,
  }),
});
