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
 * at a time.
 */
export const PLANS = Object.freeze({
  petit: Object.freeze({
    label: "Petit entrepôt (9 × 4, 2 robots)",
    text: [".........", ".AA..BB..", "....~....", ".CC..DD.T"].join("\n"),
    robots: 2,
    orders: "ABCDBA",
    blocking: 0.8,
    duration: 8,
    horizon: 160,
  }),
  sami: Object.freeze({
    label: "Le plan de Sami (13 × 7, 4 robots, des bornes et deux zones d'attente)",
    text: ["c........www#", "AA.BB.CC.DDw#", "c.~~~~......#", "EE.FF.GG.HH.T", "c...........#", "II.JJ.KK.LLw#", "c........www#"].join("\n"),
    robots: 4,
    orders: "ABCDEFGHIJKL",
    blocking: 0.8,
    duration: 8,
    horizon: 260,
  }),
  quais: Object.freeze({
    label: "Trois quais et leurs camions (16 × 7, 4 robots, Sami, avec des obstacles)",
    text: ["c..#...........#", "AA.BB.CC.DD.wwwT", "c...~~~...#....#", "EE.FF.GG.HH.wwwT", "c..#...........#", "II.JJ.KK.LL.wwwT", "c......~~~#....#"].join("\n"),
    robots: 4,
    orders: "AFKD/EJCH/IBGL",
    trucks: Object.freeze([20, 40, 60]),
    blocking: 0.8,
    duration: 8,
    horizon: 240,
  }),
  couloirs: Object.freeze({
    label: "Deux couloirs étroits (13 × 5, 3 robots)",
    text: ["#############", "#AAAA.~.BBBB#", "#...........T", "#CCCC.~.DDDD#", "#############"].join("\n"),
    robots: 3,
    orders: "ABCDACBD",
    blocking: 0.8,
    duration: 8,
    horizon: 120,
  }),
});
