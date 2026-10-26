# La ligne cadencée, première version (26/10/2026)

Sami (26/10) : après les recherches de `docs/recherche/`, une variante de production, **la ligne cadencée d'abord**.
Des robots dès l'étape 1, un bac par trajet, des vraies données, un onglet dans la page. Elle vient à côté de
l'entrepôt, sans le remplacer : l'entrepôt, ses plans, ses mesures, ses replays et ses empreintes n'ont pas bougé.

## Ce qui se passe

- **Le plan** est un texte, comme ceux de l'entrepôt (`src/line-plan.js`), avec deux signes de plus :
  - `P` : un poste de la ligne, dans l'ordre de lecture ;
  - `b` : un emplacement de bac au bord de ligne, rattaché au poste le plus proche.

  Les blocs `A`…`L` sont le **supermarché**, une référence de pièce chacun. Les postes et le bord de ligne sont des
  étagères : un robot ne les traverse pas, il pose son bac depuis une case de sol voisine.
- **Le takt** : 11 tours (55 s, Toyota Georgetown). À chaque takt, chaque poste prend une pièce de chacune de ses
  références (`refs`, un groupe par poste séparé par `/`).
- **Le bord de ligne** : deux bacs de 12 pièces par référence (le *two-bin* : un bac en cours, un plein derrière).
  Quand le bac en cours se vide, le plein prend sa place et **une demande** part : il faut rapporter un bac plein.
- **L'arrêt** : s'il manque une pièce à un poste au moment du takt, **toute la ligne s'arrête** (une ligne mobile
  s'arrête d'un bloc) et le takt attend ce bac. C'est la mesure principale.
- **Les robots** sont ceux de l'entrepôt, avec leurs chemins réservés dans l'espace et le temps, l'allée `~` qu'on ne
  voit bloquée qu'à côté, céder le passage, les places de départ. Un robot libre reçoit une demande de la règle, va
  prendre un bac plein au bloc de la référence (un tour), le porte au poste, le pose (un tour).
- **La rupture fournisseur**, cachée : une référence manque au supermarché pendant 5 à 15 minutes, environ une fois par
  heure (une hypothèse, sans source). Le robot venu la prendre la voit, attend sur place, et tous le savent jusqu'au
  retour des bacs.
- **Une heure** de ligne : 720 tours d'environ 5 s, au plus 65 véhicules. Le stock du bac en cours de chaque
  référence est tiré au départ : la ligne tourne déjà.

Les chiffres et leurs sources sont dans [`docs/recherche/ligne-cadencee.md`](recherche/ligne-cadencee.md) ; les
hypothèses, dans `src/line-hypotheses.js`.

## Ce qui est repris de l'entrepôt

- `readWarehouse` lit un plan sans camion ; les postes y tiennent la place des quais, pour qu'aucun robot ne se gare
  devant la ligne (`day-spots.js`).
- `planLeg`, `hold`, `legToPickup`, `standBy` (`day-legs.js`), et `discover`, `retry`, `move`, `arrive`
  (`day-turn.js`), tels quels.
- La même forme de choix que `simulate.js` (`advance`, `nextChoice`, `choose`). La recherche, le worker de la page et
  les replays (`src/replay.js`) s'y branchent de la même façon.

## Les règles

| Règle | Ce qu'elle fait |
|---|---|
| **le kanban dans l'ordre** | les bacs dans l'ordre où ils se sont vidés |
| **la couverture la plus courte** | la référence la plus près d'arrêter la ligne (les pièces qui lui restent), l'EDD des logisticiens |
| **la plus proche** | le bloc le plus proche du robot |

**La recherche** (`src/line-search.js`) reprend celle de l'entrepôt : des mondes tirés de ce que savent les robots,
communs à tous les coups. Les blocages à venir et les ruptures pas encore vues y sont retirés ; une rupture vue dure
une durée tirée. Chaque monde est joué **15 minutes** (180 tours) en avant, et non jusqu'au bout de l'heure : deux bacs
couvrent 11 minutes, et l'heure entière à chaque itération serait trop longue. Son score : les tours d'arrêt, comparés
à ceux de la règle de jeu depuis le même point.

