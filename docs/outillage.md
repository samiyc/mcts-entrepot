# L'outillage du dépôt

Sami (26/10/2026, `docs/prompt/recherche-glossaire-industrie.md`) : reprendre ici les bonnes pratiques de lopin et de
mcts-urgences. La recette est celle de `mcts-urgences/docs/outillage.md`, § « Pour les autres projets mcts-* », suivie
dans son ordre. Tout passe par une commande, `npm run check`, que le hook relance avant chaque commit.

## Les commandes

| Commande | Ce qu'elle fait |
|---|---|
| `npm run check` | le lint, les types, puis les tests ; c'est ce que lance le hook |
| `npm run lint` (`lint:fix`) | eslint, avec le budget de complexité de lopin |
| `npm run types` | tsc vérifie le JavaScript d'après ses commentaires JSDoc, sans rien compiler |
| `npm test` (`test:coverage`) | les tests de `node --test`, dont les empreintes et la longueur des `.md` |
| `npm run compare` | les règles (et `--search`, la recherche) sur les mêmes journées |
| `npm run line` | les règles de la ligne cadencée (et `--search`) sur les mêmes heures |
| `npm run bench` | `scripts/search-bench.js` : la recherche contre les règles, par paires |
| `npm run changelog` | refait `web/changelog.html` à partir de `docs/changelog.json` |
| `npm run page` | la page, sur le port 4802 (le serveur de mcts-commun) |

## Le budget du lint

La config `eslint.config.js` est celle d'urgences, qui reprend celle de lopin :
- une fonction a au plus 40 lignes, une complexité de 8, une complexité cognitive de 10, 4 paramètres et 20
  instructions ;
- un fichier a au plus 220 lignes ;
- `src/` et `web/` n'importent aucun module `node:*`, parce qu'ils tournent aussi dans le navigateur ;
- `web/search-worker.js` a les globales d'un worker.

**Quand une règle bloque, on découpe, on ne relève pas la limite.** Le 26/10, la première passe a trouvé 72 erreurs.
Elles ont été corrigées en découpant le long des coutures :
- `simulate.js` (947 lignes) est passé en dix modules. Il garde la journée (le tirage, le départ, le tour, les
  mesures) et ré-exporte ce qu'il exportait : les imports ne changent pas. Les autres modules :
  - `day-basics.js` : les cases, les camions, ce que savent les robots, le balayage `flood` ;
  - `day-spots.js` : où les robots partent et attendent ;
  - `day-ways.js` : qu'aucune palette ne soit enfermée ;
  - `day-legs.js` : les trajets réservés, `hold`, s'écarter ;
  - `day-bays.js` : les baies, qui prend, qui charge, où déposer ;
  - `day-queues.js` : le tour de chacun au camion ;
  - `day-relays.js` : les relais ;
  - `day-turn.js` : le tour, autour des choix ;
  - `day-choice.js` : ce qu'un robot libre peut prendre ;
- `warehouse.js`, `rules.js` et `view.js` en fonctions plus petites ;
- `app.js` en cinq : `dom.js`, `board.js` (le plan dessiné), `panels.js` (réglages, commandes, éditeur,
  comparaison), `workers.js`, et `app.js`, qui garde l'état et écoute ;
- dans les tests, les vérifications d'une journée en trois fonctions.

Ce qui l'a vérifié, en plus des empreintes :
- `npm run compare` sur 20 journées de chaque plan, et le banc de la recherche, donnent la même sortie au chiffre
  près, à la même vitesse (43 s contre 45 s pour 4 journées de recherche sur le plan de Sami) ;
- la vue de la page donne les mêmes cases, robots, commandes et ligne d'état sur 1 582 tours.

## Les empreintes

`tests/fingerprint.test.js` résume en trois hachages ce que fait l'entrepôt :
- **les règles** : chaque plan, sous chaque règle, sur 3 journées. On hache tout ce que la journée a noté
  (affectations, chargements, chargeurs, relais, blocages vus, livraisons), ses mesures, et la case et les compteurs
  de chaque robot ;
