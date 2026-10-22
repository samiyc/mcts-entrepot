# Le modèle de l'entrepôt, première version (22/10/2026)

Une journée jouée tour par tour : des robots, des commandes, des chemins réservés dans l'espace et le
temps, une allée qui peut se bloquer sans prévenir, trois règles de référence et, depuis le soir du 22/10,
l'affectation par la recherche (plus bas).

## Ce qui se passe

- **Le plan** est un texte (`src/plans.js`) : `.` le sol, une majuscule un bloc de rayons, `T` le camion,
  `~` une case qui peut se bloquer, `#` un mur. Trois plans pour commencer : un petit entrepôt de 9 × 4, le
  plan de Sami de 17 × 7 avec son couloir de la ligne 2, deux couloirs étroits. La page permet d'en
  dessiner un autre.
- **Les commandes** sont des lettres de blocs, dans l'ordre où elles arrivent ; toutes sont là au départ.
- **Un robot libre** reçoit une commande de la règle, va jusqu'à une case de sol au bord du bloc, prend
  (un tour), rapporte au camion, dépose (un tour).
- **Les chemins** : chaque trajet est un chemin A* dans l'espace et le temps (`grid` de `mcts-commun`),
  réservé autour des chemins déjà réservés. Jamais deux robots dans la même case, jamais deux robots qui se
  croisent ; le camion se partage, mais ses passages sont réservés aussi.
- **Le caché** : l'allée `~` se bloque avec une probabilité donnée, pendant un nombre de tours donné, à un
  tour inconnu. Un robot ne le voit qu'à côté, juste avant d'avancer ; alors tous le savent et l'évitent pour
  la durée du blocage. Un robot pris dedans peut en ressortir.

## Ce qu'on mesure

- **Le tour où la dernière commande est livrée** (l'horizon si certaines restent) : le score principal.
- Les commandes livrées, le tour moyen de livraison, les pas, les attentes, les trajets refaits après un
  blocage.
- Les règles jouent les mêmes journées tirées et se comparent par paires (`npm run compare`).

## Premiers résultats (100 journées par plan)

| Plan | la plus proche | dans l'ordre de la liste | écart |
|---|---|---|---|
| petit entrepôt | 41,0 | 44,8 | la plus proche gagne 3,8 tours (3,3 à 4,3) |
| plan de Sami | 71,1 | 66,3 | la plus proche **perd** 4,8 tours (4,6 à 5,0) |
| deux couloirs | 58,0 | 46,2 | la plus proche **perd** 11,8 tours |

**La commande la plus proche n'est pas la meilleure règle.** Avide, elle sert d'abord ce qui est près du
camion et laisse les commandes lointaines pour la fin, où un seul robot les fait l'une après l'autre. La
liste, elle, mélange près et loin et répartit les longs trajets entre les robots. C'est le piège connu des
règles avides quand on mesure la fin de la journée ; une recherche qui regarde plusieurs affectations à
l'avance devrait l'éviter.

Une troisième règle, ajoutée le soir pour juger la recherche honnêtement : **la plus lointaine d'abord**,
la règle classique de l'ordonnancement pour finir tôt (le travail le plus long d'abord, *LPT*). Les longs
trajets partent au début et se répartissent entre les robots ; elle bat la liste partout (36,8, 60,2 et
46,0 sur 30 journées).

## La recherche (22/10, `src/search.js`)

**Comment elle joue.** Chaque fois qu'un robot libre a au moins deux commandes possibles, `search` de
`mcts-commun` joue des journées compatibles avec ce que savent les robots : le blocage pas encore vu est
retiré au sort (s'il arrive, et quand, après maintenant) ; un blocage vu reste tel quel. Elle choisit
parmi 5 commandes : les 3 plus proches, la première de la liste, la plus lointaine. L'arbre va deux choix
plus loin (ce robot, puis le suivant qui se libère), puis la liste joue jusqu'au bout de la journée. Une
journée est notée sur le tour de la dernière livraison plus un quart du tour moyen de livraison, comparé à
ce que fait la liste depuis le même point. 64 itérations par choix, sur des mondes communs (la k-ième
visite de chaque commande joue la même journée).

**Ce qu'elle donne** (`scripts/search-bench.js`, 30 journées par plan, les mêmes pour toutes les règles).
Le tour où la dernière commande est livrée, plus bas c'est mieux :

| Plan | la plus proche | la liste | la plus lointaine | recherche | recherche sur la plus lointaine |
|---|---|---|---|---|---|
| petit entrepôt | 40,9 | 44,7 | 36,8 | **36,5** | +0,3 tour (−0,2 à +0,9) |
| plan de Sami | 71,1 | 66,5 | 60,2 | **57,3** | **+2,9 tours (+2,8 à +3,1)**, 30 journées sur 30 |
| deux couloirs | 58,0 | 46,3 | 46,0 | **37,0** | **+9,0 tours (+9,0 à +9,0)**, 30 journées sur 30 |

- **La recherche finit avant les trois règles**, et de loin sur les couloirs étroits, où une affectation
  mal pensée fait attendre les robots les uns derrière les autres.
- **Elle livre aussi plus tôt en moyenne** : la plus lointaine d'abord finit tôt mais fait attendre les
  commandes proches (tour moyen 27,4 sur le petit entrepôt, 44,2 sur le plan de Sami, 36,5 dans les couloirs) ; la
  recherche, 21,9, 35,2 et 19,8.
- Ses réglages par défaut sont les meilleurs essayés : explorer moins (0,15), noter plus serré (10) ou
  doubler le budget (128) ne font pas mieux.
- Chaque choix de la recherche prend une centaine de millisecondes ; une journée, 1 à 4 s.

## La suite

1. **Le cariste** : un humain simulé (le plus proche, le plus urgent, au hasard) qui prend ses propres
   commandes, puis un vrai joueur dans la page.
2. **Des commandes qui arrivent pendant la journée**, avec des échéances.
