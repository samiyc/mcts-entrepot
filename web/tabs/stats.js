import { pairedStrip } from "../charts.js";
import { el } from "../dom.js";
import { panelOf } from "../knobs.js";

/**
 * The tab « Stats » (Sami, 26/10/2026): what is measured and stays. The night measures (docs/changelog.json, played by
 * mcts-backlog from night.json), then the last comparison of the Comparaisons tab, day by day. `ctx`: the page's `state`.
 */
export const statsPanel = () =>
  panelOf(
    "Les mesures",
    {},
    [],
    el("p", { class: "hint" }, "Les mesures de nuit : des centaines de journées par plan, jouées par l'ordonnanceur commun (night.json). Journée par journée : la dernière comparaison de l'onglet Comparaisons."),
    el("p", { class: "row-buttons" }, el("a", { href: "#comparaisons" }, "Lancer une comparaison")),
  );

function gainsTable(gains) {
  if (!gains) return [el("p", { class: "hint" }, "Les mesures de nuit se lisent dans docs/changelog.json, servi par la page (npm run page).")];
  const cell = (text, i) => Object.assign(el("td", { class: i > 0 ? "num" : null }), { innerHTML: text });
  const rows = gains.gainsRows.map((cells) => el("tr", {}, ...cells.map(cell)));
  const head = gains.gainsHead.map((text, i) => el("th", { class: i > 0 ? "num" : null }, text));
  return [el("h2", {}, gains.gainsTitle), el("p", { class: "hint" }, gains.gainsNote), el("div", { class: "scroll" }, el("table", {}, el("thead", {}, el("tr", {}, ...head)), el("tbody", {}, ...rows)))];
}

export function statsView({ state }) {
  const strip = pairedStrip(state.compared);
  return [...gainsTable(state.gains), ...(strip.length ? strip : [el("p", { class: "hint" }, "Journée par journée : lancez une comparaison dans l'onglet Comparaisons.")])];
}
