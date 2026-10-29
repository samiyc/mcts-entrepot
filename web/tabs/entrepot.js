import { isOver, measuresOf } from "../../src/simulate.js";
import { board } from "../board.js";
import { el } from "../dom.js";
import { panelOf, playButtons } from "../knobs.js";
import { editor, orders } from "../panels.js";
import { statusLine } from "../view.js";

/**
 * The tab « Entrepôt » (Sami, 26/10/2026): a day of the chosen warehouse under the chosen rule, played turn by turn or
 * all at once. The panel holds the settings, the buttons and the plan editor; the view, the day's line, the board and
 * the orders. `ctx`: the page's `state`, the warehouse's own in `state.sims.entrepot`.
 */
const INTRO =
  "Des robots vont chercher les commandes dans les rayons et les rapportent au camion. Chacun réserve son chemin dans l'espace et le temps autour de ceux des autres : jamais deux robots dans la même case. Une allée peut se bloquer à un moment inconnu ; un robot ne le voit qu'en arrivant à côté.";

export function entrepotPanel({ state }) {
  const sim = state.sims.entrepot;
  return [panelOf("La journée", sim, ["plan", "rule", "seed", "speed"], ...playButtons(sim)), editor(sim)];
}

/** A replay opened: when it was played; a button to leave it. */
export function replayNote({ replay, kind }) {
  if (!replay) return [];
  const text = `Replay du ${replay.savedAt.slice(0, 16).replace("T", " ")} : ${kind === "ligne" ? "l'heure" : "la journée"} se rejoue avec ses propres choix, coup pour coup. `;
  return [el("p", { class: "summary replay-note" }, text, el("button", { type: "button", class: "quiet", "data-action": "leaveReplay", "data-sim": kind }, "Quitter le replay"))];
}

export function entrepotView({ state }) {
  const sim = state.sims.entrepot;
  const over = isOver(sim.day);
  const summary = el("p", { class: "summary status", "aria-live": "polite" }, sim.busy || statusLine(sim.day, over ? measuresOf(sim.day) : null));
  const layout = el("div", { class: "board-layout" }, el("div", { class: "board-wrap" }, board(sim.day)), el("aside", { class: "orders-card" }, el("h2", {}, "Les commandes"), orders(sim.day)));
  return [el("p", { class: "hint" }, INTRO), ...replayNote(sim), summary, layout];
}