- **les variantes** : les réglages que les plans laissent par défaut. Ce sont les relais coupés, l'absence de zone
  automatique et d'autres taux de blocage ;
- **la recherche** : une journée du petit entrepôt à 16 itérations.

Un quatrième, **la ligne** (26/10), tient la ligne cadencée : chaque plan sous chaque règle sur deux heures, et une
heure courte de sa recherche. Il a été posé avec la ligne ; les trois de l'entrepôt n'ont pas bougé.

Elles ont été prises avant de toucher au code (commit `e5e3dcd`), et aucune n'a changé depuis.

Une refonte ne doit changer **aucune** empreinte. Un changement fait exprès pour modifier le modèle met à jour son
hachage. Son commit le dit, avec les mesures avant et après. Une empreinte qui change sans qu'on l'ait voulu est un
bug.

## Les types

`tsconfig.json` vérifie `src/`, `web/` et `scripts/` sans les compiler (`checkJs`, `noEmit`), en mode non strict.
`preserveSymlinks` fait lire le lien `file:` vers mcts-commun comme un module externe.

Les formes que les modules s'échangent sont dans `src/types.js` :
- la case, le robot, la commande, le camion, la journée ;
- une règle et ce qu'on lui dit ;
- les mesures d'une journée, et le résumé d'une règle.

Un module y renvoie avec `@typedef {import("./types.js").Rule} Rule`.

## Le hook

