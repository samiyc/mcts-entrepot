import { cellOfKey, isDock, keyOf, sameCell } from "./day-basics.js";
import { goAside, hold, planLeg } from "./day-legs.js";

/**
 * The trucks' queues (simulate.js, split on 26/10/2026): a truck's cell takes one robot at a time, in the order they
 * come; the others wait their turn aside, on a cell whose loss cuts no aisle.
 */

/** The robots of a truck's queue: the one going there or dropping (`busy`), and those waiting, in order. */
export function queueOf(state, cell) {
  const members = (state.queues.get(keyOf(cell)) ?? []).map((id) => state.robots.find((one) => one.id === id));
  const busy = members.find((robot) => robot.phase === "dropping" || (robot.phase === "toDrop" && !robot.queued)) ?? null;
  return { members, busy };
}

/** `robot` waits its turn for `cell` (a truck's), aside. */
function wait(state, robot, cell) {
  if (!robot.queued) robot.queuedAt = state.t;
  robot.queued = cell;
  if (!goAside(state, robot, cell)) hold(state, robot);
}

/**
 * `robot` sets off to drop at `cell`. A truck's cell takes one robot at a time: it joins the cell's queue and,
 * while another goes there, waits aside (`robot.queued`, the cell it waits for). The target is kept when no
 * leg is found now (a robot parked on the way): retried every turn.
 */
export function goDrop(state, robot, cell) {
  if (isDock(state, cell)) {
    const queue = state.queues.get(keyOf(cell)) ?? [];
    if (!queue.includes(robot.id)) queue.push(robot.id);
    state.queues.set(keyOf(cell), queue);
    const { busy } = queueOf(state, cell);
    if (busy && busy !== robot) {
      wait(state, robot, cell);
      return;
    }
  }
  robot.queued = null;
  if (planLeg(state, robot, cell)) return;
  // No way into the truck now (someone still inside, its only door held): wait aside, never on the door.
  if (isDock(state, cell)) wait(state, robot, cell);
  else robot.target = cell;
}

/** Does `busy` keep its turn at `cell`: dropping, or its leg reaching the truck? */
const keepsTurn = (busy, cell) => {
  const end = busy.path?.at(-1);
  return busy.phase === "dropping" || Boolean(end && sameCell(end, cell));
};

/**
 * A truck's turn: the robot going there keeps it while its leg reaches the truck. Otherwise the first in the queue a
 * leg takes there goes (in a narrow aisle, the one stuck behind gives way), and the others wait.
 */
function callQueue(state, key, queue) {
  const cell = cellOfKey(key);
  const { members, busy } = queueOf(state, cell);
  if (busy && keepsTurn(busy, cell)) return;
  const next = members.find((robot) => robot.phase === "toDrop" && robot.until === null && planLeg(state, robot, cell));
  if (!next) return;
  next.queued = null;
  state.queues.set(key, [next.id, ...queue.filter((id) => id !== next.id)]);
  if (busy && busy !== next) wait(state, busy, cell);
}

/** Each truck's turn (`callQueue`). */
export function callQueues(state) {
  for (const [key, queue] of state.queues) callQueue(state, key, queue);
}

/** `robot` is done with `cell` (a truck's): out of its queue. */
export function leaveQueue(state, robot, cell) {
  const queue = state.queues.get(keyOf(cell));
  if (queue) state.queues.set(keyOf(cell), queue.filter((id) => id !== robot.id));
}

/** `robot` out of every queue. */
export function leaveQueues(state, robot) {
  for (const [key, queue] of state.queues) state.queues.set(key, queue.filter((id) => id !== robot.id));
}
