import { writeFileSync } from "node:fs";

/**
 * `npm run night`: night.json and night-rollout.json, the long measures for the machine's queue (mcts-backlog
 * --add-file, which dates each id), from what a unit cost on the night of 26 to 27/10/2026. mcts-commun asks of its
 * jobs (docs/backlog.md, « Recommandations aux projets », 27/10): half an hour at most, cut in slices with a job that
 * merges them after, an honest estimate and a limit beyond the worst case. A measure whose units take longer is cut in
 * slices of `SLICE` minutes; each slice writes its units (`--out`), the merge makes the table of them (`--merge`) and
 * exits with 1 if some are missing.
 */
const ROOT = new URL("../", import.meta.url);
const SLICE = 25;
const DAYS = 100;

/** The jobs of one measure: `cost` minutes a unit (every rule and the search), sliced to `SLICE` minutes. */
function jobsOf({ id, script, args, cost }) {
  // As many slices as the units need, their sizes a unit apart at most.
  const count = Math.ceil(DAYS / Math.max(1, Math.floor(SLICE / cost)));
  const minutes = (units) => Math.max(1, Math.ceil(units * cost));
  const job = (jobId, command, units) => ({ id: jobId, command, estimate: `${minutes(units)} min`, limit: Math.max(30, 3 * minutes(units)) });
  const fileOf = (jobId) => `tmp/night/${jobId}.jsonl`;
  const run = ["node", `scripts/${script}`, args].filter(Boolean).join(" ");
  const command = (from, units, jobId) => `${run} --from ${from} --days ${units} --out ${fileOf(jobId)}`;
  if (count === 1) return [job(id, command(1, DAYS, id), DAYS)];
  const sizes = Array.from({ length: count }, (_, i) => Math.floor(DAYS / count) + (i < DAYS % count ? 1 : 0));
  const slices = sizes.map((units, i) => ({ from: 1 + sizes.slice(0, i).reduce((sum, one) => sum + one, 0), units }));
  const ids = slices.map(({ from }) => `${id}-${String(from).padStart(3, "0")}`);
  const merge = { id: `${id}-reunion`, command: `${run} --from 1 --days ${DAYS} --merge ${ids.map(fileOf).join(" ")}`, estimate: "1 min", limit: 10, after: ids };
  return [...slices.map(({ from, units }, i) => job(ids[i], command(from, units, ids[i]), units)), merge];
}

/**
 * The minutes of a unit: the warehouse's on the night of 26 to 27/10 (with the dock loader), the line's on 27/10 by day (the
 * longest slice of each, 18 threads busy).
 */
const NIGHT = [
  { id: "ent-petit", script: "compare.js", args: "--plan petit --search", cost: 0.1 },
  { id: "ent-sami", script: "compare.js", args: "--plan sami --search", cost: 0.8 },
  { id: "ent-quais", script: "compare.js", args: "--plan quais --search", cost: 3.5 },
  { id: "ent-couloirs", script: "compare.js", args: "--plan couloirs --search", cost: 0.92 },
  { id: "ent-flux", script: "compare.js", args: "--plan flux --search", cost: 1.3 },
  { id: "ent-assemblage", script: "compare.js", args: "--plan assemblage --search", cost: 1.5 },
  ...["petite", "sami", "seul", "etroite", "retours", "tournee", "melange", "supermarche"].map((plan, i) => ({ id: `ligne-${plan}`, script: "line-compare.js", args: `--plan ${plan} --search`, cost: [0.06, 0.62, 0.3, 0.05, 0.78, 0.25, 0.21, 0.48][i] })),
  { id: "ligne-cariste", script: "line-drivers.js", args: "", cost: 0.05 },
  { id: "usine", script: "plant-compare.js", args: "--plan usine", cost: 0.15 },
  { id: "usine-train", script: "plant-compare.js", args: "--plan train", cost: 0.1 },
  { id: "usine-train-recherche", script: "plant-compare.js", args: "--plan train --robots 1 --search", cost: 0.9 },
];

/** The rollout campaign (26/10, measured again on 27/10 by day): an hour of each line, its rules and both searches. */
const ROLLOUT = [["petite", 0.11], ["etroite", 0.08], ["seul", 0.58], ["melange", 0.54], ["tournee", 0.52], ["sami", 1.38], ["retours", 2.33]]
  .map(([plan, cost]) => ({ id: `ligne-jeu-${plan}`, script: "line-rollout.js", args: `--plan ${plan} --short 30`, cost }));

const write = (file, about, measures) => writeFileSync(new URL(file, ROOT), `${JSON.stringify({ about, jobs: measures.flatMap(jobsOf) }, null, 2)}\n`);
write("night.json", "Les mesures de nuit (Sami, 23/10/2026, écrites par npm run night) : la recherche contre les règles, 100 journées par plan de l'entrepôt aux réglages par défaut, 100 heures par ligne, l'usine ; en tranches d'une demi-heure au plus, réunies par un job après elles (mcts-commun, 27/10). mcts-backlog --add-file mcts-entrepot/night.json, puis mcts-backlog.", NIGHT);
write("night-rollout.json", "La règle de jeu de la recherche de la ligne (Sami, 26/10/2026, écrit par npm run night) : jouée par la plus proche ou par la couverture, sur les mêmes 100 heures par plan, et ce qu'en disent les 30 premières (scripts/line-rollout.js) ; en tranches d'une demi-heure au plus. mcts-backlog --add-file mcts-entrepot/night-rollout.json, puis mcts-backlog.", ROLLOUT);
console.log("night.json, night-rollout.json");
