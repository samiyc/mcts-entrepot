/**
 * Warehouses drawn as text (Sami, 22/10/2026: change the warehouse to test other configurations; very simple
 * plans first). The legend:
 * - `.` the floor, where robots move;
 * - a capital letter, a block of shelves (not passable): an order is fetched from a floor cell beside it;
 * - `T` a truck's dock, where orders are dropped, one robot at a time (23/10/2026);
 * - `w` a bay cell in front of a dock (floor): one pallet waits there for its truck (23/10/2026);
 * - `c` a charging point (floor), where a robot starts and goes back when it has nothing to do (23/10/2026);
 * - `~` floor that may get blocked for a while (a pallet left in the aisle), seen only by a robot next to it;
 * - `#` a wall, or the outside.
 * Each plan comes with its robots and its orders (block letters, in the order they come, one group a truck
 * split by `/`, the docks in reading order), the trucks' arrival turns (`trucks`, 0 when left out);
 * `blocking` is the chance that the `~` cells get blocked during the day, for `duration` turns from an
 * unknown turn.
 */
export const PLANS = Object.freeze({
  petit: Object.freeze({
    label: "Petit entrepôt (9 × 4, 2 robots)",
    text: [".........", ".AA..BB..", "....~....", ".CC..DD.T"].join("\n"),
    robots: 2,
    orders: "ABCDBA",
    blocking: 0.3,
    duration: 8,
    horizon: 80,
  }),
  sami: Object.freeze({
    label: "Le plan de Sami (17 × 7, 4 robots)",
    text: [".................", ".AAA.BBB.CCC.DDD.", "....~~~~~........", ".EEE.FFF.GGG.HHHT", ".................", ".III.JJJ.KKK.LLL.", "................."].join("\n"),
    robots: 4,
    orders: "ABCDEFGHIJKL",
    blocking: 0.2,
    duration: 10,
    horizon: 140,
  }),
  quais: Object.freeze({
    label: "Trois quais et leurs camions (22 × 7, 4 robots, Sami)",
    text: [".....................#", "c.AAA.BBB.CCC.DDD.wwwT", "c....~~~~~...........#", "..EEE.FFF.GGG.HHH.wwwT", "c....................#", "c.III.JJJ.KKK.LLL.wwwT", ".....................#"].join("\n"),
    robots: 4,
    orders: "AFKD/EJCH/IBGL",
    trucks: Object.freeze([20, 40, 60]),
    blocking: 0.2,
    duration: 10,
    horizon: 240,
  }),
  couloirs: Object.freeze({
    label: "Deux couloirs étroits (13 × 5, 3 robots)",
    text: ["#############", "#AAAA.~.BBBB#", "#...........T", "#CCCC.~.DDDD#", "#############"].join("\n"),
    robots: 3,
    orders: "ABCDACBD",
    blocking: 0.5,
    duration: 12,
    horizon: 100,
  }),
});
