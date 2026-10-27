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

/** The jobs of one measure: `days` units of `cost` minutes (every rule and the search), sliced to `SLICE` minutes. */
function jobsOf({ id, script, args, cost, days = DAYS, folder = "night" }) {
  // As many slices as the units need, their sizes a unit apart at most.
  const count = Math.ceil(days / Math.max(1, Math.floor(SLICE / cost)));
  const minutes = (units) => Math.max(1, Math.ceil(units * cost));
  const job = (jobId, command, units) => ({ id: jobId, command, estimate: `${minutes(units)} min`, limit: Math.max(30, 3 * minutes(units)) });
  const fileOf = (jobId) => `tmp/${folder}/${jobId}.jsonl`;
  const run = ["node", `scripts/${script}`, args].filter(Boolean).join(" ");
  const command = (from, units, jobId) => `${run} --from ${from} --days ${units} --out ${fileOf(jobId)}`;
  if (count === 1) return [job(id, command(1, days, id), days)];
  const sizes = Array.from({ length: count }, (_, i) => Math.floor(days / count) + (i < days % count ? 1 : 0));
  const slices = sizes.map((units, i) => ({ from: 1 + sizes.slice(0, i).reduce((sum, one) => sum + one, 0), units }));
  const ids = slices.map(({ from }) => `${id}-${String(from).padStart(3, "0")}`);
  const merge = { id: `${id}-reunion`, command: `${run} --from 1 --days ${days} --merge ${ids.map(fileOf).join(" ")}`, estimate: "1 min", limit: 10, after: ids };
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

/**
 * The trials mcts-commun asked of the warehouse (27/10/2026 evening, its docs/essais-projets.md): `earlyStop` paired on
 * the search over 100 hours of the lines where the search wins (tours, the narrow edge, the empties; the search twice,
 * the early one about three quarters of the other), and what `diagnose` says of the other lines, the plant and the
 * warehouse's plans. The costs are those of 27/10 by day, three quarters more where the search runs twice.
 */
const WAREHOUSE_COSTS = { petit: 0.1, sami: 0.8, couloirs: 0.92, flux: 1.3, assemblage: 1.5, quais: 3.5 };
const LINE_COSTS = { petite: 0.06, sami: 0.62, seul: 0.3, etroite: 0.05, retours: 0.78, tournee: 0.25, melange: 0.21, supermarche: 0.48 };
const ESSAIS = [
  ...["tournee", "etroite", "retours"].map((plan) => ({ id: `essai-arret-${plan}`, script: "line-compare.js", args: `--plan ${plan} --search --early`, cost: Math.round(175 * LINE_COSTS[plan]) / 100 })),
  ...["petite", "sami", "seul", "melange", "supermarche"].map((plan) => ({ id: `essai-diagnose-${plan}`, script: "line-compare.js", args: `--plan ${plan} --search --diagnose`, cost: LINE_COSTS[plan], days: 20 })),
  { id: "essai-diagnose-usine", script: "plant-compare.js", args: "--plan train --robots 1 --search --diagnose", cost: 0.9, days: 20 },
  ...Object.entries(WAREHOUSE_COSTS)
    .map(([plan, cost]) => ({ id: `essai-diagnose-${plan}-jour`, script: "compare.js", args: `--plan ${plan} --search --diagnose`, cost, days: 10 })),
].map((measure) => ({ ...measure, folder: "essais" }));

/**
 * The three decisions to adopt (Sami, 27/10/2026: test the early stop, `calm` and more iterations, then make them the
 * default if they hold), each paired on the search of today. The line: `calm` with the early stop, then 128 iterations
 * on top, over 100 hours of each line. The warehouse and the plant have no `calm`: the early stop, then 128 iterations,
 * over 30 days of each plan and 50 hours of the plant. A cost is the search's, three and a quarter times over (the
 * search, the early stop at three quarters at most, 128 iterations at twice), four times where the early stop saved
 * nothing (the warehouse, tried on two days).
 */
const LINE_VARIANTS = "--variant calm=1,earlyStop=1 --variant calm=1,earlyStop=1,budget=128";
const WAREHOUSE_VARIANTS = "--variant earlyStop=1 --variant earlyStop=1,budget=128";
const DECISIONS = [
  ...Object.entries(LINE_COSTS).map(([plan, cost]) => ({ id: `choix-ligne-${plan}`, script: "line-compare.js", args: `--plan ${plan} --search ${LINE_VARIANTS}`, cost: Math.round(325 * cost) / 100 })),
  ...Object.entries(WAREHOUSE_COSTS).map(([plan, cost]) => ({ id: `choix-entrepot-${plan}`, script: "compare.js", args: `--plan ${plan} --search ${WAREHOUSE_VARIANTS}`, cost: 4 * cost, days: 30 })),
  { id: "choix-usine", script: "plant-compare.js", args: `--plan train --robots 1 --search ${WAREHOUSE_VARIANTS}`, cost: 3.6, days: 50 },
].map((measure) => ({ ...measure, folder: "choix" }));

const write = (file, about, measures) => writeFileSync(new URL(file, ROOT), `${JSON.stringify({ about, jobs: measures.flatMap(jobsOf) }, null, 2)}\n`);
write("night.json", "Les mesures de nuit (Sami, 23/10/2026, écrites par npm run night) : la recherche contre les règles, 100 journées par plan de l'entrepôt aux réglages par défaut, 100 heures par ligne, l'usine ; en tranches d'une demi-heure au plus, réunies par un job après elles (mcts-commun, 27/10). mcts-backlog --add-file mcts-entrepot/night.json, puis mcts-backlog.", NIGHT);
write("night-rollout.json", "La règle de jeu de la recherche de la ligne (Sami, 26/10/2026, écrit par npm run night) : jouée par la plus proche ou par la couverture, sur les mêmes 100 heures par plan, et ce qu'en disent les 30 premières (scripts/line-rollout.js) ; en tranches d'une demi-heure au plus. mcts-backlog --add-file mcts-entrepot/night-rollout.json, puis mcts-backlog.", ROLLOUT);
write("essais-commun.json", "Les essais demandés par mcts-commun (27/10/2026 au soir, écrits par npm run night) : earlyStop par paires sur la recherche, 100 heures des tournées, du bord étroit et des bacs vides ; ce que dit diagnose des autres lignes, de l'usine et des plans de l'entrepôt. mcts-backlog --add-file mcts-entrepot/essais-commun.json --tag essais-commun-AAAA-MM-JJ.", ESSAIS);
write("decisions.json", "Les trois décisions à adopter (Sami, 27/10/2026, écrites par npm run night) : l'arrêt anticipé, calm et 128 itérations, chacun par paires sur la recherche d'aujourd'hui ; 100 heures par ligne, 30 journées par plan de l'entrepôt, 50 heures de l'usine. mcts-backlog --add-file mcts-entrepot/decisions.json --tag decisions-AAAA-MM-JJ.", DECISIONS);
console.log("night.json, night-rollout.json, essais-commun.json, decisions.json");
