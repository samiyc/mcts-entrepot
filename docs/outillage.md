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

## Les essais demandés par mcts-commun (27/10 au soir)

mcts-commun a corrigé le test « cible hors d'atteinte » d'A* (`a9a4c99`), qui grossissait sur un plan large. Il a aussi
ajouté deux choses (`4abc577`, `../mcts-commun/docs/recherche.md`) :
- `diagnose`, ce qu'une recherche a vu ;
- `earlyStop`, arrêter une recherche dont le coup en tête ne peut plus être rattrapé.

Il demandait à l'entrepôt de vérifier le correctif et d'essayer les deux réglages.

**Les empreintes ne bougent pas** : `npm run check` passe tel quel (68 tests), avec la lib du soir.

**Les mêmes résultats, au chiffre près** :
- 10 heures de `retours` (`line-compare --search`) : 40 mesures sur 40 (10 heures, 4 règles) sont celles de
  `tmp/night/ligne-retours-001.jsonl` de ce matin ;
- 5 journées de l'assemblage (`compare --search`, qui passe par `day-legs`) : 25 sur 25 sont celles de la nuit.

**Le temps : le correctif n'explique pas les 38 min.** Pour départager, les mêmes mesures ont été jouées côte à côte,
avec la lib d'avant le correctif (`git archive a9a4c99^`, dans le bloc-notes) et avec celle du soir :

| Mesure | Avant | Après | Appels d'A* | Abandons (`givenUp`) | Cases par appel |
|---|---|---|---|---|---|
| `retours`, 10 heures | 381 s (A* 317 s) | 352 s (A* 288 s) | 1 444 710 | 43 366 | 20,0 |
| assemblage, 5 journées | 79 s (A* 45,5 s) | 80 s (A* 44,7 s) | 265 921 | 13 373 | 25,4 |

- Les appels, les abandons et les chemins introuvables sont les mêmes avant et après. A* abandonne une fois sur 33
  appels, et sur nos plans de 16 cases de large l'abandon coûtait peu.
- Ce matin, les 10 premières heures de `ligne-retours-001` ont pris 660 s. Le même calcul seul ce soir prend 289 s, A*
  compris (546 s contre 235 s). Le reste de la recherche va lui aussi deux fois plus vite (114 s contre 54 s) : c'est
  la machine chargée (18 jobs ensemble), pas A*.
- **A\* fait 80 % du temps d'une recherche de la ligne** (235 s sur 289) : c'est là qu'un gain se prendrait.

**`diagnose` et `earlyStop` dans les scripts** :
- les trois recherches (`searchRule`, `lineSearchRule`, `plantSearchRule`) prennent `earlyStop`, éteint par défaut, et
  `onSearch(found, depth)`, qui voit chaque résultat ;
- `scripts/searches.js` compte, pour chaque unité, les décisions, leurs itérations, leur temps et les codes de
  `diagnose`. Ils vont dans la ligne JSON de l'unité, et la réunion les additionne ;
- `--diagnose` les affiche dans `compare`, `line-compare` et `plant-compare`, et dans `search-bench` ;
- `--early`, dans `line-compare` et `plant-compare`, ajoute la recherche avec `earlyStop`, comparée par paires à la
  recherche sur les mêmes heures.

Lire un résultat ne change rien à la recherche : les mesures avec `--diagnose` sont celles d'avant.

**Les jobs** : `npm run night` écrit aussi `essais-commun.json`, 25 jobs ajoutés le 27/10 à 17:54 avec le tag
`essais-commun-2026-10-27`, à partir des durées de la journée :
- `earlyStop` sur 100 heures des tournées, du bord étroit et des bacs vides, en tranches de 25 min au plus ;
- `diagnose` sur 20 heures des cinq autres lignes et de l'usine, et sur 10 journées de chaque plan de l'entrepôt.

Les sorties vont dans `tmp/essais/`. Les 25 ont fini à 19:52, sans incident, et souvent plus vite qu'estimé (l'entrepôt
en 4 à 6 min pour 8 à 18 annoncées). Leurs résultats sont dans [modele-ligne.md](modele-ligne.md), « L'arrêt anticipé, et ce
que voit la recherche » : l'arrêt anticipé rend les mêmes 300 heures pour un quart de temps de recherche en moins, et
`fewIterations` domine là où le robot manque.

