import { PLANS } from "../src/plans.js";
import { RULE_LABELS, RULES, compareRules } from "../src/rules.js";
import { createDay, drawDay, isOver, measuresOf, stepDay } from "../src/simulate.js";
import { blockageOf, cellsOf, ordersOf, robotsOf, statusLine } from "./view.js";

/**
 * The page: a day in the chosen warehouse under the chosen rule, played turn by turn (or all at once), then
 * the rules on the same 100 days. The plan can be edited (text, robots, orders, blockage): a new warehouse is
 * a new text. What it shows is computed in view.js; this module only draws and listens.
 */
const CELL = 34;
const COMPARED = 100;
const app = document.getElementById("app");
const state = { planId: "sami", setup: { ...PLANS.sami }, rule: "list", seed: 1, speed: 4, day: null, timer: null, compared: null, error: "" };

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) if (value !== null && value !== false && value !== undefined) node.setAttribute(key, value === true ? "" : value);
  node.append(...children.filter((child) => child !== null && child !== undefined));
  return node;
}
function svg(tag, attrs = {}, text = null) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  if (text !== null) node.textContent = text;
  return node;
}

function restart() {
  stop();
  state.day = createDay(state.setup, drawDay(state.seed, state.setup));
}
function stop() {
  clearInterval(state.timer);
  state.timer = null;
}
function play() {
  stop();
  state.timer = setInterval(() => {
    if (isOver(state.day)) {
      stop();
      render();
      return;
    }
    stepDay(state.day, RULES[state.rule]);
    render();
  }, 1000 / state.speed);
}

function select(name, options, current) {
  return el("select", { "data-knob": name }, ...options.map(([value, label]) => el("option", { value, selected: value === current }, label)));
}

