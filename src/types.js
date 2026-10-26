/**
 * The shapes the modules hand each other, for the type check (`npm run types`, tsc on the JSDoc; Sami, 26/10/2026, as
 * in mcts-urgences): nothing runs here. A module imports one with `@typedef {import("./types.js").Rule} Rule`.
 */

/** A cell of the plan. @typedef {{ x: number, y: number }} Cell */

/**
 * A robot during a day (simulate.js): where it is and starts from, what it does (`phase`), the order it carries or
 * fetches, its leg (`path`, `target`), its turn at a truck (`queued`), a relay it is part of, and its counts.
 * @typedef {{
 *   id: number, x: number, y: number, home: Cell, phase: string, order: number | null, target: Cell | null,
 *   queued: Cell | null, queuedAt?: number, resume: Cell | null, blockedFor: number, path: (Cell & { t: number })[] | null,
 *   until: number | null, moves: number, waits: number, relay?: number | null, relayGoal?: Cell | null,
 *   relayOrder?: number | null, relaySince?: number | null,
 * }} Robot
 */

/**
 * An order: a block to fetch from, for a truck (its index); its status from `open` to `delivered`, the robot on it,
 * the waiting cell it holds on a bay (`cell`), and when it was staged and delivered.
 * @typedef {{
 *   id: number, block: string, truck: number, status: string, robot: number | null, deliveredAt: number | null,
 *   stagedAt: number | null, cell: Cell | null, relayed?: boolean,
 * }} Order
 */

/** A truck: its dock (with its bay and zones), its arrival turn, its orders' blocks, its loaders by zone. @typedef {{ id: number, dock: Cell & { bay: Cell[], zones: Cell[][], auto?: boolean }, at: number, blocks: string, loaders: Record<string, number> }} Truck */

/**
 * A day under way (simulate.js `createDay`): the warehouse and its setup, what the day hides (`day.blockages`), the
 * turn, the trucks, robots and orders, the claimed bay cells, the trucks' queues, what the robots know of the aisle,
 * the reservations, the log, the counts, and the robot whose choice comes next (`cursor`, null between turns).
 * @typedef {{
 *   warehouse: object, setup: object, day: { blockages: { from: number, to: number }[] }, t: number, trucks: Truck[],
 *   robots: Robot[], orders: Order[], claims: Map<string, number>, queues: Map<string, number[]>,
 *   known: { blockedUntil: number, seenAt: number | null, seen?: number }, reservations: object, log: object[],
 *   replans: number, stuck: number, relays?: number, cursor: number | null,
 * }} Day
 */

/** What a rule is told at a choice: the turn, the floor distance to an order, and the day (only the search reads it). @typedef {{ t?: number, reach?: (order: Order) => number, state?: Day }} RuleContext */

/** A rule: which of the open orders the robot takes (rules.js, search.js). @typedef {(robot: { id: number, x: number, y: number }, open: Order[], context?: RuleContext) => Order} Rule */

/**
 * A day's measures (simulate.js `measuresOf`).
 * @typedef {{
 *   orders: number, delivered: number, finish: number, meanDelivery: number, moves: number, waits: number,
 *   replans: number, stuck: number, truckWait: number, early: number, relays: number, blocked: boolean,
 *   blockages: number, seenAt: number | null,
 * }} Measures
 */

/**
 * A rule's days summed up (rules.js `summaryOf`): the mean measures, the share of days with a blockage, and the truck
 * waits gained on the list order by pairs (null without the list).
 * @typedef {{
 *   delivered: number, finish: number, meanDelivery: number, moves: number, waits: number, replans: number,
 *   stuck: number, truckWait: number, early: number, blockedDays: number,
 *   gain: { mean: number, low: number, high: number } | null,
 * }} Summary
 */

/**
 * A rule's hours of the assembly line summed up (line-rules.js `summaryOfLine`): the mean measures, and the turns the
 * line stood still gained on the kanban by pairs (null without the kanban).
 * @typedef {{
 *   stopped: number, stoppedSeconds: number, produced: number, longestStop: number, maxWip: number, meanResponse: number,
 *   moves: number, waits: number, replans: number, stuck: number, shortages: number,
 *   gain: { mean: number, low: number, high: number } | null,
 * }} LineSummary
 */

export {};