**Les robots se gênent-ils assez pour PIBT ?** (la question de mcts-commun, `recherche.md` § 3 et 4) Pas encore :
- **attendre** coûte de 1,3 à 10 % des pas dans l'entrepôt, et 2 % à la ligne. Le plus haut est le plan de Sami sous
  la plus proche ;
- **replanifier** coûte de 2 à 4 % des pas dans l'entrepôt, et 0,5 % à la ligne ;
- **aucun robot bloqué** sur les journées de la nuit (`stuck` à 0) ;
- **aucune case réservée deux fois** dans les 79 traces de l'entrepôt du 26 et du 27/10.

L'A* coopératif tient les 2 à 4 robots de nos plans. PIBT vaudrait d'être essayé avec bien plus de robots. Il le
vaudrait aussi pour sa vitesse, dans les mondes de la recherche, puisque A* y fait 80 % du temps. Mais ce serait un
autre modèle, et toutes les empreintes changeraient.

## Les lenteurs des journées complètes (28/10)

Sami a demandé où passe le temps d'une journée complète, et ce qu'on peut y gagner. On a profilé une journée avec la
recherche (`--cpu-prof`, puis les compteurs de la trace), réglages par défaut :

| Cas | Temps | A* | Les chemins non trouvés : appels, temps d'A* | ms par succès, par échec |
|---|---|---|---|---|
| assemblage, 1 journée | 14 s | 52 % | 6 %, 34 % | 0,12, 0,92 |
| trois quais, 1 journée | 18 s | 71 % | 23 %, 34 % | 0,51, 0,91 |
| plan de Sami, 1 journée | — | — | 8 %, 29 % | 0,09, 0,45 |
| flux, 1 journée | — | — | 7 %, 33 % | 0,11, 0,72 |
| usine (navette à heure fixe), 3 heures | 9,5 s | 62 % | — | — |

- **Les règles seules ne coûtent presque rien** : 1,3 s pour les 4 règles sur 3 journées d'assemblage. C'est la
  recherche qui coûte, et chaque variante de recherche autant qu'elle.
- **A\* prend la majorité du temps**, et le ramasse-miettes 7 à 10 % de plus, ses chaînes de clés et ses objets. Ces
  constats sont partis à `mcts-commun` sur le tableau des sessions le 28/10 (« Entrepôt : où A* perd son temps »),
  qui les corrigera de son côté.
- **Un chemin non trouvé coûte cher**, jusqu'à 7,6 fois un chemin trouvé. La plupart des échecs explorent autant de
  nœuds que le plan a de cases avant qu'A* ne s'en aperçoive.

**Le filtre avant A\*** (`src/day-reach.js`, commit `9d28496`). Un robot garé pour de bon, au plus tard au tour suivant,
est un mur à tout instant après. Si un parcours en largeur autour de ces murs n'atteint pas la cible, aucun chemin dans
le temps ne l'atteindra non plus : `planLeg` ne demande rien à A*. Le filtre laisse passer plus qu'un chemin ne peut
(il ignore les palettes), jamais moins : il ne fait que rejeter.
- **Il ne change rien** : les mêmes journées à l'octet près avant et après, comparées par `--out` sur 7 mesures (4
  plans de l'entrepôt, l'usine, deux lignes). Aucune empreinte ne bouge.
- **Ce qu'il gagne**, une journée avant → après : les échecs passent de 2 762 à 1 042 à l'assemblage, de 5 057 à
  1 411 aux quais, et de 1 926 à 164 sur 3 heures d'usine. Le temps d'A* baisse de 7 à 16 %, celui de la recherche
  de 3 à 11 %.
- **Ce qu'on a écarté d'abord** : le même filtre avec un `Set` et des clés en texte coûtait autant qu'il épargnait.
  Lancé seulement après un échec vers la même cible, ou seulement quand le robot est encerclé, il rattrapait trop peu
  d'échecs. Ce qui l'a rendu rentable, ce sont des tableaux d'entiers réutilisés d'un parcours à l'autre.

**Les vérifications de baie** (`src/day-ways.js`, commit `2d184bc`). Avant de poser une palette, `shutsIn` vérifie
qu'elle n'enferme personne. Il lançait un parcours depuis chaque destination (chaque camion, chaque case promise),
alors que tous ces parcours contournent les mêmes palettes. Un seul étiquetage des morceaux du sol suffit maintenant :
les réponses sont les mêmes.
- **Rien ne change** : les mêmes journées à l'octet près sur 7 mesures (5 plans de l'entrepôt, l'usine, les bacs
  vides), et aucune empreinte ne bouge.
