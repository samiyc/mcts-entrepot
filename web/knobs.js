import { el } from "./dom.js";
import { planMenu } from "./menus.js";
import { MODELS } from "./models.js";
import { REPLAY_HINT } from "./replay-keys.js";

/**
 * The settings of a simulation, in the side panel (Sami, 26/10/2026, as in mcts-urgences): its plan, its rule, the
 * day's number, the speed. A tab shows those it uses (`names`); each field says the simulation it sets (`data-sim`)
 * and a change is the page's (`data-knob`, app.js).
 */
export function select(name, options, current, kind) {
  return el("select", { "data-knob": name, "data-sim": kind }, ...options.map(([value, label]) => el("option", { value, selected: value === current }, label)));
}

/** What a simulation's plan and day are called: the warehouse's days, the line's and the plant's hours. */
const WORDS = { entrepot: { plan: "Entrepôt", day: "Journée" }, ligne: { plan: "Ligne", day: "Heure" }, usine: { plan: "Usine", day: "Heure" } };

/** The speeds of play, slowest first: turns a second. */
export const SPEEDS = [
  ["2", "lente"],
  ["4", "normale"],
  ["10", "rapide"],
];

const FIELDS = {
  plan: (sim) => planMenu(sim, MODELS[sim.kind].plans, WORDS[sim.kind].plan),
  rule: (sim) => el("label", {}, "Règle", select("rule", Object.entries(MODELS[sim.kind].labels), sim.rule, sim.kind)),
  seed: (sim) => el("label", {}, `${WORDS[sim.kind].day} n°`, el("input", { type: "number", min: "1", value: String(sim.seed), "data-knob": "seed", "data-sim": sim.kind, inputmode: "numeric" })),
  speed: (sim) => el("label", {}, "Vitesse", select("speed", SPEEDS, String(sim.speed), sim.kind)),
};

/** The settings of `sim` named, as fields. */
export const fieldsOf = (sim, names) => names.flatMap((name) => FIELDS[name](sim));

/** The panel of a tab: its title, the settings of `sim` it uses, then its own fields. */
export function panelOf(title, sim, names, ...own) {
  return el("section", { class: "panel" }, el("h2", {}, title), ...fieldsOf(sim, names), ...own);
}

/** A row of buttons, each `[action, label, quiet]`, acting on the simulation `kind` (`data-sim`). */
export const buttons = (kind, ...specs) => el("div", { class: "row-buttons" }, ...specs.map(([action, label, quiet]) => el("button", { type: "button", class: quiet ? "quiet" : null, "data-action": action, "data-sim": kind }, label)));

/** The play buttons of a simulation's tab. */
export function playButtons(sim) {
  const play = sim.timer !== null ? ["pause", "Pause"] : ["play", "Jouer"];
  return [buttons(sim.kind, play, ["step", "Un tour", true], ["finish", "Jusqu'au bout", true]), buttons(sim.kind, ["restart", "Recommencer", true], ["next", `${WORDS[sim.kind].day} suivante`, true]), el("p", { class: "hint keys-hint" }, REPLAY_HINT)];
}
