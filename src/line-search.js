import { search } from "mcts-commun/mcts.js";
import { createRng } from "mcts-commun/random.js";
import { drawShortages } from "./line-day.js";
import { worldSequence } from "./line-models.js";
import { worldRestocks } from "./line-supermarket.js";
import { LINE_RULES, coverOf } from "./line-rules.js";
import { advance, choose, cloneLine, nextChoice } from "./line.js";
import { drawBlockages } from "./simulate.js";

/**
 * The search (ISMCTS, `search` of mcts-commun) choosing which bin an idle robot brings (Sami, 26/10/2026), as
 * src/search.js does for the warehouse's orders. What the robots cannot know is drawn again at every iteration: the
 * blockages of the aisle to come, the supplier shortages not seen yet (a shortage seen goes on for a drawn while), and
 * the models of the vehicles beyond the frozen sequence.
 * A world is played `lookahead` turns ahead (an hour of the line is too long to roll out at every iteration; two bins
 * cover 11 minutes, 15 minutes see what a choice costs), by `rollout` beyond the tree, and scored on the turns the line
 * stood still against the same rule's from the same point.
 */
export const LINE_SEARCH_SETTINGS = Object.freeze({ budget: 64, depth: 2, explore: 0.3, width: 5, spread: 20, seed: 1, lookahead: 180, rollout: "nearest", calm: false });

/** The shortages of a world: those seen go on a drawn while, those to come are drawn again after now. */
function worldShortages(state, rng) {
  const [shortest, longest] = state.setup.shortageTurns;
  const seen = Object.entries(state.known.short).map(([block, since]) => ({ block, from: since, to: Math.max(state.t + 1, since + shortest + rng.int(longest - shortest + 1)) }));
  return [...seen, ...drawShortages(rng, state.setup, state.t + 1)];
}

/**
 * The line as a world may be: what the robots have not seen drawn again. With `restocks: false` (the plant, where the
 * warehouse is played beside the line), the orders under way are copied as they are, the warehouse will bring them.
 */
export function redrawLine(state, rng, { restocks: redraw = true } = {}) {
  const world = cloneLine(state);
  const { known } = state;
  const now = state.t <= known.blockedUntil ? [{ from: known.seenAt, to: known.blockedUntil + 1 }] : [];
  const blockages = [...now, ...drawBlockages(rng, state.setup, Math.max(state.t, known.blockedUntil) + 1)];
  const { restocks, leads, pickersFree } = redraw ? worldRestocks(state, rng) : { restocks: state.restocks.map((one) => ({ ...one })), leads: state.day.leads, pickersFree: world.pickersFree };
  world.day = { ...state.day, blockages, shortages: worldShortages(state, rng), sequence: worldSequence(state, rng), leads };
  world.restocks = restocks;
  world.pickersFree = pickersFree;
  return world;
}

/** A world consistent with what the robots know at this choice, played up to `limit`. */
export function drawLineWorld(state, rng, limit = state.setup.horizon) {
  const world = redrawLine(state, rng);
  world.limit = limit;
  world.choice = nextChoice(world);
  return world;
}

const ended = (world) => !world.choice || world.t >= world.limit;

function rollOut(world, rule) {
  while (!ended(world)) {
    const { choice } = world;
    choose(world, choice, rule({ id: choice.robot.id, x: choice.robot.x, y: choice.robot.y }, choice.open, { t: world.t, reach: choice.reach, state: world })?.id);
    world.choice = advance(world);
  }
  return world;
}

/** The shortlist: the nearest requests, the oldest, the shortest cover; `width` at most. */
function shortlistOf(world, moves, width) {
  const { reach } = world.choice;
  const near = [...moves].sort((a, b) => reach(a.order) - reach(b.order) || a.order.id - b.order.id);
  const urgent = [...moves].sort((a, b) => coverOf(world, a.order) - coverOf(world, b.order) || a.order.id - b.order.id);
  const ranked = [...near.slice(0, 2), ...moves.slice(0, 1), ...urgent.slice(0, 2), ...near];
  return [...new Map(ranked.map((move) => [move.key, move])).values()].slice(0, width);
}

function problemFor(base, { width, spread, rule }) {
  return {
    sample: (state, rng) => drawLineWorld(state, rng, state.limit),
    actor: () => "robots",
    moves: (world) => world.choice.open.map((order) => ({ id: order.id, order, key: `${world.choice.robot.id}>${order.id}` })),
    shortlist: (world, moves) => shortlistOf(world, moves, width),
    key: (move) => move.key,
    play(world, move) {
      choose(world, world.choice, move.id);
      world.choice = advance(world);
      return world;
    },
    over: ended,
    rollout: (world) => rollOut(world, rule),
    score: (world) => Math.min(1, Math.max(0, 0.5 + (base - world.stopped) / spread)),
  };
}

/** The rollout rule's mean stop over a few drawn worlds: the scores' middle. */
function baseOf(state, rng, rule, runs = 4) {
  let total = 0;
  for (let i = 0; i < runs; i += 1) total += rollOut(drawLineWorld(state, rng, state.limit), rule).stopped;
  return total / runs;
}

/**
 * The search as a rule (line.js's signature, reading `context.state`): a single open request is taken at once;
 * otherwise `budget` iterations, seeded from the turn and the robot. With `calm` (Sami, 26/10/2026: the search is
 * slow on well-fed lines and gains nothing there), when the rollout rule stops the line in none of the worlds drawn for
 * the base, there is nothing to win: the rule's choice, without a tree. `earlyStop` and `onSearch` as in search.js.
 * @param {Record<string, any> & import("./types.js").SearchHooks} [options]
 * @returns {import("./types.js").Rule}
 */
export function lineSearchRule(options = {}) {
  const { budget, depth, explore, width, spread, seed, lookahead, rollout, calm, earlyStop, onSearch } = { ...LINE_SEARCH_SETTINGS, ...options };
  const rule = LINE_RULES[rollout];
  return (robot, open, context) => {
    // An hour of the line, not a warehouse's day: the rule's types know only the warehouse's.
    const state = /** @type {any} */ (context.state);
    if (open.length === 1) return open[0];
    const rng = createRng((Math.imul(seed, 0x9e3779b1) + state.t * 131 + robot.id * 7 + open.length) >>> 0);
    const root = { ...state, limit: Math.min(state.setup.horizon, state.t + lookahead) };
    const base = baseOf(root, rng, rule);
    if (calm && base === state.stopped) return rule(robot, open, /** @type {any} */ (context));
    const found = search(root, problemFor(base, { width, spread, rule }), { budget, rng, depth, explore, common: true, earlyStop });
    onSearch?.(found, depth);
    return open.find((order) => order.id === found.move?.id) ?? open[0];
  };
}
