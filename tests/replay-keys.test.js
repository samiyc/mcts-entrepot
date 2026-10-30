import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { driving } from "../web/models.js";
import { nextSpeed, within } from "mcts-commun/replay-keys.js";
import { replayKey } from "../web/knobs.js";

/** A key as the page gets it: its key, its place, Shift or another modifier, the element it is pressed on. */
const keyOf = (key, { code = "", shiftKey = false, ctrlKey = false, on = null } = {}) => {
  const event = { key, code, shiftKey, ctrlKey, altKey: false, metaKey: false, target: { closest: (selector) => (on && selector.includes(on) ? {} : null) }, prevented: false };
  event.preventDefault = () => (event.prevented = true);
  return event;
};

/** A player at turn `t` of `end`, writing down what the keys asked. */
const playerAt = (t, end = 420) => {
  const asked = [];
  return { asked, t: () => t, end: () => end, seek: (to) => asked.push(["seek", to]), toggle: () => asked.push(["toggle"]), faster: (way) => asked.push(["faster", way]) };
};

describe("the players' keys (mcts-commun/replay-keys.js, our steps in web/knobs.js)", () => {
  it("plays or pauses, goes a minute or five back and on within the day, faster or slower", () => {
    const player = playerAt(100);
    for (const event of [keyOf(" "), keyOf("ArrowLeft"), keyOf("ArrowRight", { shiftKey: true }), keyOf("ArrowUp"), keyOf("ArrowDown")]) assert.equal(replayKey(player, event), true);
    assert.deepEqual(player.asked, [["toggle"], ["seek", 88], ["seek", 160], ["faster", 1], ["faster", -1]]);
    const end = playerAt(415);
    replayKey(end, keyOf("ArrowRight"));
    replayKey(playerAt(5), keyOf("ArrowLeft"));
    assert.deepEqual(end.asked, [["seek", 420]]);
    assert.equal(within(-7, 420), 0);
  });

  it("goes to a tenth of the day by the figure, its place on an AZERTY row or on the keypad, num lock off", () => {
    const player = playerAt(0, 720);
    replayKey(player, keyOf("3"));
    replayKey(player, keyOf("é", { code: "Digit2" }));
    replayKey(player, keyOf("Clear", { code: "Numpad5" }));
    assert.deepEqual(player.asked, [["seek", 216], ["seek", 144], ["seek", 360]]);
  });

  it("leaves the keys of a field, space on a button, with Ctrl, and the others, and keeps the page still for its own", () => {
    const player = playerAt(10);
    assert.equal(replayKey(player, keyOf(" ", { on: "button" })), false);
    assert.equal(replayKey(player, keyOf("ArrowLeft", { on: "input" })), false);
    assert.equal(replayKey(player, keyOf("5", { ctrlKey: true })), false);
    assert.equal(replayKey(player, keyOf("a")), false);
    assert.deepEqual(player.asked, []);
    const space = keyOf(" ");
    replayKey(player, space);
    assert.equal(space.prevented, true);
  });

  it("takes the arrows and the figures on a button (the kitchen's rule, in the library)", () => {
    const player = playerAt(100);
    assert.equal(replayKey(player, keyOf("ArrowLeft", { on: "button" })), true);
    assert.equal(replayKey(player, keyOf("5", { on: "button" })), true);
    assert.deepEqual(player.asked, [["seek", 88], ["seek", 210]]);
  });

  it("steps through the speeds, stopping at both ends", () => {
    const speeds = [["2", "lente"], ["4", "normale"], ["10", "rapide"]];
    assert.equal(nextSpeed(speeds, 4, 1), 10);
    assert.equal(nextSpeed(speeds, 10, 1), 10);
    assert.equal(nextSpeed(speeds, 2, -1), 2);
  });
});

describe("game mode (web/models.js)", () => {
  it("is the driver at the line's keys, not a replay of one: the player then takes no key", () => {
    assert.equal(driving({ day: { human: {} }, replay: null }), true);
    assert.equal(driving({ day: { human: {} }, replay: {} }), false);
    assert.equal(driving({ day: {}, replay: null }), false);
    assert.equal(driving({ day: null, replay: null }), false);
  });
});
