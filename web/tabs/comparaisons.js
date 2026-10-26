import { el } from "../dom.js";
import { COMPARED, COMPARED_WITH_SEARCH } from "../game.js";
import { buttons, panelOf } from "../knobs.js";
import { comparedTable } from "../panels.js";

/**
 * The tab « Comparaisons » (Sami, 26/10/2026): the rules, then the rules and the search, on the same days of the chosen
 * warehouse; the gain on the list order by pairs, with its interval. `ctx`: the page's `state`.
 */
export const comparaisonsPanel = ({ state }) =>
  panelOf(
    "Comparer",
    state,
    ["plan", "rule"],
    buttons(["compare", `Les règles, ${COMPARED} journées`, true], ["compareSearch", `Avec la recherche, ${COMPARED_WITH_SEARCH} journées`, true]),
    el("p", { class: "hint" }, "Les mêmes journées pour chaque règle ; le temps à quai gagné sur la liste, par paires, avec son intervalle à 95 %. La règle choisie est en gras. Les journées de la recherche se jouent dans plusieurs workers à la fois."),
  );

export function comparaisonsView({ state }) {
  if (state.busy) return [el("p", { class: "summary busy", role: "status" }, state.busy)];
  if (!state.compared) return [el("p", { class: "hint" }, "Lancez une comparaison dans le panneau.")];
  return comparedTable(state);
}
