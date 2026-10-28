import { closed } from "./day-basics.js";
import { SIDES } from "./warehouse.js";

/**
 * A quick screen before A* (28/10/2026: on a day with the search, the legs not found were 6 to 23 % of A*'s calls but
 * 29 to 34 % of its time, most sweeping the whole plan before giving up). A robot parked for good from the next turn
 * on is a wall at every turn after it (the reservations' `stay`); when `robot` cannot reach its target on the floor
 * around those walls, no path in time can either, and A* is not asked. It lets through more than a leg may (pallets
 * left out), never less: it only rejects, so no leg found changes.
 */

// Scratch grids, a stamp a sweep: the screen runs before nearly every leg, so neither a Set nor a string key in it.
let marks = new Int32Array(0);
let queue = new Int32Array(0);
let stamp = 0;

/** The cells (`x + y × width`) where a robot other than `robot` is parked for good from the next turn at the latest. */
function wallsFor(state, robot, width) {
  const walls = [];
  for (const other of state.robots) {
    if (other === robot) continue;
    // A robot parks where its leg ends (planLeg and hold reserve with `stay`); the table says since when.
    const end = other.path?.at(-1) ?? other;
    const stay = state.reservations.stayAt(end.x, end.y);
    if (stay && stay.unit !== robot.id && stay.from <= state.t + 1) walls.push(end.x + end.y * width);
  }
  return walls;
}

/** A breadth-first sweep of the cells `enters` lets through, from cell `start` (`x + y × width`): is `goal` reached? */
function sweep(plan, start, goal, enters) {
  marks[start] = stamp;
  queue[0] = start;
  for (let i = 0, end = 1; i < end; i += 1) {
    const cell = queue[i];
    if (cell === goal) return true;
    const x = cell % plan.width;
    const y = (cell - x) / plan.width;
    for (const [dx, dy] of SIDES) {
      const id = x + dx + (y + dy) * plan.width;
      if (!plan.inside(x + dx, y + dy) || marks[id] === stamp || !enters(x + dx, y + dy, id)) continue;
      marks[id] = stamp;
      queue[end] = id;
      end += 1;
    }
  }
  return false;
}

/**
 * Can `robot` reach `target` around the robots parked for good: on the floor, through no truck but the target, nor a
 * closed `~` but the `stretch` it backs out along (day-legs.js `legRules`)? True with nobody parked: A* decides.
 */
export function reachable(state, robot, target, stretch) {
  const { plan, floor } = state.warehouse;
  const walls = wallsFor(state, robot, plan.width);
  if (walls.length === 0) return true;
  if (marks.length < plan.width * plan.height) {
    marks = new Int32Array(plan.width * plan.height);
    queue = new Int32Array(plan.width * plan.height);
  }
  stamp += 1;
  for (const wall of walls) marks[wall] = stamp;
  const goal = target.x + target.y * plan.width;
  const closedNow = closed(state);
  const enters = (x, y, id) => {
    const char = plan.at(x, y);
    return floor(char) && (char !== "T" || id === goal) && !(closedNow && char === "~" && !stretch?.has(`${x},${y}`));
  };
  return sweep(plan, robot.x + robot.y * plan.width, goal, enters);
}
