import { el } from "../dom.js";
import { facts, lineKey } from "../legend.js";
import { fieldsOf, panelOf, playButtons, select } from "../knobs.js";
import { lineOf, optionsOf, settingsOf } from "../line-options.js";
import { lineBoard } from "../line-board.js";
import { lanesOf, lineStatus, restocksOf, sequenceOf } from "../line-view.js";
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

/** A box of the line's settings. */
const box = (name, checked, text) => el("label", { class: "check" }, el("input", { type: "checkbox", "data-knob": name, "data-sim": "ligne", checked }), text);

/** Each setting of the line, as a field (line-options.js). */
const SETTINGS = {
  robots: (options) => el("label", {}, "Robots", select("lineRobots", ["1", "2", "3"].map((n) => [n, n]), String(options.robots), "ligne")),
  models: (options) => el("label", {}, "Modèles", select("lineModels", [["one", "un seul modèle"], ["mix", "essence et hybride mêlés"]], options.models, "ligne")),
  returns: (options) => box("lineReturns", options.returns, "Les bacs vides rapportés à l'étagère"),
  tour: (options) => box("lineTour", options.tour, "Un robot porte plusieurs bacs par tournée"),
  supermarket: (options) =>
    el("label", {}, "Le supermarché", select("lineSupermarket", [["none", "illimité"], ["warehouse", "commandé à l'entrepôt (10 à 40 min)"], ["pickers", "servi par 3 préparateurs, au plus juste"]], options.supermarket, "ligne")),
};

/** The settings of the chosen line (Sami, 29/10/2026: settings rather than lines of their own). */
function settings(sim) {
  const options = optionsOf(sim.setup);
  return el("fieldset", { class: "settings" }, el("legend", {}, "Réglages de la ligne"), ...settingsOf(lineOf(sim.planId)).map((name) => SETTINGS[name](options)));
}

export const lignePanel = ({ state }) => {
  const sim = state.sims.ligne;
  return panelOf("L'heure de ligne", sim, ["plan"], settings(sim), ...fieldsOf(sim, ["rule", "seed", "speed"]), ...playButtons(sim), ...driverFields(sim), el("p", { class: "hint" }, "Un tour = 5 s ; une heure = 720 tours. Les chiffres et leurs sources : docs/recherche/ligne-cadencee.md."));
};

/** A lane as a row: the reference, its bins (the one in use, how full; the full ones behind), the request out. */
function laneRow(lane) {
  const bins = [el("span", { class: `bin${lane.empty ? " empty" : ""}`, style: `--fill:${Math.round((100 * lane.pieces) / lane.capacity)}%`, title: `${lane.pieces} pièces dans le bac en cours` }), ...Array.from({ length: lane.full }, () => el("span", { class: "bin", style: "--fill:100%", title: "un bac plein" }))];
  return el("li", { class: lane.empty ? "empty" : null }, el("strong", {}, lane.ref), el("span", { class: "bins" }, ...bins), lane.request ? el("span", { class: "hint" }, ` bac demandé : ${lane.request}`) : null);
}

/**
 * The stock of parts at each station (Sami, 29/10/2026: "say that the gauges on the right are the stock levels"): its
 * gauges, what they are, and how the robots fill them up.
 */
function lineSide(state) {
  const stations = lanesOf(state).map((station) => el("li", {}, el("span", { class: "station-tag" }, `P${station.id}`), el("ul", { class: "lanes" }, ...station.lanes.map(laneRow))));
  const how = `Chaque jauge est un bac de ${state.setup.binPieces} pièces : d'abord le bac en cours, rempli selon ce qu'il reste, puis les bacs pleins derrière. Chaque véhicule prend une pièce de chaque référence de son poste. Un bac vidé appelle un robot, qui rapporte un bac plein du supermarché. Si un poste n'a plus de pièce, toute la ligne s'arrête.`;
  return el("aside", { class: "orders-card" }, ...restocksCard(state), el("h2", {}, "Le stock de pièces aux postes"), el("p", { class: "hint stock-note" }, how), el("ol", { class: "stations" }, ...stations));
}

/** The supermarket's orders to the warehouse under way, with a supermarket that has a stock (Sami, 29/10/2026). */
function restocksCard(state) {
  const restocks = restocksOf(state);
  if (!restocks) return [];
  const rows = restocks.map((one) => el("li", {}, el("strong", {}, one.block), ` ${one.where}, depuis ${one.since}`));
  const list = rows.length ? el("ul", { class: "restocks" }, ...rows) : el("p", { class: "hint" }, "Aucune commande en cours : le supermarché est assez plein.");
  return [el("h2", {}, "Les commandes à l'entrepôt"), list];
}

/** The models known to come, as chips (a mix of models only). */
function sequence(state) {
  const known = sequenceOf(state);
  if (!known.length) return [];
  const chips = known.map((one) => el("span", { class: `model ${one.name}${one.first ? " current" : ""}${one.planned ? " planned" : ""}`, title: one.planned ? "prévu, peut encore changer de place" : "sûr" }, one.name[0].toUpperCase()));
  const after = known.some((one) => one.planned) ? " (en clair : prévus, un véhicule peut encore changer de place)" : " (puis inconnue)";
  return [el("p", { class: "sequence hint" }, "La séquence connue : ", ...chips, after)];
}

/** What the tab shows, measures, and how long an hour plays (Sami, 29/10/2026: the three tabs told apart). */
const lineFacts = () =>
  facts([
    ["On regarde", "des robots qui apportent les bacs du supermarché au bord de ligne"],
    ["On mesure", "le temps où la ligne est arrêtée faute de pièce : moins, c'est mieux"],
    ["Durée", "une heure, 720 tours de 5 s ; un véhicule toutes les 55 s"],
  ]);

export function ligneView({ state }) {
  const sim = state.sims.ligne;
  const summary = el("p", { class: `summary status${sim.day.stopRun > 0 ? " line-stopped" : ""}`, "aria-live": "polite" }, sim.busy || lineStatus(sim.day));
  const layout = el("div", { class: "board-layout" }, el("div", { class: "board-wrap" }, lineBoard(sim.day)), lineSide(sim.day));
  return [lineFacts(), el("p", { class: "hint" }, INTRO), ...replayNote(sim), summary, ...sequence(sim.day), layout, lineKey(sim.day)];
}
