import { LINE_RULE_LABELS } from "../../src/line-rules.js";
import { el } from "../dom.js";
import { buttons, panelOf } from "../knobs.js";
import { MODELS } from "../models.js";
import { comparedTable } from "../panels.js";

/**
 * The tab « Comparaisons » (Sami, 26/10/2026): the rules, then the rules and the search, on the same days of the chosen
 * warehouse or the same hours of the chosen line (`state.compareKind`); the gain on the simple baseline by pairs, with its
 * interval. `ctx`: the page's `state`.
 */
const KINDS = [
  ["entrepot", "l'entrepôt"],
  ["ligne", "la ligne cadencée"],
];

export function comparaisonsPanel({ state }) {
  const sim = state.sims[state.compareKind];
  const kind = el("label", {}, "Simulation", el("select", { "data-knob": "compareKind" }, ...KINDS.map(([value, label]) => el("option", { value, selected: value === state.compareKind }, label))));
  const what = sim.kind === "ligne" ? "heures" : "journées";
  const hint = sim.kind === "ligne" ? "Les mêmes heures pour chaque règle ; les tours d'arrêt de la ligne gagnés sur le kanban, par paires, avec leur intervalle à 95 %." : "Les mêmes journées pour chaque règle ; le temps à quai gagné sur la liste, par paires, avec son intervalle à 95 %.";
  return panelOf("Comparer", sim, ["plan", "rule"], kind, buttons(sim.kind, ["compare", `Les règles, ${MODELS[sim.kind].compared.rules} ${what}`, true], ["compareSearch", `Avec la recherche, ${MODELS[sim.kind].compared.search} ${what}`, true]), el("p", { class: "hint" }, `${hint} La règle choisie est en gras ; la recherche joue dans plusieurs workers à la fois.`));
}

const fixed = (value, digits = 1) => value.toFixed(digits).replace(".", ",");
const LINE_HEAD = ["Règle", "arrêt (tours)", "arrêt", "véhicules", "plus long arrêt (tours)", "arrêt gagné sur le kanban (IC 95 %)", "bacs au plus", "réponse moyenne (tours)"];

/** The rules of the line compared (`sim.compared`): a row each, the shown rule marked. */
function lineTable(sim) {
  const { days, rows } = sim.compared;
  const num = (text) => el("td", { class: "num" }, text);
  const row = ([name, one]) =>
    el("tr", { class: name === sim.rule ? "current" : null }, el("td", {}, LINE_RULE_LABELS[name]), num(fixed(one.stopped)), num(`${fixed(one.stoppedSeconds, 0)} s`), num(fixed(one.produced)), num(fixed(one.longestStop)), num(name === "kanban" ? "—" : `${fixed(one.gain.mean)} (${fixed(one.gain.low)} à ${fixed(one.gain.high)})`), num(fixed(one.maxWip)), num(fixed(one.meanResponse)));
  const head = LINE_HEAD.map((label, i) => el("th", { class: i > 0 ? "num" : null }, label));
  return [el("h2", {}, `Les règles de la ligne sur les mêmes ${days} heures`), el("div", { class: "scroll" }, el("table", {}, el("thead", {}, el("tr", {}, ...head)), el("tbody", {}, ...Object.entries(rows).map(row))))];
}

export function comparaisonsView({ state }) {
  const sim = state.sims[state.compareKind];
  if (sim.busy) return [el("p", { class: "summary busy", role: "status" }, sim.busy)];
  if (!sim.compared) return [el("p", { class: "hint" }, "Lancez une comparaison dans le panneau.")];
  return sim.kind === "ligne" ? lineTable(sim) : comparedTable(sim);
}