`.githooks/pre-commit` lance le lint, les types et les tests, ces derniers en bref. Un échec arrête le commit : on
corrige, on ne contourne pas le hook. `npm install` l'active par le script `prepare` (`git config core.hooksPath
.githooks`). Il a été essayé sur un commit avec une variable inutilisée : le commit a été refusé.

## Les fichiers

- `.editorconfig` : UTF-8, des fins de ligne LF, 2 espaces, une ligne vide en fin de fichier.
- `.gitattributes` : du LF partout, dans le dépôt comme sur le disque.
- `.gitignore` : celui d'urgences.
- `tests/md-budget.test.js` : chaque `.md` reste sous 800 lignes, CLAUDE.md sous 300.

## Le journal des versions

`docs/changelog.json` contient le tableau de ce que gagne la recherche, et une entrée par version, la plus récente
d'abord, avec ses commits. `npm run changelog` en fait `web/changelog.html` ; le script est celui d'urgences. Le 26/10,
les données ont été tirées de la page telle qu'elle était, et le fichier refait était identique à l'octet près.

## Les jobs de la file

Les mesures longues tournent dans la file de la machine (`mcts-backlog` de mcts-commun). Elles suivent ses
recommandations du 27/10 (`../mcts-commun/docs/backlog.md`, « Recommandations aux projets »), écrites après qu'un job
ne disait rien pendant 45 min, puis tout à la fin :
- **dire où on en est** : chaque script de mesure (`compare`, `line-compare`, `line-drivers`, `line-rollout`,
  `plant-compare`) appelle `progress` de `mcts-commun/trace.js` à chaque journée ou heure (`scripts/units.js`). Les
  vues de la file disent « journée 12/30, fin vers 10:20 ». Une ligne courte part sur la sortie d'erreur, et le tableau
  reste seul sur la sortie standard ;
- **écrire au fil de l'eau** : `--out FICHIER` ajoute une ligne JSON par unité, ses mesures sous chaque règle. Un job
  arrêté à sa limite garde ce qu'il a calculé ;
- **des jobs d'une demi-heure au plus** : `--from N --days D` mesure une tranche, et `--merge FICHIER…` refait le
  tableau des tranches. La réunion attend les unités de `--from` et `--days` : s'il en manque (une tranche coupée, ou
  qui n'a jamais écrit), elle le dit et sort avec 1, et la file la montre en échec ;
- **des estimations honnêtes** : `npm run night` (`scripts/night.js`) écrit `night.json` et `night-rollout.json` à
  partir de ce qu'une unité a coûté la nuit du 26 au 27/10. Il coupe chaque mesure en tranches de 25 min au plus, avec
  une `limit` de trois fois l'estimation (30 min au moins), puis ajoute le job qui les réunit (`after`) ;
- **les fils** : les scripts n'en prennent qu'un, ce que la file donne par défaut (`MCTS_THREADS` vaut 1). Une erreur
  sort avec un code non nul (une exception que rien ne rattrape). `--add-file` date chaque id ;
- **jamais à la main dans `~/.mcts-backlog`** : les sorties vont dans `tmp/night/` du dépôt, hors de git.

Essayé le 27/10 sur une file temporaire (`--home` d'un dossier du bloc-notes), pas sur la vraie : deux tranches et
leur réunion finissent, la trace de chaque tranche porte ses `progress`, et une réunion à qui il manque une tranche
finit en échec.

Puis sur la vraie file, à la demande de Sami (27/10, 11:42 à 11:52) : 12 jobs de 1 à 10 min, sur les cinq scripts.
- Les 8 tranches et les 3 réunions finissent, sans incident. La 12e, une réunion à qui il manque une tranche exprès,
  finit en échec : « manquent 17 à 24 ».
- Les vues disent par exemple « journée 1/8, fin vers 11:46 » et « heure 80/360, fin vers 11:44 ».
- L'usine réunie en deux tranches de 7 heures donne le tableau des 14 heures d'un seul tenant. Les 16 journées du plan
  de Sami redonnent les chiffres de la nuit (la liste 232,2, la recherche 229,0).
- Un job ne disait rien avant la fin de sa première unité, parfois plusieurs minutes. Il annonce maintenant « journée
  0/8 » dès son départ.
- Le même jour, la mesure de la ligne de Sami (100 heures d'un seul job) allait dépasser sa limite : 0,6 min par
  heure, et non 0,2. Annulée à 17 heures, elle les a gardées (`--out`). Les heures 18 à 100 sont parties en 4 tranches,
  et la réunion a pris le fichier du job annulé avec les tranches : « 5 morceaux, heures 1 à 100 ».
- Les tranches ont pris 2 à 4 fois moins que leur estimation : les coûts de `scripts/night.js` viennent d'une nuit où
  18 jobs tournaient ensemble. La file apprend ensuite les durées des commandes déjà passées.

## mcts-commun

L'entrepôt en dépend par `"mcts-commun": "file:../mcts-commun"` : `node_modules/mcts-commun` est un lien vers le
dossier voisin, donc le code vivant, sans version figée. Le contrôle du 26/10 :
- **ses tests passent** (44 sur 44) ;
- **l'entrepôt utilise** `createRng`, `search`, `paired`, `astar`, `createReservations` et `parsePlan`, ainsi que
  le serveur de la page (`bin/serve.js`, les replays), `web/theme.css` et `mcts-backlog` (par `night.json`) ;
- **une copie corrigée** : `fixed()` était écrite dans `scripts/compare.js` et dans `scripts/search-bench.js`. Elle
  est maintenant dans `scripts/format.js`, avec la moyenne et l'intervalle. Ce sont des outils d'affichage des
  scripts, pas de la bibliothèque ;
- **une dette laissée exprès** : la graine de chaque choix de la recherche (`src/search.js`, `searchRule`) refait
  presque `streamOf` de `mcts-commun/random.js`, avec la même constante. Y passer changerait les empreintes et tous les
  chiffres de `modele.md`. On le fera avec une mesure avant/après, pas dans une refonte ;
- **ce qui manque à mcts-commun** : le lint, les types et le hook. Sa propre session s'en charge, comme le prévoit
  urgences ; son `src/` doit rester sans `node:*` (`node/` et `bin/` sont pour Node).
