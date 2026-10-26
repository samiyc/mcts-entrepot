import { closed, isHome } from "./day-basics.js";
import { legToPickup, planLeg, standBy } from "./day-legs.js";
import { arrive, discover, move, retry } from "./day-turn.js";
import { createLine, drawLineDay, measuresOfLine, takt } from "./line-day.js";
import { arriveAtShelf, finishActions, startDelivery } from "./line-tour.js";
import { distancesFrom, nearestPickup } from "./warehouse.js";

/**
 * The assembly line, turn by turn (Sami, 26/10/2026; line-day.js holds its day). The warehouse's robots on the
 * warehouse's paths (day-legs.js, day-turn.js: reserved legs, the `~` aisle seen only beside it, giving way): an idle
 * robot gets a request from the rule, fetches a full bin at its reference's block in the supermarket, takes a turn to
 * pick, carries it to the station's line side, takes a turn to drop. A reference short at the supermarket is seen only
 * by the robot come to pick it: it waits there, and every robot knows, until the bins are back. A robot may carry
 * several bins a trip, and take the empties back (step 2, line-tour.js): while it has room at the supermarket, it is
 * offered another request. The same shape of choices as simulate.js (`advance`, `nextChoice`, `choose`), so that
 * the search and the page's worker work alike.
 */

/**
 * The choice of `robot`, idle or with room left at the supermarket, or null: with nothing it can take, a robot with
 * bins sets off on its round, an idle one goes back where it started on the way.
 */
function choiceOf(state, robot) {
  const distances = distancesFrom(state.warehouse, robot, closed(state));
  const reach = (order) => nearestPickup(state.warehouse, order.block, distances)?.steps ?? Infinity;
  const open = state.orders.filter((order) => order.status === "open" && state.known.short[order.block] === undefined && reach(order) < Infinity);
  if (open.length > 0) return { robot, open, reach, distances };
  if (robot.phase === "loading") startDelivery(state, robot);
  else if (robot.phase === "idle" && !isHome(robot)) {
    if (planLeg(state, robot, robot.home)) robot.phase = "home";
    else standBy(state, robot);
  }
  return null;
}

/** The next idle robot of this turn with a request to choose: `{ robot, open, reach }`, or null once every robot has had its turn. */
export function nextChoice(state) {
  for (; state.cursor < state.robots.length; state.cursor += 1) {
    const robot = state.robots[state.cursor];
    if (robot.phase !== "idle" && robot.phase !== "home" && robot.phase !== "loading") continue;
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
  if (!chosen || !legToPickup(state, robot, chosen, distances)) {
    // A robot with bins on its back sets off with them; an idle one, out of the way.
    if (robot.phase === "loading") startDelivery(state, robot);
    else if (chosen) standBy(state, robot);
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
  arriveAtShelf(state);
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
    robots: state.robots.map((robot) => ({ ...robot, load: [...robot.load] })),
    orders: state.orders.map((order) => ({ ...order })),
    lanes: state.lanes.map((lane) => ({ ...lane })),
    empties: [...state.empties],
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
