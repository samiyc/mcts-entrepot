import { PLANS } from "../src/plans.js";
import { RULE_LABELS } from "../src/rules.js";
import { el } from "./dom.js";

/**
 * The settings shared by the tabs, in the side panel (Sami, 26/10/2026, as in mcts-urgences): the warehouse, the rule,
 * the day's number, the speed. A tab shows those it uses (`names`); a change is the page's (`data-knob`, app.js).
 */
export function select(name, options, current) {
  return el("select", { "data-knob": name }, ...options.map(([value, label]) => el("option", { value, selected: value === current }, label)));
}

const FIELDS = {
  plan: (state) => el("label", {}, "Entrepôt", select("plan", Object.entries(PLANS).map(([id, plan]) => [id, plan.label]), state.planId)),
  rule: (state) => el("label", {}, "Règle", select("rule", Object.entries(RULE_LABELS), state.rule)),
  seed: (state) => el("label", {}, "Journée n°", el("input", { type: "number", min: "1", value: String(state.seed), "data-knob": "seed", inputmode: "numeric" })),
  speed: (state) => el("label", {}, "Vitesse", select("speed", [["2", "lente"], ["4", "normale"], ["10", "rapide"]], String(state.speed))),
};

/** The panel of a tab: its title, the shared settings it uses, then its own fields. */
export function panelOf(title, state, names, ...own) {
  return el("section", { class: "panel" }, el("h2", {}, title), ...names.map((name) => FIELDS[name](state)), ...own);
}

/** A row of buttons, each `[action, label, quiet]`. */
export const buttons = (...specs) => el("div", { class: "row-buttons" }, ...specs.map(([action, label, quiet]) => el("button", { type: "button", class: quiet ? "quiet" : null, "data-action": action }, label)));
