import { el } from "./dom.js";
import { MODELS } from "./models.js";

/**
 * The settings of a simulation, in the side panel (Sami, 26/10/2026, as in mcts-urgences): its plan, its rule, the
 * day's number, the speed. A tab shows those it uses (`names`); each field says the simulation it sets (`data-sim`)
 * and a change is the page's (`data-knob`, app.js).
 */
export function select(name, options, current, kind) {
  return el("select", { "data-knob": name, "data-sim": kind }, ...options.map(([value, label]) => el("option", { value, selected: value === current }, label)));
}

const FIELDS = {
  plan: (sim) => el("label", {}, sim.kind === "ligne" ? "Ligne" : "Entrepôt", select("plan", Object.entries(MODELS[sim.kind].plans).map(([id, plan]) => [id, plan.label]), sim.planId, sim.kind)),
  rule: (sim) => el("label", {}, "Règle", select("rule", Object.entries(MODELS[sim.kind].labels), sim.rule, sim.kind)),
  seed: (sim) => el("label", {}, sim.kind === "ligne" ? "Heure n°" : "Journée n°", el("input", { type: "number", min: "1", value: String(sim.seed), "data-knob": "seed", "data-sim": sim.kind, inputmode: "numeric" })),
  speed: (sim) => el("label", {}, "Vitesse", select("speed", [["2", "lente"], ["4", "normale"], ["10", "rapide"]], String(sim.speed), sim.kind)),
};

/** The panel of a tab: its title, the settings of `sim` it uses, then its own fields. */
export function panelOf(title, sim, names, ...own) {
  return el("section", { class: "panel" }, el("h2", {}, title), ...names.map((name) => FIELDS[name](sim)), ...own);
}

/** A row of buttons, each `[action, label, quiet]`, acting on the simulation `kind` (`data-sim`). */
export const buttons = (kind, ...specs) => el("div", { class: "row-buttons" }, ...specs.map(([action, label, quiet]) => el("button", { type: "button", class: quiet ? "quiet" : null, "data-action": action, "data-sim": kind }, label)));

/** The play buttons of a simulation's tab. */
export function playButtons(sim) {
  const play = sim.timer !== null ? ["pause", "Pause"] : ["play", "Jouer"];
  return [buttons(sim.kind, play, ["step", "Un tour", true], ["finish", "Jusqu'au bout", true]), buttons(sim.kind, ["restart", "Recommencer", true], ["next", sim.kind === "ligne" ? "Heure suivante" : "Journée suivante", true])];
}