## Les plans

| Plan | Postes | Références | Robots | Ce qu'il montre |
|---|---|---|---|---|
| petite | 3 | 6 | 1 | une ligne bien servie |
| sami | 5 | 12 | 2 | une allée qui se bloque 30 % du temps |
| seul | 5 | 12 | 1 | le même, un seul robot : **le robot est la ressource rare** |
| etroite | 3 | 6 | 2 | un seul bac par référence : chaque bac vide arrête la ligne |

Dans les usines, un train de manutention sert une dizaine de postes ou plus (Alnahhal et Noche, 2013) : un robot pour
cinq postes est plutôt généreux.

## Premiers résultats (26/10)

**Les règles, 100 heures par plan** (`npm run line`). Les tours d'arrêt de la ligne par heure, moins c'est mieux ; entre
parenthèses, l'arrêt gagné sur le kanban, par paires, avec son intervalle à 95 % :

| Plan | le kanban | la couverture la plus courte | la plus proche |
|---|---|---|---|
| petite (1 robot) | **2,0** | 2,1 (−0,5 à 0,3) | 4,7 (perd 2,7 : −5,2 à −0,2) |
| sami (2 robots) | **2,6** | 2,6 (−0,4 à 0,3) | 4,0 (−3,2 à 0,4) |
| seul (1 robot) | 131,6 | 106,6 (**+25,1** : 16,5 à 33,6) | **76,8** (**+54,9** : 42,4 à 67,3) |
| etroite (bac unique) | 142,5 | **140,0** (+2,5 : 0,4 à 4,6) | **140,0** (+2,5 : 0,4 à 4,6) |

- **Une ligne bien servie ne s'arrête presque pas** : 2 à 3 tours par heure, 10 à 15 s, sous presque toutes les règles.
  Deux bacs couvrent 11 minutes : un robot a le temps. Ce qui l'arrête, ce sont les ruptures fournisseur.
- **Quand le robot est la ressource rare** (un seul pour cinq postes), la ligne perd 6 à 11 minutes par heure, et la
  règle compte : **la plus proche** fait deux fois moins d'arrêt que le kanban. Elle enchaîne les bacs proches au lieu
  de traverser le supermarché à chaque demande ; la couverture la plus courte, qui court au plus urgent, fait entre les
  deux.
- **Avec un seul bac par référence**, chaque bac vide arrête la ligne le temps d'un trajet : 12 minutes par heure,
  quelle que soit la règle. Le bord de ligne, pas l'ordre des demandes, fait l'arrêt : c'est l'argument du *two-bin*.

**La recherche, 20 heures par plan** (`npm run line -- --search`, 64 itérations, mondes joués 15 minutes en avant) :

| Plan | la meilleure règle | recherche | recherche sur la meilleure règle | temps |
|---|---|---|---|---|
| petite | le kanban, 1,2 | 1,2 | 0,0 (0,0 à 0,0) | 12 s pour les 20 heures |
| sami | le kanban, 4,5 | 5,2 | −0,7 (−2,1 à 0,8), 1 heure gagnée, 1 perdue | 27 s par heure |
| seul | la plus proche, 88,7 | **73,0** | +15,7 (−9,9 à 41,2), 13 heures gagnées, 7 perdues | 4 s par heure |
| etroite | la couverture, 134,4 | **132,8** | **+1,7 (0,2 à 3,2)**, 5 heures gagnées, 0 perdue | 0,5 s par heure |

- **Sur les lignes bien servies, la recherche ne trouve rien à gagner** : il n'y a presque pas d'arrêt à éviter. Sur la
  ligne de Sami à deux robots, elle est même un peu derrière le kanban (pas significatif), et lente : 27 s par heure, à
  cause des nombreuses demandes et des quatre allées.
- **Sur le bord étroit, elle bat la meilleure règle**, de peu mais nettement.
- **Sur la ligne à un seul robot, elle est devant** (−18 % d'arrêt sur la plus proche), mais l'intervalle contient
  encore 0 sur 20 heures : les mesures de nuit (`night.json`, 100 heures par plan) diront si l'écart tient.