- **Ce qu'il gagne** : sur une journée d'assemblage, `shutsIn` passe de 15 à 9 % du temps. Avec 14 mesures lancées
  ensemble, le temps baisse de 7 % sur le plan de Sami et au flux, de 5 % à l'assemblage, de 1 à 2 % ailleurs.

**Des mondes plus légers pour la recherche** (commit `211c7e0`) : l'option `legHorizon` des trois recherches, éteinte
par défaut. Les chemins des mondes tirés sont alors planifiés moins loin que les 80 tours de `LEG_HORIZON`.
- Elle est mesurée par paires sur la recherche d'aujourd'hui (`horizon.json`, 50 jobs, tag `horizon-2026-10-28`) :
  - 40 et 24 tours sur 30 journées de chaque plan de l'entrepôt, dont le plus long trajet au sol fait 20 cases ;
  - 48 et 36 tours sur 100 heures de chaque ligne et 50 heures de l'usine, dont le plus long trajet fait 31 cases.
- Essayé sur deux journées du plan de Sami : 4 % de temps en moins à 40 tours, mêmes journées. Le filtre épargne déjà
  l'essentiel de ce qu'un horizon plus court couperait.

**Les estimations de la file.** Ce que les jobs du 27/10 ont pris, réel sur estimé :

| Famille | Réel / estimé, 27/10 | Une unité, estimé de `NIGHT` | Une unité, mesurée le 28/10 (×2) | Proposé |
|---|---|---|---|---|
| entrepôt, petit / Sami / quais | 0,67 / 0,49 / 0,30 | 0,1 / 0,8 / 3,5 min | 0,13 / 0,47 / 0,61 | 0,13 / 0,47 / 1,08 |
| entrepôt, couloirs / flux / assemblage | 0,44 / 0,22 / 0,34 | 0,92 / 1,3 / 1,5 | 0,33 / 0,34 / 0,59 | 0,36 / 0,36 / 0,59 |
| lignes, petite / Sami / seul / étroite | 0,50 / 0,37 / 0,71 / 1,06 | 0,06 / 0,62 / 0,3 / 0,05 | 0,05 / 0,19 / 0,22 / 0,07 | idem |
| lignes, retours / tournées / mélange / supermarché | 1,12 / 1,04 / 0,70 / 0,51 | 0,78 / 0,25 / 0,21 / 0,48 | 0,54 / 0,24 / 0,15 / 0,19 | idem |
| usine avec la recherche | 0,22 | 0,9 | 0,28 | 0,28 |

- Les mesures du 28/10 viennent des 18 mesures lancées ensemble. Les unités sont doublées pour la charge d'une nuit (le
  27/10, une tranche prenait 2,3 fois plus de temps quand 18 jobs tournaient).
- Le proposé est le plus haut de deux valeurs : cette mesure, ou ce qu'a pris la même mesure le 27/10 dans la file,
  moins un dixième pour le filtre. Les trois quais montrent pourquoi : leurs deux premières journées sont plus légères
  que les suivantes.
- L'entrepôt et l'usine étaient estimés 2 à 4 fois trop haut. C'était le coût de la recherche d'avant l'arrêt
  anticipé et d'avant le filtre, sous la charge de la nuit.
- Les lignes étaient à peu près justes, sauf les bacs vides (`retours`) et les tournées, un peu au-dessus de
  l'estimé.
- **Adoptés le 28/10** (Sami) : toutes les mesures de `scripts/night.js` prennent ces coûts (`COSTS`), sauf la
  campagne de la règle de jeu. `night.json` passe de 1 233 à 541 minutes estimées, `decisions.json` de 2 096 à 985
  (le 27/10, ses jobs avaient pris 1 051 minutes en tout), `essais-commun.json` de 333 à 207.

**Ce qui reste**, d'après le profil du code actuel :
- **A*** : 48 à 67 % du temps. Il est chez `mcts-commun`.
- **Les 4 déroulés de base de chaque décision** (`baseOf`) : 6 % dans l'entrepôt, 13 % à l'usine. En faire moins changerait
  les décisions.
- **La portée des déroulés** de la ligne et de l'usine (180 et 360 tours) : un changement de modèle, à ouvrir après
  les résultats de `legHorizon`.
- **Le reste** (le clonage des mondes et des réservations) ne pèse pas 1 %.

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
