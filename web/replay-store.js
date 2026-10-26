import { el } from "./dom.js";

/**
 * The days kept (Sami, 26/10/2026, as in mcts-urgences): the last `KEPT` in this browser, and each one in the project's
 * replays/ folder through the page server (out of git; nothing if no server takes it); a replay downloads as a file.
 */
const NAME = "entrepot-replays";
const KEPT = 30;

export function keptReplays() {
  try {
    return JSON.parse(localStorage.getItem(NAME) ?? "[]");
  } catch {
    return [];
  }
}

export function keepReplay(replay) {
  fetch("/api/replays", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(replay) }).catch(() => {});
  try {
    localStorage.setItem(NAME, JSON.stringify([replay, ...keptReplays()].slice(0, KEPT)));
  } catch {
    // Storage refused: the replay is still in replays/ when the server took it.
  }
}

/** The file name of a replay: its kind, its plan, its day, when it was saved. */
export const replayFile = (replay) => `${replay.kind}-${replay.planId}-jour${replay.seed}-${replay.savedAt.slice(0, 16).replace(/[:T]/g, "-")}.json`;

export function download(replay) {
  const link = el("a", { href: URL.createObjectURL(new Blob([JSON.stringify(replay, null, 2)], { type: "application/json" })), download: replayFile(replay) });
  document.body.append(link);
  link.click();
  link.remove();
}
