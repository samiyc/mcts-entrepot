import { isOver, measuresOf } from "../../src/simulate.js";
import { board } from "../board.js";
import { el } from "../dom.js";
import { buttons, panelOf } from "../knobs.js";
import { editor, orders } from "../panels.js";
import { statusLine } from "../view.js";

/**
 * The tab « Entrepôt » (Sami, 26/10/2026): a day of the chosen warehouse under the chosen rule, played turn by turn or
 * all at once. The panel holds the settings, the buttons and the plan editor; the view, the day's line, the board and
 * the orders. `ctx`: the page's `state`.
 */
const INTRO =
  "Des robots vont chercher les commandes dans les rayons et les rapportent au camion. Chacun réserve son chemin dans l'espace et le temps autour de ceux des autres : jamais deux robots dans la même case. Une allée peut se bloquer à un moment inconnu ; un robot ne le voit qu'en arrivant à côté.";

export function entrepotPanel({ state }) {
  const playing = state.timer !== null;
  const play = playing ? ["pause", "Pause"] : ["play", "Jouer"];
  return [
    panelOf("La journée", state, ["plan", "rule", "seed", "speed"], buttons(play, ["step", "Un tour", true], ["finish", "Jusqu'au bout", true]), buttons(["restart", "Recommencer", true], ["next", "Journée suivante", true])),
    editor(state),
  ];
}

export function entrepotView({ state }) {
  const over = isOver(state.day);
  const summary = el("p", { class: "summary", "aria-live": "polite" }, state.busy || statusLine(state.day, over ? measuresOf(state.day) : null));
  const layout = el("div", { class: "board-layout" }, el("div", { class: "board-wrap" }, board(state.day)), el("aside", { class: "orders-card" }, el("h2", {}, "Les commandes"), orders(state.day)));
  return [el("p", { class: "hint" }, INTRO), summary, layout];
}