function controls() {
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

function board() {
  const { plan } = state.day.warehouse;
  const blockage = blockageOf(state.day);
  const map = svg("svg", { viewBox: `0 0 ${plan.width * CELL} ${plan.height * CELL}`, class: "board", role: "img", "aria-label": "Le plan de l'entrepôt et les robots" });
  for (const cell of cellsOf(state.day)) {
    const kind = cell.kind === "blockable" && blockage.now ? `blockable blocked${blockage.seen ? " seen" : ""}` : cell.kind;
    const done = cell.kind === "block" && cell.pending === 0 ? " done" : "";
    map.append(svg("rect", { x: cell.x * CELL + 1, y: cell.y * CELL + 1, width: CELL - 2, height: CELL - 2, rx: 4, class: `cell ${kind}${done}` }));
    if (cell.kind === "block") map.append(svg("text", { x: cell.x * CELL + CELL / 2, y: cell.y * CELL + CELL / 2 + 5, class: "letter" }, cell.pending > 1 ? `${cell.letter}×${cell.pending}` : cell.letter));
    if (cell.kind === "dock") map.append(svg("text", { x: cell.x * CELL + CELL / 2, y: cell.y * CELL + CELL / 2 + 5, class: "letter dock-letter" }, "T"));
  }
  for (const robot of robotsOf(state.day)) {
    if (robot.ahead.length > 1) map.append(svg("polyline", { points: robot.ahead.map((step) => `${step.x * CELL + CELL / 2},${step.y * CELL + CELL / 2}`).join(" "), class: `trail r${robot.id}` }));
  }
  for (const robot of robotsOf(state.day)) {
    const group = svg("g", { class: `robot r${robot.id}`, transform: `translate(${robot.x * CELL + CELL / 2} ${robot.y * CELL + CELL / 2})` });
    group.append(svg("title", {}, robot.label), svg("circle", { r: CELL / 2 - 5 }), svg("text", { y: 4, class: "robot-id" }, String(robot.id)));
    if (robot.carrying) group.append(svg("rect", { x: 4, y: -CELL / 2 + 2, width: 10, height: 10, rx: 2, class: "parcel" }));
    map.append(group);
  }
  return el("div", { class: "board-wrap" }, map);
}

function orders() {
  return el("ol", { class: "orders" }, ...ordersOf(state.day).map((order) => el("li", { class: order.status }, el("strong", {}, order.block), ` ${order.label}`)));
}

function editor() {
  const { setup } = state;
  const field = (label, name, value, attrs = {}) => el("label", {}, label, el("input", { name, value: String(value), ...attrs }));
  return el(
    "details",
    { class: "editor" },
    el("summary", {}, "Changer d'entrepôt"),
    el("p", { class: "hint" }, "Le plan en texte : « . » le sol, une majuscule un bloc de rayons, « T » le camion, « ~ » une case qui peut se bloquer, « # » un mur. Les commandes sont des lettres de blocs, dans l'ordre où elles arrivent."),
    el("form", { "data-form": "plan" }, el("textarea", { name: "text", rows: String(Math.max(5, setup.text.split("\n").length + 1)), spellcheck: "false" }, setup.text), el("div", { class: "fields" }, field("Robots", "robots", setup.robots, { type: "number", min: "1", max: "12" }), field("Commandes", "orders", setup.orders), field("Blocage (%)", "blocking", Math.round(100 * setup.blocking), { type: "number", min: "0", max: "100" }), field("Durée du blocage (tours)", "duration", setup.duration, { type: "number", min: "1" }), field("Fin de la journée (tours)", "horizon", setup.horizon, { type: "number", min: "10" })), el("button", { type: "submit" }, "Appliquer")),
    state.error ? el("p", { class: "error", role: "alert" }, state.error) : null,
  );
}

function comparison() {
  if (!state.compared) return [el("button", { type: "button", class: "quiet compare", "data-action": "compare" }, `Comparer les règles sur ${COMPARED} journées`)];
  const fixed = (value, digits = 1) => value.toFixed(digits).replace(".", ",");
  const rows = Object.entries(state.compared).map(([name, row]) =>
    el("tr", { class: name === state.rule ? "current" : null }, el("td", {}, RULE_LABELS[name]), el("td", { class: "num" }, fixed(row.delivered, 2)), el("td", { class: "num" }, fixed(row.finish)), el("td", { class: "num" }, name === "list" ? "—" : `${fixed(row.gain.mean)} (${fixed(row.gain.low)} à ${fixed(row.gain.high)})`), el("td", { class: "num" }, fixed(row.waits)), el("td", { class: "num" }, fixed(row.replans, 2))),
  );
  const head = ["Règle", "livrées", "fini au tour", "tours gagnés sur la liste (IC 95 %)", "attentes", "replanifiés"].map((label) => el("th", {}, label));
  return [el("h2", {}, `Les règles sur les mêmes ${COMPARED} journées (blocage ${Math.round(100 * state.compared.list.blockedDays)} % des jours)`), el("div", { class: "scroll" }, el("table", {}, el("thead", {}, el("tr", {}, ...head)), el("tbody", {}, ...rows)))];
}

function render() {
  const over = isOver(state.day);
  app.replaceChildren(controls(), el("p", { class: "summary" }, statusLine(state.day, over ? measuresOf(state.day) : null)), el("div", { class: "layout" }, board(), el("aside", {}, el("h2", {}, "Les commandes"), orders())), ...comparison(), editor());
}

function applyPlan(form) {
  const data = new FormData(form);
  const setup = {
    ...state.setup,
    label: "Entrepôt modifié",
    text: String(data.get("text")).replace(/\s+$/, ""),
    robots: Math.max(1, Number(data.get("robots")) || 1),
    orders: String(data.get("orders")).replace(/[^A-Z]/g, ""),
    blocking: Math.min(1, Math.max(0, Number(data.get("blocking")) / 100 || 0)),
    duration: Math.max(1, Number(data.get("duration")) || 1),
    horizon: Math.max(10, Number(data.get("horizon")) || 10),
  };
  try {
    createDay(setup, { blockage: null });
    Object.assign(state, { setup, error: "", compared: null });
    restart();
  } catch (error) {
    state.error = `Plan refusé : ${error.message}`;
  }
}

const ACTIONS = {
  play,
  pause: stop,
  step: () => {
    stop();
    if (!isOver(state.day)) stepDay(state.day, RULES[state.rule]);
  },
  finish: () => {
    stop();
    while (!isOver(state.day)) stepDay(state.day, RULES[state.rule]);
  },
  restart,
  next: () => {
    state.seed += 1;
    restart();
  },
  compare: () => {
    state.compared = compareRules(state.setup, { days: COMPARED });
  },
};

app.addEventListener("change", (event) => {
  const name = event.target.dataset?.knob;
  if (!name) return;
  if (name === "plan") Object.assign(state, { planId: event.target.value, setup: { ...PLANS[event.target.value] }, compared: null, error: "" });
  else if (name === "seed") state.seed = Math.max(1, Number(event.target.value) || 1);
  else if (name === "speed") state.speed = Number(event.target.value);
  else state[name] = event.target.value;
  if (name === "speed" && state.timer) play();
  else restart();
  render();
});
app.addEventListener("click", (event) => {
  const action = event.target.closest?.("[data-action]")?.dataset.action;
  if (!ACTIONS[action]) return;
  ACTIONS[action]();
  render();
});
app.addEventListener("submit", (event) => {
  event.preventDefault();
  applyPlan(event.target);
  render();
});
restart();
render();
