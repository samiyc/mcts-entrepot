import { WAREHOUSE_RULE_LABELS } from "../../src/plant.js";
import { board } from "../board.js";
import { el } from "../dom.js";
import { panelOf, playButtons, select } from "../knobs.js";
import { lineBoard } from "../line-board.js";
import { lineStatus } from "../line-view.js";
import { statusLine } from "../view.js";

/**
 * The tab « Usine » (Sami, 26/10/2026; src/plant.js): the line and its supermarket, fed by the warehouse, on one clock.
 * The panel holds the line's rule, the warehouse's rule and robots; the view, the line above, the warehouse below, and
 * what goes between them. `ctx`: the page's `state`, the plant's own in `state.sims.usine`.
 */
const INTRO =
  "La ligne cadencée et son supermarché, réapprovisionné par l'entrepôt : quand une référence tombe à son seuil, une commande arrive à l'entrepôt, dont les robots vont chercher la palette au bloc de la même lettre et la posent au quai ; la navette la porte au supermarché en 5 minutes. Les deux sur une seule horloge (un tour = 5 s).";

export function usinePanel({ state }) {
  const sim = state.sims.usine;
  const rule = el("label", {}, "Règle de l'entrepôt", select("warehouseRule", Object.entries(WAREHOUSE_RULE_LABELS), sim.setup.warehouseRule, "usine"));
  const robots = el("label", {}, "Robots de l'entrepôt", select("warehouseRobots", ["1", "2", "3", "4"].map((n) => [n, n]), String(sim.setup.warehouse.robots), "usine"));
  return panelOf("L'usine", sim, ["plan", "rule", "seed", "speed"], rule, robots, ...playButtons(sim));
}

/** Between the two: the orders at the warehouse, the pallets on the shuttle, the mean lead so far. */
function between(plant) {
  const waiting = plant.warehouse.orders.filter((order) => order.status !== "delivered").length;
  const shuttle = [...plant.sent.values()].filter((order) => order.at !== Infinity && order.at > plant.line.t).length;
  return el("p", { class: "summary status" }, `${plant.warehouse.orders.length} commandes envoyées à l'entrepôt · ${waiting} en préparation · ${shuttle} sur la navette`);
}

export function usineView({ state }) {
  const plant = state.sims.usine.day;
  return [
    el("p", { class: "hint" }, INTRO),
    el("h2", {}, "La ligne"),
    el("p", { class: `summary status${plant.line.stopRun > 0 ? " line-stopped" : ""}` }, lineStatus(plant.line)),
    el("div", { class: "board-wrap" }, lineBoard(plant.line)),
    between(plant),
    el("h2", {}, "L'entrepôt"),
    el("p", { class: "summary status" }, statusLine(plant.warehouse)),
    el("div", { class: "board-wrap" }, board(plant.warehouse)),
  ];
}
