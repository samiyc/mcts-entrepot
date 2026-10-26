import { el } from "../dom.js";
import { panelOf, playButtons } from "../knobs.js";
import { lineBoard } from "../line-board.js";
import { lanesOf, lineStatus, sequenceOf } from "../line-view.js";
import { replayNote } from "./entrepot.js";

/**
 * The tab « Ligne cadencée » (Sami, 26/10/2026; docs/recherche/feuille-de-route.md, step 1): an hour of the chosen line
 * under the chosen rule. The panel holds the settings and the buttons; the view, the hour's line, the board, and each
 * station's line side. `ctx`: the page's `state`, the line's own in `state.sims.ligne`.
 */
const INTRO =
  "Une ligne d'assemblage automobile : un véhicule toutes les 55 s (le takt de Toyota à Georgetown). Chaque poste prend à chaque takt une pièce de chacune de ses références ; un bac vidé (12 pièces) appelle un robot, qui va chercher un bac plein au supermarché. S'il manque une pièce à un poste, toute la ligne s'arrête. Une référence peut manquer au supermarché : un robot ne le voit qu'en arrivant au bloc.";

/** The driver at the keys (step 3): the box, and the keys when it is on. */
function driverFields(sim) {
  const box = el("label", { class: "check" }, el("input", { type: "checkbox", "data-knob": "human", "data-sim": "ligne", checked: Boolean(sim.setup.human) }), "Jouer le cariste");
  const keys = el("p", { class: "hint" }, "Z Q S D ou les flèches pour marcher, E pour prendre un bac à côté d'un bloc (le plus ancien demandé) ou le poser devant son poste. Hors lecture, chaque touche joue un tour. Les robots s'écartent de vous.");
  return sim.setup.human ? [box, keys] : [box];
}

export const lignePanel = ({ state }) => {
  const sim = state.sims.ligne;
  return panelOf("L'heure de ligne", sim, ["plan", "rule", "seed", "speed"], ...playButtons(sim), ...driverFields(sim), el("p", { class: "hint" }, "Un tour = 5 s ; une heure = 720 tours. Les chiffres et leurs sources : docs/recherche/ligne-cadencee.md."));
};

/** A lane as a row: the reference, its bins (the one in use, how full; the full ones behind), the request out. */
function laneRow(lane) {
  const bins = [el("span", { class: `bin${lane.empty ? " empty" : ""}`, style: `--fill:${Math.round((100 * lane.pieces) / lane.capacity)}%`, title: `${lane.pieces} pièces dans le bac en cours` }), ...Array.from({ length: lane.full }, () => el("span", { class: "bin", style: "--fill:100%", title: "un bac plein" }))];
  return el("li", { class: lane.empty ? "empty" : null }, el("strong", {}, lane.ref), el("span", { class: "bins" }, ...bins), lane.request ? el("span", { class: "hint" }, ` ${lane.request}`) : null);
}

function lineSide(state) {
  const stations = lanesOf(state).map((station) => el("li", {}, el("span", { class: "station-tag" }, `P${station.id}`), el("ul", { class: "lanes" }, ...station.lanes.map(laneRow))));
  return el("aside", { class: "orders-card" }, el("h2", {}, "Le bord de ligne"), el("ol", { class: "stations" }, ...stations));
}

/** The models known to come, as chips (a mix of models only). */
function sequence(state) {
  const known = sequenceOf(state);
  if (!known.length) return [];
  const chips = known.map((one) => el("span", { class: `model ${one.name}${one.first ? " current" : ""}` }, one.name[0].toUpperCase()));
  return [el("p", { class: "sequence hint" }, "La séquence connue : ", ...chips, " (puis inconnue)")];
}

export function ligneView({ state }) {
  const sim = state.sims.ligne;
  const summary = el("p", { class: `summary${sim.day.stopRun > 0 ? " line-stopped" : ""}`, "aria-live": "polite" }, sim.busy || lineStatus(sim.day));
  const layout = el("div", { class: "board-layout" }, el("div", { class: "board-wrap" }, lineBoard(sim.day)), lineSide(sim.day));
  return [el("p", { class: "hint" }, INTRO), ...replayNote(sim), summary, ...sequence(sim.day), layout];
}
