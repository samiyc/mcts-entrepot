import { el } from "./dom.js";

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
  ligne: [
    ["Lignes simples", [["petite", "Petite ligne"], ["etroite", "Bord de ligne étroit"]]],
    ["La ligne de Sami", [["sami", "Deux robots"], ["seul", "Un seul robot"], ["melange", "Essence et hybride"], ["retours", "Les bacs vides rapportés"], ["tournee", "Un robot, plusieurs bacs"]]],
    ["Le supermarché et l'entrepôt", [["supermarche", "Réapprovisionné par l'entrepôt"], ["file", "Servi par 3 préparateurs"]]],
  ],
  usine: [["L'usine", [["usine", "Supermarché commandé à 1 bac"], ["vite", "Supermarché commandé à 2 bacs"], ["train", "Navette à heure fixe"]]]],
};

/** The groups of `kind`'s menu over its `plans`, those left out last. */
export function menuOf(kind, plans) {
  const groups = (MENUS[kind] ?? []).map(([title, items]) => [title, items.filter(([id]) => plans[id])]);
  const named = new Set(groups.flatMap(([, items]) => items.map(([id]) => id)));
  const others = Object.entries(plans)
    .filter(([id]) => !named.has(id))
    .map(([id, plan]) => [id, plan.label]);
  return others.length ? [...groups, ["Autres", others]] : groups;
}

/** The menu of plans of `sim`, in its groups, and the plan's whole label under it. */
export function planMenu(sim, plans, title) {
  const option = ([id, name]) => el("option", { value: id, selected: id === sim.planId }, name);
  const groups = menuOf(sim.kind, plans).map(([label, items]) => el("optgroup", { label }, ...items.map(option)));
  const select = el("select", { "data-knob": "plan", "data-sim": sim.kind }, ...groups);
  return [el("label", {}, title, select), el("p", { class: "hint plan-note" }, sim.setup.label ?? plans[sim.planId]?.label ?? "")];
}
