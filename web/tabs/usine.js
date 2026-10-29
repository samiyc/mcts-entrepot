import { WAREHOUSE_RULE_LABELS } from "../../src/plant.js";
import { board } from "../board.js";
import { el } from "../dom.js";
import { facts, lineKey, warehouseKey } from "../legend.js";
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

/** The shuttle, between the two in the flow: the orders sent, those being picked, the pallets on their way. */
function shuttle(plant) {
  const { setup } = plant;
  const waiting = plant.warehouse.orders.filter((order) => order.status !== "delivered").length;
  const onShuttle = [...plant.sent.values()].filter((order) => order.at !== Infinity && order.at > plant.line.t).length;
  const timetable = setup.shuttleEvery ? `, un départ toutes les ${(setup.shuttleEvery * 5) / 60} min` : "";
  return el(
    "div",
    { class: "shuttle", "aria-live": "polite" },
    el("span", { class: "shuttle-arrow", "aria-hidden": "true" }),
    el("strong", {}, "🚚 La navette"),
    el("span", {}, `${(setup.transport * 5) / 60} min de trajet${timetable}`),
    el("span", {}, `${plant.warehouse.orders.length} commandes reçues · ${waiting} en préparation · ${onShuttle} en route`),
    el("span", { class: "hint" }, "La palette du bloc A de l'entrepôt remplit la référence A du supermarché."),
  );
}

/** What the tab shows, measures, and how long an hour plays (Sami, 29/10/2026: the three tabs told apart). */
const plantFacts = () =>
  facts([
    ["On regarde", "l'entrepôt qui remplit le supermarché, qui alimente la ligne : les trois à la suite"],
    ["On mesure", "le temps où la ligne est arrêtée faute de pièce : moins, c'est mieux"],
    ["Durée", "une heure, 720 tours de 5 s, l'entrepôt et la ligne sur la même horloge"],
  ]);

/**
 * In the order the pallets go (Sami, 29/10/2026): the warehouse, the shuttle, then the supermarket and the line; side by
 * side on a wide screen, one under the other on a narrow one.
 */
export function usineView({ state }) {
  const plant = state.sims.usine.day;
  const warehouse = el(
    "section",
    { class: "plant-part" },
    el("h2", {}, "1. L'entrepôt"),
    el("p", { class: "summary status" }, statusLine(plant.warehouse)),
    el("div", { class: "board-wrap" }, board(plant.warehouse)),
    warehouseKey(plant.warehouse),
  );
  const line = el(
    "section",
    { class: "plant-part" },
    el("h2", {}, "2. Le supermarché et la ligne"),
    el("p", { class: `summary status${plant.line.stopRun > 0 ? " line-stopped" : ""}` }, lineStatus(plant.line)),
    el("div", { class: "board-wrap" }, lineBoard(plant.line)),
    lineKey(),
  );
  return [plantFacts(), el("p", { class: "hint" }, INTRO), el("div", { class: "plant-flow" }, warehouse, shuttle(plant), line)];
}
