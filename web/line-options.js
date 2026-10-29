import { LINE_PLANS } from "../src/line-plan.js";

/**
 * The line's settings in the side panel (Sami, 29/10/2026: "Sami's line, replenished by the warehouse" and "served by 3
 * pickers" looked the same; settings of one line rather than lines of their own). The menu keeps the lines; the robots,
 * the models, the empties brought back, the bins a trip and the supermarket are set beside it. Each named variant of
 * line-plan.js, which the night measures keep, is its line under some settings (tests/line-options.test.js). Pure,
 * tested under Node.
 */

/** The variants of line-plan.js and the line each one sets. */
export const VARIANT_OF = Object.freeze({ seul: "sami", retours: "sami", tournee: "sami", melange: "sami", supermarche: "sami", file: "sami" });

/** The line a plan id is (itself, or the one its variant sets). */
export const lineOf = (planId) => VARIANT_OF[planId] ?? planId;

/** The settings a line takes: the models, the empties and the tours need Sami's line (its return shelf, its references). */
export const settingsOf = (line) => (line === "sami" ? ["robots", "models", "returns", "tour", "supermarket"] : ["robots", "supermarket"]);

/** The supermarket's kinds: endless (step 1), ordered from the warehouse with a lead drawn, served by a queue of pickers. */
const SUPERMARKETS = Object.freeze({ warehouse: LINE_PLANS.supermarche.supermarket, pickers: LINE_PLANS.file.supermarket });

/** The settings a setup holds. */
export function optionsOf(setup) {
  const supermarket = Object.keys(SUPERMARKETS).find((kind) => SUPERMARKETS[kind] === setup.supermarket) ?? "none";
  return { robots: setup.robots, models: setup.models ? "mix" : "one", returns: Boolean(setup.returnEmpties), tour: (setup.capacity ?? 1) > 1, supermarket };
}

/** The words of the settings that differ from the line's own, for its label. */
function wordsOf(base, options) {
  const plural = options.robots > 1 ? "s" : "";
  const words = [`${options.robots} robot${plural}`];
  if (options.models === "mix") words.push("essence et hybride mêlés");
  if (options.returns) words.push("les bacs vides rapportés");
  if (options.tour) words.push(`${LINE_PLANS.tournee.capacity} bacs par tournée`);
  if (options.supermarket === "warehouse") words.push("le supermarché commandé à l'entrepôt");
  if (options.supermarket === "pickers") words.push("le supermarché servi par 3 préparateurs");
  return `${base.label.replace(/ \(.*\)$/, "")} : ${words.join(", ")}`;
}

/** The setup of `line` under `options`, the same object as a named variant would be (its label aside). */
export function setupOf(line, options) {
  const base = LINE_PLANS[line];
  const setup = { ...base, label: wordsOf(base, options), robots: Number(options.robots) };
  if (options.models === "mix") setup.models = LINE_PLANS.melange.models;
  if (options.returns) Object.assign(setup, { text: LINE_PLANS.retours.text, returnEmpties: true });
  if (options.tour) setup.capacity = LINE_PLANS.tournee.capacity;
  if (options.supermarket !== "none") Object.assign(setup, { supermarket: SUPERMARKETS[options.supermarket], shortagesPerHour: 0 });
  return setup;
}

/** `setup` with one setting changed (the driver at the keys kept). */
export function withSetting(setup, planId, name, value) {
  const changed = setupOf(lineOf(planId), { ...optionsOf(setup), [name]: value });
  return setup.human ? { ...changed, human: setup.human } : changed;
}
