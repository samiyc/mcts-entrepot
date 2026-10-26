import { closed, isHome, keyOf } from "./day-basics.js";
import { legToPickup, planLeg, standBy } from "./day-legs.js";
import { arrive, discover, move, retry } from "./day-turn.js";
import { bringBin, createLine, drawLineDay, isShortNow, measuresOfLine, takt } from "./line-day.js";
import { distancesFrom, nearestPickup } from "./warehouse.js";

/**
 * The assembly line, turn by turn (Sami, 26/10/2026; line-day.js holds its day). The warehouse's robots on the
 * warehouse's paths (day-legs.js, day-turn.js: reserved legs, the `~` aisle seen only beside it, giving way): an idle
 * robot gets a request from the rule, fetches a full bin at its reference's block in the supermarket, takes a turn to
 * pick, carries it to the station's line side, takes a turn to drop. A reference short at the supermarket is seen only
 * by the robot come to pick it: it waits there, and every robot knows, until the bins are back. The same shape of
 * choices as simulate.js (`advance`, `nextChoice`, `choose`), so that the search and the page's worker work alike.
 */

const requestOf = (state, robot) => state.orders.find((order) => order.id === robot.order);

/** `robot` off to the line side of the request's station: the nearest drop cells first, kept as its target when none is reached now. */
function goDrop(state, robot, request) {
  const distances = distancesFrom(state.warehouse, robot, closed(state));
  const cells = [...state.stations[request.station].access].sort((a, b) => (distances.get(keyOf(a)) ?? Infinity) - (distances.get(keyOf(b)) ?? Infinity));
  if (!cells.slice(0, 3).some((cell) => planLeg(state, robot, cell))) robot.target = cells[0];
}

/** At the block: a full bin taken, or the reference short, seen, and waited for. */
function picked(state, robot, request) {
  if (isShortNow(state, request.block)) {
    if (state.known.short[request.block] === undefined) {
      state.known.short[request.block] = state.t;
      state.seenShortages = (state.seenShortages ?? 0) + 1;
      state.log.push({ t: state.t, type: "short", robot: robot.id, block: request.block });
    }
    robot.until = state.t + 1;
    return;
  }
  if (state.known.short[request.block] !== undefined) {
    delete state.known.short[request.block];
    state.log.push({ t: state.t, type: "restocked", block: request.block });
  }
  request.status = "carried";
  robot.phase = "toDrop";
  goDrop(state, robot, request);
}

function dropped(state, robot, request) {
  bringBin(state, request.lane);
  Object.assign(request, { status: "delivered", deliveredAt: state.t });
  Object.assign(robot, { phase: "idle", order: null, target: null });
  state.log.push({ t: state.t, type: "delivered", robot: robot.id, order: request.id });
}

/** Picks and drops that end now. */
function finishActions(state) {
  for (const robot of state.robots) {
    if (robot.until !== state.t) continue;
    robot.until = null;
    if (robot.phase === "picking") picked(state, robot, requestOf(state, robot));
    else if (robot.phase === "dropping") dropped(state, robot, requestOf(state, robot));
  }
}

/** The choice of idle `robot`, or null: with nothing it can take, it goes back where it started on the way. */
function choiceOf(state, robot) {
  const distances = distancesFrom(state.warehouse, robot, closed(state));
  const reach = (order) => nearestPickup(state.warehouse, order.block, distances)?.steps ?? Infinity;
  const open = state.orders.filter((order) => order.status === "open" && state.known.short[order.block] === undefined && reach(order) < Infinity);
  if (open.length > 0) return { robot, open, reach, distances };
  if (robot.phase === "idle" && !isHome(robot)) {
    if (planLeg(state, robot, robot.home)) robot.phase = "home";
    else standBy(state, robot);
  }
  return null;
}

/** The next idle robot of this turn with a request to choose: `{ robot, open, reach }`, or null once every robot has had its turn. */
export function nextChoice(state) {
  for (; state.cursor < state.robots.length; state.cursor += 1) {
    const robot = state.robots[state.cursor];
    if (robot.phase !== "idle" && robot.phase !== "home") continue;
    const choice = choiceOf(state, robot);
    if (choice) return choice;
  }
  return null;
}

/** `choice.robot` takes request `id` (when a leg to its block is found), and the turn moves to the next robot. */
export function choose(state, choice, id) {
  state.cursor += 1;
  const { robot, distances } = choice;
  const chosen = state.orders.find((order) => order.id === id && order.status === "open");
  if (!chosen) return;
  if (!legToPickup(state, robot, chosen, distances)) {
    standBy(state, robot);
    return;
  }
  Object.assign(chosen, { status: "assigned", robot: robot.id });
  Object.assign(robot, { phase: "toPick", order: chosen.id });
  state.log.push({ t: state.t, type: "assigned", robot: robot.id, order: chosen.id });
}

/** The start of a turn: the aisle seen, legs retried, picks and drops ended. */
export function beginTurn(state) {
  discover(state);
  retry(state);
  finishActions(state);
  state.cursor = 0;
}

/** The end of a turn: every robot moves, those arrived start their work, and the takt comes when it is due. */
export function endTurn(state) {
  move(state);
  arrive(state);
  if (state.t >= state.nextTakt) takt(state);
  state.cursor = null;
}

export const isOver = (state) => state.t >= state.setup.horizon;

/** Runs the day to its next choice: the choice, or null once the day is over. */
export function advance(state) {
  for (;;) {
    if (state.cursor === null) {
      if (isOver(state)) return null;
      beginTurn(state);
    }
    const choice = nextChoice(state);
    if (choice) return choice;
    endTurn(state);
  }
}

/** What a rule is shown and given, as in simulate.js. */
const ask = (state, choice, rule) => rule({ id: choice.robot.id, x: choice.robot.x, y: choice.robot.y }, choice.open, { t: state.t, reach: choice.reach, state })?.id;

/** Plays one turn of `state` under `rule`; returns the state. */
export function stepDay(state, rule) {
  if (state.cursor === null) beginTurn(state);
  for (let choice = nextChoice(state); choice; choice = nextChoice(state)) choose(state, choice, ask(state, choice, rule));
  endTurn(state);
  return state;
}

/** A copy of `state` the search may play forward. */
export function cloneLine(state) {
  return {
    ...state,
    robots: state.robots.map((robot) => ({ ...robot })),
    orders: state.orders.map((order) => ({ ...order })),
    lanes: state.lanes.map((lane) => ({ ...lane })),
    known: { ...state.known, short: { ...state.known.short } },
    stops: { ...state.stops },
    claims: new Map(),
    queues: new Map(),
    reservations: state.reservations.clone(),
    log: [],
  };
}

/** A whole day of `setup` from `seed` under `rule`: the final state and its measures. */
export function runLine(setup, seed, rule) {
  const state = createLine(setup, drawLineDay(seed, setup));
  while (!isOver(state)) stepDay(state, rule);
  return { state, measures: measuresOfLine(state) };
}

export { createLine, drawLineDay, measuresOfLine };
