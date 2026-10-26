import { analyse } from "../../src/line-analysis.js";
import { analysisView } from "../analysis-view.js";
import { el } from "../dom.js";
import { panelOf } from "../knobs.js";
import { MODELS } from "../models.js";
import { download, keptReplays } from "../replay-store.js";

/**
 * The tab « Replays » (Sami, 26/10/2026, as in mcts-urgences): every day of the warehouse and every hour of the line
 * played to its end on the page is kept, in this browser and in the project's replays/ folder through the page server;
 * one opens again in its tab, move for move, or downloads. `ctx`: the page's `state`, `render`, `openReplay`.
 */
export const replaysPanel = ({ state }) =>
  panelOf(
    "Les replays",
    state.sims.entrepot,
    [],
    el("p", { class: "hint" }, "Chaque journée jouée jusqu'au bout se garde ici, dans ce navigateur, et dans le dossier replays/ du projet quand la page passe par son serveur (npm run page). Rouverte, elle se rejoue coup pour coup, quelle que soit la règle qui l'avait jouée, la recherche comprise. Une heure de ligne jouée avec le cariste s'analyse : la même heure sans vous, les robots seuls, minute par minute."),
  );

const when = (replay) => replay.savedAt.slice(0, 16).replace("T", " ");
const modelOf = (replay) => MODELS[replay.kind ?? "entrepot"];
const planLabel = (replay) => replay.setup.label ?? modelOf(replay).plans[replay.planId]?.label ?? replay.planId;
function finishText({ kind, measures }) {
  if (!measures) return "";
  if (kind === "ligne") return ` · ${measures.produced} véhicules, ${measures.stopped} tours d'arrêt`;
  return ` · fini au tour ${measures.finish}, ${measures.truckWait} tours à quai`;
}

function keptList() {
  const kept = keptReplays();
  if (!kept.length) return el("p", { class: "hint" }, "Rien de gardé : jouez une journée jusqu'au bout (onglet Entrepôt), ou une heure de ligne (onglet Ligne cadencée).");
  const item = (replay, i) =>
    el(
      "li",
      {},
      `${when(replay)} · ${planLabel(replay)} · ${replay.kind === "ligne" ? "heure" : "journée"} ${replay.seed} · ${modelOf(replay).labels[replay.rule] ?? replay.rule}${finishText(replay)} `,
      el("button", { type: "button", class: "quiet", "data-replay": String(i), "data-do": "open" }, "Rouvrir"),
      " ",
      el("button", { type: "button", class: "quiet", "data-replay": String(i), "data-do": "download" }, "Télécharger"),
      ...(replay.setup.humanScript ? [" ", el("button", { type: "button", class: "quiet", "data-replay": String(i), "data-do": "analyse" }, "Analyser")] : []),
    );
  return el("ol", { class: "replay-list" }, ...kept.map(item));
}

function serverList(files) {
  if (files === null) return el("p", { class: "hint" }, "Lecture du dossier replays/…");
  if (!files.length) return el("p", { class: "hint" }, "Aucun fichier dans replays/ (ou la page ne passe pas par son serveur).");
  return el("ol", { class: "replay-list" }, ...files.slice(0, 50).map((name) => el("li", {}, el("a", { href: `../replays/${name}`, download: name }, name))));
}

/** The files of replays/, asked once the tab opens (the page server lists them). */
function askServer(ctx) {
  if (ctx.state.serverReplays !== undefined) return;
  ctx.state.serverReplays = null;
  fetch("/api/replays")
    .then((response) => (response.ok ? response.json() : { files: [] }))
    .catch(() => ({ files: [] }))
    .then(({ files }) => {
      ctx.state.serverReplays = files ?? [];
      ctx.render();
    });
}

export function replaysView(ctx) {
  askServer(ctx);
  const analysis = ctx.state.analysis ? [analysisView(ctx.state.analysis.report, ctx.state.analysis.turnSeconds)] : [];
  return [
    ...analysis,el("h2", {}, "Gardés dans ce navigateur"), keptList(), el("h2", {}, "Le dossier replays/ du projet"), serverList(ctx.state.serverReplays)];
}

/** A kept day opened again in its tab, or downloaded; true if the click was this tab's. */
export function replaysClick(ctx, target) {
  const button = /** @type {HTMLElement | null} */ (target.closest?.("[data-replay]"));
  if (!button) return false;
  const replay = keptReplays()[Number(button.getAttribute("data-replay"))];
  if (!replay) return true;
  const what = button.getAttribute("data-do");
  if (what === "download") download(replay);
  else if (what === "analyse") {
    ctx.state.analysis = { report: analyse(replay), turnSeconds: replay.setup.turnSeconds };
    ctx.render();
  } else ctx.openReplay(replay);
  return true;
}
