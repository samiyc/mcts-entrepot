import { el } from "./dom.js";
import { LINE_NAMES, VARIANT_OF } from "./line-options.js";

/**
 * The plans in each tab's menu (Sami, 29/10/2026: "the three tabs are not clear"; the assembly station found by chance at
 * the end of the warehouse's list): grouped, a short name each, the plan's whole label written under the menu. A
 * group is `[title, [[planId, name], …]]`; a plan left out of the groups comes last, under its label.
 */
const MENUS = {
  entrepot: [
    ["Plans simples", [["petit", "Petit entrepôt"], ["couloirs", "Deux couloirs étroits"]]],
    ["Le plan de Sami", [["sami", "Les commandes au départ"], ["flux", "Les commandes au fil de la journée"], ["assemblage", "Avec un poste d'assemblage"]]],
    ["Plusieurs camions", [["quais", "Trois quais"]]],
  ],
  // The line's variants are its settings, under the menu (line-options.js).
  ligne: [["Les lignes", ["petite", "etroite", "sami"].map((id) => [id, LINE_NAMES[id]])]],
  usine: [["L'usine", [["usine", "Supermarché commandé à 1 bac"], ["vite", "Supermarché commandé à 2 bacs"], ["train", "Navette à heure fixe"]]]],
};

/** The plans a menu does not list, by kind, and the one each shows as: the line's variants show as their line. */
const SHOWN_AS = { ligne: VARIANT_OF };
const shownAs = (kind, planId) => SHOWN_AS[kind]?.[planId] ?? planId;

/** The groups of `kind`'s menu over its `plans`, those left out last. */
export function menuOf(kind, plans) {
  const groups = (MENUS[kind] ?? []).map(([title, items]) => [title, items.filter(([id]) => plans[id])]);
  const named = new Set(groups.flatMap(([, items]) => items.map(([id]) => id)));
  const others = Object.entries(plans)
    .filter(([id]) => !named.has(id) && shownAs(kind, id) === id)
    .map(([id, plan]) => [id, plan.label]);
  return others.length ? [...groups, ["Autres", others]] : groups;
}

/** The menu of plans of `sim`, in its groups, and the plan's whole label under it. */
export function planMenu(sim, plans, title) {
  const option = ([id, name]) => el("option", { value: id, selected: id === shownAs(sim.kind, sim.planId) }, name);
  const groups = menuOf(sim.kind, plans).map(([label, items]) => el("optgroup", { label }, ...items.map(option)));
  const select = el("select", { "data-knob": "plan", "data-sim": sim.kind }, ...groups);
  return [el("label", {}, title, select), el("p", { class: "hint plan-note" }, sim.setup.label ?? plans[sim.planId]?.label ?? "")];
}
