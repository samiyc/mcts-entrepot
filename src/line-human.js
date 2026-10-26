import { besides, blockedNow, cellOfKey, keyOf, sameCell } from "./day-basics.js";
import { hold } from "./day-legs.js";
import { spotsOf } from "./day-spots.js";
import { bringBin, isShortNow } from "./line-day.js";
import { distancesFrom } from "./warehouse.js";

/**
 * The forklift driver on the line (Sami, 26/10/2026; docs/recherche/feuille-de-route.md, step 3; as the cook of
 * mcts-cuisine and the intern of mcts-urgences): a person on the grid, one action a turn, `up`, `down`, `left`, `right`,
 * `act` or `wait` (the keys Z Q S D or the arrows, and E). Beside a block, `act` takes the full bin of an open request
 * for its reference; on the drop cells of that request's station, `act` sets it down. The driver plans nothing ahead
 * but holds the cell it stands on: the robots whose legs cross it plan again around it (day-legs.js `hold`), and it
 * never steps where a robot is or comes next turn. Its actions are written down turn by turn (`actions`): played again,
 * the hour is the same. A replay's actions (`script`) play themselves.
 */
const STEPS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
export const HUMAN = "cariste";

/** The driver at the start: on the free aside cell nearest the supermarket's first block, or given its script. */
export function addHuman(state, script = null) {
  const taken = new Set(state.robots.map(keyOf));
  const { aside } = spotsOf(state.warehouse);
  const first = [...state.warehouse.blocks.values()][0][0];
  const from = distancesFrom(state.warehouse, first);
  const key = [...aside].filter((one) => !taken.has(one)).sort((a, b) => (from.get(a) ?? Infinity) - (from.get(b) ?? Infinity))[0];
  state.human = { id: HUMAN, ...cellOfKey(key), load: null, next: null, actions: [], script, moves: 0, delivered: 0 };
  hold(state, state.human);
  return state.human;
}

/** May the driver step onto `cell`: floor, no robot there now or next turn, not a blocked aisle. */
function free(state, cell) {
  const char = state.warehouse.plan.at(cell.x, cell.y);
  if (!state.warehouse.floor(char) || (char === "~" && blockedNow(state, state.t + 1))) return false;
  return !state.robots.some((robot) => sameCell(robot, cell) || robot.path?.some((step) => step.t === state.t + 1 && sameCell(step, cell)));
}

const besideBlock = (state, human) => besides(human).map((cell) => state.warehouse.plan.at(cell.x, cell.y)).find((char) => state.warehouse.blocks.has(char)) ?? null;
const atStation = (state, human, request) => state.stations[request.station].access.some((cell) => sameCell(cell, human));

/** `act` beside a block: the full bin of the oldest open request for its reference, unless the reference is short. */
function take(state, human) {
  const block = besideBlock(state, human);
  const request = block && state.orders.find((order) => order.status === "open" && order.block === block);
  if (!request) return;
  if (isShortNow(state, block)) {
    if (state.known.short[block] === undefined) state.known.short[block] = state.t;
    return;
  }
  Object.assign(request, { status: "carried", robot: HUMAN });
  human.load = request.id;
  state.log.push({ t: state.t, type: "humanTook", order: request.id });
}

/** `act` at the right station: the bin set down. */
function drop(state, human) {
  const request = state.orders.find((order) => order.id === human.load);
  if (!atStation(state, human, request)) return;
  bringBin(state, request.lane);
  Object.assign(request, { status: "delivered", deliveredAt: state.t });
  human.load = null;
  human.delivered += 1;
  state.log.push({ t: state.t, type: "humanDelivered", order: request.id });
}

/** A step of the driver, if the cell is free; its cell held, the robots planning around it. */
function step(state, human, action) {
  const [dx, dy] = STEPS[action];
  const cell = { x: human.x + dx, y: human.y + dy };
  if (!free(state, cell)) return;
  Object.assign(human, { x: cell.x, y: cell.y, moves: human.moves + 1 });
  hold(state, human);
}

/** The driver's action of this turn: its script's, else the one asked (`next`), else waiting; written down. */
export function humanTurn(state) {
  const human = state.human;
  if (!human) return;
  const action = (human.script ? human.script[human.actions.length] : human.next) ?? "wait";
  human.actions.push(action);
  human.next = null;
  if (action === "act" && human.load === null) take(state, human);
  else if (action === "act") drop(state, human);
  else if (STEPS[action]) step(state, human, action);
}
