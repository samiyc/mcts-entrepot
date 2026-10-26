import { PLANS } from "../src/plans.js";
import { RULE_LABELS } from "../src/rules.js";
import { el } from "./dom.js";
import { ordersOf } from "./view.js";

/** The page's panels around the board (app.js, split on 26/10/2026): the settings, the orders, the plan editor, the comparison. */
export const COMPARED = 100;
export const COMPARED_WITH_SEARCH = 12;

function select(name, options, current) {
  return el("select", { "data-knob": name }, ...options.map(([value, label]) => el("option", { value, selected: value === current }, label)));
}

export function controls(state) {
  const playing = state.timer !== null;
  return el(
    "div",
    { class: "controls" },
    el("label", {}, "Entrepôt", select("plan", Object.entries(PLANS).map(([id, plan]) => [id, plan.label]), state.planId)),
    el("label", {}, "Règle", select("rule", Object.entries(RULE_LABELS), state.rule)),
    el("label", {}, "Journée n°", el("input", { type: "number", min: "1", value: String(state.seed), "data-knob": "seed", inputmode: "numeric" })),
    el("label", {}, "Vitesse", select("speed", [["2", "lente"], ["4", "normale"], ["10", "rapide"]], String(state.speed))),
    el("button", { type: "button", "data-action": playing ? "pause" : "play" }, playing ? "Pause" : "Jouer"),
    el("button", { type: "button", class: "quiet", "data-action": "step" }, "Un tour"),
    el("button", { type: "button", class: "quiet", "data-action": "finish" }, "Jusqu'au bout"),
    el("button", { type: "button", class: "quiet", "data-action": "restart" }, "Recommencer"),
    el("button", { type: "button", class: "quiet", "data-action": "next" }, "Journée suivante"),
  );
}

export function orders(day) {
  return el("ol", { class: "orders" }, ...ordersOf(day).map((order) => el("li", { class: order.status }, el("strong", {}, order.block), order.truck ? el("span", { class: "truck-tag" }, `camion ${order.truck}`) : null, ` ${order.label}`)));
}

const HINT =
  "Le plan en texte : « . » le sol, une majuscule un bloc de rayons, « T » un quai où vient un camion, « w » une case devant un quai où une palette attend son camion (une par case), « c » une borne de charge d'où part un robot et où il revient, « ~ » une case qui peut se bloquer, « # » un mur ou l'extérieur. Les commandes sont des lettres de blocs, dans l'ordre où elles arrivent, un groupe par camion séparé par « / » (les quais dans l'ordre de lecture, de haut en bas) ; les camions arrivent aux tours donnés, séparés par des espaces.";

function planFields(setup) {
  const field = (label, name, value, attrs = {}) => el("label", {}, label, el("input", { name, value: String(value), ...attrs }));
  return el(
    "div",
    { class: "fields" },
    field("Robots", "robots", setup.robots, { type: "number", min: "1", max: "12" }),
    field("Commandes", "orders", setup.orders),
    field("Arrivée des camions (tours)", "trucks", (setup.trucks ?? []).join(" ")),
    field("Allée bloquée (% du temps)", "blocking", Math.round(100 * setup.blocking), { type: "number", min: "0", max: "100" }),
    field("Durée du blocage (tours)", "duration", setup.duration, { type: "number", min: "1" }),
    field("Fin de la journée (tours)", "horizon", setup.horizon, { type: "number", min: "10" }),
    el("label", { class: "check" }, el("input", { name: "autoZones", type: "checkbox", checked: setup.autoZones !== false }), "Zone d'attente automatique (jusqu'à 3 cases du camion) pour un camion qui n'en a pas"),
  );
}

export function editor(state) {
  const { setup } = state;
  const text = el("textarea", { name: "text", rows: String(Math.max(5, setup.text.split("\n").length + 1)), spellcheck: "false" }, setup.text);
  return el(
    "details",
    { class: "editor" },
    el("summary", {}, "Changer d'entrepôt"),
    el("p", { class: "hint" }, HINT),
    el("form", { "data-form": "plan" }, text, planFields(setup), el("button", { type: "submit" }, "Appliquer")),
    state.error ? el("p", { class: "error", role: "alert" }, state.error) : null,
  );
}

/** At least `min`, from a field (`min` when it is not a number). */
const atLeast = (min, value) => Math.max(min, Number(value) || min);

/** The setup the editor's `form` describes, over `setup`. */
export function readPlan(form, setup) {
  const data = new FormData(form);
  return {
    ...setup,
    label: "Entrepôt modifié",
    text: String(data.get("text")).trimEnd(),
    robots: atLeast(1, data.get("robots")),
    orders: String(data.get("orders")).replace(/[^A-Z/]/g, ""),
    trucks: String(data.get("trucks")).split(/[\s,;]+/).filter(Boolean).map((value) => atLeast(0, value)),
    blocking: Math.min(1, atLeast(0, Number(data.get("blocking")) / 100)),
    duration: atLeast(1, data.get("duration")),
    horizon: atLeast(10, data.get("horizon")),
    autoZones: Boolean(data.get("autoZones")),
  };
}

const fixed = (value, digits = 1) => value.toFixed(digits).replace(".", ",");
const HEAD = ["Règle", "livrées", "fini au tour", "temps à quai des camions (tours)", "temps à quai gagné sur la liste (IC 95 %)", "prêtes avant leur camion", "attentes des robots", "replanifiés"];

function comparedRow(state, name, row) {
  const num = (text) => el("td", { class: "num" }, text);
  const gain = name === "list" ? "—" : `${fixed(row.gain.mean)} (${fixed(row.gain.low)} à ${fixed(row.gain.high)})`;
  return el("tr", { class: name === state.rule ? "current" : null }, el("td", {}, RULE_LABELS[name]), num(fixed(row.delivered, 2)), num(fixed(row.finish)), num(fixed(row.truckWait)), num(gain), num(fixed(row.early)), num(fixed(row.waits)), num(fixed(row.replans, 2)));
}

export function comparison(state) {
  const buttons = el(
    "div",
    { class: "controls" },
    el("button", { type: "button", class: "quiet compare", "data-action": "compare" }, `Comparer les règles sur ${COMPARED} journées`),
    el("button", { type: "button", class: "quiet compare", "data-action": "compareSearch" }, `Comparer avec la recherche sur ${COMPARED_WITH_SEARCH} journées`),
  );
  if (!state.compared) return [buttons];
  const { days, rows: compared } = state.compared;
  const rows = Object.entries(compared).map(([name, row]) => comparedRow(state, name, row));
  const head = HEAD.map((label, i) => el("th", { class: i > 0 ? "num" : null }, label));
  const table = el("table", {}, el("thead", {}, el("tr", {}, ...head)), el("tbody", {}, ...rows));
  return [el("h2", {}, `Les règles sur les mêmes ${days} journées (blocage ${Math.round(100 * compared.list.blockedDays)} % des jours)`), el("div", { class: "scroll" }, table), buttons];
}
