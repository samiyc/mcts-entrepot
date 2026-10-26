import { pairedStrip } from "../charts.js";
import { el } from "../dom.js";
import { panelOf } from "../knobs.js";

/**
 * The tab « Stats » (Sami, 26/10/2026): what is measured and stays. The night measures (docs/changelog.json, played by
 * mcts-backlog from night.json), then the last comparison of the Comparaisons tab, day by day. `ctx`: the page's `state`.
 */
export const statsPanel = ({ state }) =>
  panelOf(
    "Les mesures",
    state.sims.entrepot,
    [],
    el("p", { class: "hint" }, "Les mesures de nuit de l'entrepôt : des centaines de journées par plan, jouées par l'ordonnanceur commun (night.json). Puis la dernière comparaison de l'onglet Comparaisons, pour l'entrepôt et pour la ligne, journée par journée et heure par heure."),
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
  const strips = [...pairedStrip(state.sims.entrepot.compared, "entrepot"), ...pairedStrip(state.sims.ligne.compared, "ligne")];
  return [...gainsTable(state.gains), ...(strips.length ? strips : [el("p", { class: "hint" }, "Journée par journée : lancez une comparaison dans l'onglet Comparaisons.")])];
}
