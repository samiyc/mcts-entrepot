/**
 * The keys of a simulation's player, as on a video (Sami, 29/10/2026; the same as mcts-urgences' players, bfc7424):
 * space plays or pauses; the left and right arrows go a minute back or on, five with Shift; the up and down arrows play
 * faster or slower; 0 to 9, on the keypad or the row of figures, go to 0 %, 10 %… 90 % of the day. A minute is 12
 * turns of 5 s: our days and hours last 35 to 60 minutes, not urgences' shifts of hours.
 *
 * `player`: `{ t(), end(), seek(t), toggle(), faster(way) }`, the turn shown, the last one, and what the keys do.
 */
export const REPLAY_HINT = "Espace : lecture ou pause ; ← → : 1 min, avec Maj : 5 min ; ↑ ↓ : plus ou moins vite ; 0 à 9 : de 0 à 90 %";

/** The turns of a minute, and of five. */
const MINUTE = 12;
const step = (event) => (event.shiftKey ? 5 * MINUTE : MINUTE);

/** Whether a key goes to the player: no modifier but Shift, not in a field nor on a button, which keep their keys. */
const forThePlayer = (event) => !(event.ctrlKey || event.altKey || event.metaKey || event.target.closest?.("input, textarea, select, button"));

/**
 * The tenth a key goes to: its figure, else the figure of its place on the row (an AZERTY keyboard) or on the keypad
 * (num lock off, but for its arrows, read first); null for another key.
 */
function tenthOf(event) {
  const figure = /^\d$/.test(event.key) ? event.key : (/^(?:Digit|Numpad)(\d)$/.exec(event.code)?.[1] ?? null);
  return figure === null ? null : Number(figure);
}

const MOVES = {
  " ": (player) => player.toggle(),
  ArrowLeft: (player, event) => player.seek(within(player.t() - step(event), player.end())),
  ArrowRight: (player, event) => player.seek(within(player.t() + step(event), player.end())),
  ArrowUp: (player) => player.faster(1),
  ArrowDown: (player) => player.faster(-1),
};

/** The turn `t` kept within the day, from its start to `end`. */
export const within = (t, end) => Math.max(0, Math.min(end, t));

/** The speed after `current` in `speeds` (`[[value, label]]`, slowest first), faster (`way` 1) or slower (-1). */
export function nextSpeed(speeds, current, way) {
  const at = speeds.findIndex(([value]) => Number(value) === current);
  return Number(speeds[Math.max(0, Math.min(speeds.length - 1, at + way))][0]);
}

/** A key pressed while a simulation is shown; true if it was the player's. */
export function replayKey(player, event) {
  if (!forThePlayer(event)) return false;
  const tenth = MOVES[event.key] ? null : tenthOf(event);
  if (tenth === null && !MOVES[event.key]) return false;
  if (tenth === null) MOVES[event.key](player, event);
  else player.seek(Math.round((player.end() * tenth) / 10));
  event.preventDefault();
  return true;
}
