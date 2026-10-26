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
- **Ce n'est pas la règle de jeu qui la retient** sur la ligne de Sami à deux robots : jouer ses mondes au kanban plutôt
  qu'à la plus proche donne exactement les mêmes 17,2 tours d'arrêt sur 5 heures (le kanban seul : 14,6). Piste pour
  la suite : une ligne bien servie s'arrête surtout sur une rupture fournisseur, que personne ne peut prévoir ; la
  recherche n'a de prise que quand le robot manque.

## Étape 2 : la ligne plus vraie (26/10, l'après-midi)

Trois options du plan, chacune sans effet sur les plans de l'étape 1 : leur empreinte d'avant revient au coup près,
sans les mesures et les plans nouveaux.
- **Les tournées** (`capacity`, `src/line-tour.js`) : un robot qui vient de prendre un bac et peut en porter d'autres
  reste au supermarché (`loading`) ; on lui propose une autre demande, tant qu'il en reste. Il livre au poste le plus
  proche d'abord, un tour par dépôt. La capacité de 4 bacs est une hypothèse : 4 KLT d'une quinzaine de kilos, sous les
  90 kg d'un Omron LD-90.
- **Les bacs vides** (`returnEmpties`) : chaque bac vidé attend à son poste. Le robot qui y pose un bac reprend les vides
  qui attendent, dans la limite de sa place, puis les pose sur l'étagère de retour `r` (un tour).
- **Le mélange de modèles** (`models`, `src/line-models.js`) : chaque véhicule est essence (60 %) ou hybride (40 %), une
  hypothèse ; l'essence ne prend pas les pièces I et J de l'hybride, l'hybride pas les E et F de l'essence. Les robots
  connaissent les 20 véhicules à venir (hypothèse, environ 18 minutes) ; la recherche tire les suivants. La couverture
  d'une référence se compte alors en véhicules qui la prennent, sur ceux qu'on connaît.

**Les plans** : `retours` (la ligne de Sami, deux robots, les vides rapportés), `tournee` (un robot de 4 bacs, les vides
rapportés), `melange` (un robot, essence et hybride).

**Une correction en route** : les postes tenaient lieu de quais sur des cases qui ne sont pas du sol. Les cases
d'attente de la ligne étaient donc vides : céder le passage n'y faisait rien, et un robot pouvait se garer devant le
bord de ligne. Chaque poste a maintenant pour quai sa première case de dépôt. Sur 100 heures, les règles bougent de
quelques tours au plus, et aucune conclusion ne change.

## Étape 3 : le cariste au clavier (26/10, l'après-midi)

Le cariste (`src/line-human.js`) est une personne sur la grille. Il fait une action par tour : un pas (Z Q S D ou les
flèches) ou E. À côté d'un bloc, E prend le bac plein de la plus ancienne demande de cette référence ; devant le bord de
ligne du poste, E le pose.
- Il ne réserve pas de chemin, mais **il tient sa case** : les robots dont le chemin la traverse replanifient (`hold`
  de l'entrepôt) ; lui ne marche jamais là où un robot est, ou arrive au tour suivant.
- **Ses actions sont écrites** tour par tour : gardées dans le replay, envoyées au worker de la recherche ; l'heure se
  rejoue coup pour coup.
- **Une rupture qu'il voit** est signalée à tous tant qu'il reste au bloc ; parti, elle est levée et un robot ira voir.
  Une première version la gardait pour toujours : plus personne n'allait chercher la référence, et la ligne restait
  arrêtée jusqu'à la fin de l'heure (413 tours sur une heure de la petite ligne).

Pour mesurer sans personne au clavier, deux caristes simulés (`src/line-drivers.js`, `scripts/line-drivers.js`) : **qui
aide** (la demande dont la couverture est la plus courte, au plus court chemin), et **au hasard**.

**Ce que le cariste apporte** (`node scripts/line-drivers.js`, 100 heures par plan, la plus proche pour les robots ;
tours d'arrêt par heure, entre parenthèses l'arrêt gagné sur les robots seuls, par paires) :

| Plan | les robots seuls | le cariste qui aide | le cariste au hasard |
|---|---|---|---|
| petite | 4,7 | **1,0** (+3,7 : 1,0 à 6,5), 8,8 bacs | 6,1 (−1,3 : −3,7 à 1,0) |
| sami | 4,4 | 3,1 (+1,3 : −0,3 à 2,9) | 14,3 (−9,9) |
| seul | 77,1 | **45,1** (+32,0 : 20,3 à 43,8), 14,8 bacs | 105,9 (−28,8) |
| retours | 132,8 | **11,0** (+121,8 : 113,3 à 130,2), 16,3 bacs | 171,9 (−39,1) |
| tournee | 164,7 | **37,1** (+127,6 : 115,6 à 139,7), 18,2 bacs | 193,8 (−29,0) |
| melange | 44,2 | **24,3** (+19,9 : 7,3 à 32,5), 13,3 bacs | 63,4 (−19,1) |
| etroite | 140,0 | 166,1 (**−26,1** : −31,4 à −20,8), 0,1 bac | 156,6 (−16,6) |

- **Un cariste qui aide sauve la ligne quand le robot manque** : avec les vides à rapporter, il ramène l'arrêt de 133
  à 11 tours par heure, en portant 16 bacs ; sur les tournées, de 165 à 37.
- **Sur le bord étroit, il gêne** : les deux robots prennent chaque demande avant lui, il n'en porte aucune, et ses
  allées et venues les font replanifier.
- **Un cariste qui ne fait pas attention coûte partout**, de 1 à 39 tours par heure : il tient des cases dont les robots
  ont besoin.
- Deux erreurs du cariste simulé, corrigées en route : il gardait pour toujours une rupture vue puis quittée (la ligne
  s'arrêtait jusqu'à la fin de l'heure), et, sans rien à faire, il restait planté sur la case de ramassage que visait le
  seul robot occupé. Il retourne maintenant à sa place.

## La suite des étapes 2 et 3 (26/10, le soir)

**Le supermarché réapprovisionné par l'entrepôt** (`supermarket`, `src/line-supermarket.js`, plan `supermarche`, sans
rupture fournisseur pour voir le stock seul).
- Chaque référence a un stock de bacs pleins, que tout le monde voit, comme dans un logiciel d'entrepôt.
- Quand il tombe au seuil, une commande part à l'entrepôt ; les bacs reviennent après un délai que personne ne connaît,
  et que la recherche retire au sort dans ses mondes.
- Personne ne va chercher une référence vide ; un robot déjà en route attend sur place.
- Hypothèses : 3 bacs par référence (environ 33 minutes de ligne), une commande quand il en reste un, retour en 10 à 40
  minutes.

Ce que ça donne (20 heures, la ligne de Sami à deux robots, tours d'arrêt par heure ; le kanban / la couverture / la
plus proche) :

| Supermarché | arrêt |
|---|---|
| 4 bacs, commande à 1, retour en 5 à 20 min | 0 / 0 / 0 |
| 2 bacs, commande à 1, retour en 10 à 30 min | 5,8 / 3,1 / 6,8 |
| 3 bacs, commande à 1, retour en 10 à 40 min (le plan) | 73,9 / 71,7 / 69,9 |
| 4 bacs, commande à 2, retour en 30 à 75 min | 29,4 / 29,1 / 28,6 |

**Bien dimensionné, le supermarché n'arrête jamais la ligne ; trop juste, il l'arrête quelle que soit la règle des
robots.** Quand le bac n'est pas au supermarché, l'ordre des demandes n'y peut rien : la décision qui compte devient
le seuil de commande et la taille du stock, une décision pour une prochaine étape.

**La zone de prudence** (`caution`, `src/line-human.js`) : un robot qui va bouger depuis une case voisine du cariste
attend ce tour-là, un tour sur deux, comme l'ISO 3691-4 demande à un véhicule sans conducteur de ralentir près d'une
personne. Elle est active dès qu'il y a un cariste (`caution: false` pour l'enlever). Avec le cariste qui aide, sur 20
heures : la ligne à un robot passe de 48,7 à 77,4 tours d'arrêt (12,6 ralentissements par heure : quand le robot est la
ressource rare, chaque tour perdu se paie), les autres ne bougent guère.

**L'analyse d'une heure jouée avec le cariste** (`src/line-analysis.js`, onglet Replays, « Analyser ») : l'heure
rejouée telle qu'elle a été, contre la même heure sans le cariste, les robots sous la même règle (la couverture quand la
recherche jouait : une heure de recherche est trop longue pour la page). L'arrêt de la ligne par tranches de 5 minutes,
les deux côte à côte ; le tableau des mêmes chiffres ; ce que le cariste a fait.

## Le stock comme décision, l'entrepôt comme une file (26/10, la nuit)

**Le seuil de commande** (`supermarket.policy`, `src/line-supermarket.js`, `node scripts/line-stock.js`) :
- **« point »** : on commande quand le stock tombe à `reorder` bacs (par défaut) ;
- **« cover »** : on commande quand le stock ne couvre plus le délai attendu, au rythme de la ligne (une référence prise
  par plusieurs postes, ou par la plupart des véhicules à venir, commande plus tôt).

Sur 100 heures, les robots au kanban (tours d'arrêt par heure ; stock moyen tenu au supermarché) :

| Cas | seuil à 1 bac | seuil à 2 bacs | à la couverture |
|---|---|---|---|
| le supermarché juste (3 bacs, retour en 10 à 40 min) | 73,8 ; 17,4 bacs | **0,0** ; 20,7 bacs | **0,0** ; 20,7 bacs |
| le mélange de modèles, deux robots | 66,5 ; 19,1 | 0,2 ; 22,8 | **0,1 ; 21,2** |
| un entrepôt lent (4 bacs, retour en 20 à 60 min) | 27,5 ; 20,1 | 20,7 ; 23,2 | **9,9** ; 26,9 |

- Commander un bac plus tôt supprime les arrêts du supermarché juste, pour 3,3 bacs de stock en plus.
- La couverture fait aussi bien avec moins de stock quand les références ne s'épuisent pas au même rythme (le mélange).
- Face à un entrepôt lent, c'est la couverture qui protège le mieux, au prix de plus de stock.

**L'entrepôt comme une file de préparateurs** (`supermarket.warehouse`, plan `file`) : chaque commande attend un
préparateur libre, demande un temps de préparation tiré, puis 5 minutes de trajet. C'est un pas vers l'entrepôt joué
pour de bon. Ce que ça montre (20 heures) :
- **un entrepôt sous-dimensionné arrête la ligne quelle que soit la politique** : à 5 à 20 minutes de préparation par
  commande, il faudrait environ 7 préparateurs ; à 3, la ligne perd 60 à 90 tours par heure ;
- **un entrepôt rapide permet le juste-à-temps** (100 heures) : à 3 préparateurs de 2 à 6 minutes, aucune politique
  n'arrête la ligne, mais la couverture tient 17,5 bacs, contre 22,7 au seuil à 1 bac et 27,5 au seuil à 2 (un quart de
  stock en moins, deux fois moins de commandes). À 2 préparateurs, sans stock de sécurité, la couverture laisse 19,8
  tours d'arrêt par heure (−23,4 à −16,3) quand les seuils n'en laissent aucun : le juste-à-temps demande un entrepôt
  qui suit.

**Une recherche plus calme** (`lineSearchRule({ calm: true })`) : quand la règle de jeu n'arrête la ligne dans aucun
des mondes tirés pour sa référence, la recherche rend le choix de la règle sans construire d'arbre. Sur 10 heures par
plan, rien de perdu, et un peu de temps gagné (la ligne à un robot de 18 à 12 s par heure, les tournées de 16 à 13). Elle
reste coupée par défaut tant que la campagne sur la règle de jeu tourne : les deux se décideront ensemble.

## L'usine : la ligne et l'entrepôt joués ensemble (26/10, la nuit)

`src/plant.js`, `npm run plant`, l'onglet **Usine** de la page. La ligne et l'entrepôt avancent sur une seule horloge
(un tour, 5 s, dans les deux).
- **Quand le supermarché commande une référence** (`supermarket.source: "warehouse"`), la commande arrive dans
  l'entrepôt en cours de journée (les commandes au fil de la journée, `docs/modele.md`), pour le bloc de la même lettre.
- **Les robots de l'entrepôt la préparent** comme une autre, et la posent à son quai. Le quai tient lieu de départ de la
  navette, qui met 5 minutes (une hypothèse) à rejoindre le supermarché. La référence est alors pleine.
- **Chacun garde ses robots et sa règle.** Une règle de l'entrepôt peut **regarder la ligne** : « la plus urgente pour la
  ligne » sert d'abord la commande dont le supermarché tient le moins de bacs.
- Les plans : `usine` (la ligne de Sami, son supermarché juste, l'entrepôt de Sami et ses 4 robots), `vite` (le
  supermarché commandé à 2 bacs).

Ce que ça donne (la ligne au kanban ; tours d'arrêt de la ligne par heure ; délai moyen de la commande du supermarché à
son stock plein) :

| L'entrepôt | dans l'ordre | la plus proche | la plus lointaine | la plus urgente pour la ligne |
|---|---|---|---|---|
| 1 robot, 100 heures | 0 ; 118 tours | 0 ; 102 | **122,9** ; 159 | 0 ; 102 |
| 2 robots, 100 heures | 0 ; 95 | 0 ; 92 | 0 ; 104 | 0 ; 92 |
| 1 robot, supermarché à 2 bacs, 20 heures | 0 ; 145 | **84,8** ; 120 | **271,4** ; 167 | 0 ; 129 |

- **Un entrepôt de 2 robots suffit à la ligne de Sami** : la navette comprise, un bac revient en 8 minutes environ.
- **Avec un seul robot, la règle de l'entrepôt fait l'arrêt de la ligne** : la plus lointaine d'abord laisse attendre
  les blocs proches, et la ligne perd 10 minutes par heure ; sur un supermarché plus juste, la plus proche affame à son
  tour les blocs lointains. **L'ordre des commandes et la règle qui regarde la ligne ne laissent aucun arrêt.**
- Première version : des règles seulement. La recherche, les replays de l'usine et une recherche d'entrepôt qui
  connaîtrait l'état de la ligne restent à faire.

## La navette à heure fixe, et une recherche d'entrepôt qui regarde la ligne (26/10, la nuit)

Les recherches du soir ([recherche/hypotheses.md](recherche/hypotheses.md), Q13) disent qu'un train de manutention
part plutôt à heure fixe, toutes les 15 à 60 minutes, qu'à la demande.
- **La navette à heure fixe** (`setup.shuttleEvery`, plan `train`) : une palette posée au quai attend le prochain
  départ, toutes les 20 minutes (une hypothèse), puis roule 5 minutes. Le délai moyen, de la commande du supermarché à
  son stock plein, passe d'environ 8 à 17 minutes.
- **Une règle de plus** : « la couverture de la ligne » (`lineCover`) sert d'abord la référence pour laquelle la ligne
  s'arrêtera la première, en comptant son bord de ligne et son stock.
- **La recherche dans l'usine** (`src/plant-search.js`) : elle choisit la commande que prend un robot de l'entrepôt.
  Chaque monde est l'usine entière : l'allée de l'entrepôt et ce que la ligne cache sont retirés au sort, les commandes
  en route gardées. Il est joué 30 minutes, la ligne au kanban, l'entrepôt dans l'ordre des commandes au-delà de
  l'arbre. Elle est jugée sur l'arrêt de la ligne.

Ce que ça donne, plan `train`, 100 heures (tours d'arrêt de la ligne par heure ; dans l'ordre / la plus proche / la
plus lointaine / la plus urgente / la couverture de la ligne) :

| L'entrepôt | arrêt |
|---|---|
| 1 robot | 3,3 / 3,2 / **123,6** / 3,2 / **61,1** |
| 2 robots | 1,8 / 1,5 / 5,6 / 1,5 / 2,7 |
| 4 robots | 1,2 / 1,2 / 2,1 / 1,2 / 3,3 |

- **La navette elle-même arrête un peu la ligne** : même avec 4 robots, la ligne attend le prochain départ.
- **Servir d'abord ce qui manquera le premier est une mauvaise règle quand l'entrepôt est en retard** : avec un robot,
  la couverture de la ligne perd 58 tours par heure sur l'ordre des commandes. Elle court après la référence déjà
  perdue, et les autres se mettent en retard à leur tour (comme la règle EDD face à une file surchargée).
- **La recherche joue exactement l'ordre des commandes** (6 heures du plan `train`, et 8 heures avec une navette de 25
  minutes et 2 bacs au supermarché : ni gain ni perte). Ce n'est pas un défaut des mondes : chaque commande change bien
  les livraisons, mais l'arrêt de la ligne ne bouge pas. C'est la référence la plus en retard qui le fixe, et un seul
  choix d'entrepôt ne la déplace presque jamais. Ce qui compte, c'est la règle tenue sur toute l'heure (la plus
  lointaine, la couverture), pas une décision. La mesure sur 100 heures est dans la file (`usine-train-recherche`).

## Les chiffres trouvés en ligne, appliqués (26/10, le soir)

Sami : prendre les valeurs trouvées ([recherche/hypotheses.md](recherche/hypotheses.md)), en attendant un référent.
- **Le mélange** : 20 % essence, 80 % hybride (`LINE.mix`, 60/40 avant ; Toyota Motor Europe vend 77 % d'électrifiés).
- **La séquence** : prévue pour toute l'heure ; 5 % des véhicules reculent de 1 à 5 places au dernier moment, et ne se
  voient que 5 véhicules avant (`LINE.resequence` ; la part et la portée sont estimées). Les mondes de la recherche
  gardent les 5 véhicules sûrs et retirent les déplacements sur la suite prévue. La page montre les véhicules prévus en
  plus pâle.
- **Les 90 s du camion** ne touchent pas la ligne (un bac se pose en un tour), mais l'usine, dont l'entrepôt charge la
  navette au quai ([modele.md](modele.md)).

La ligne mêlée (un robot, 100 heures, tours d'arrêt par heure ; le kanban / la couverture / la plus proche) :
- 60/40 : 63,5 / 32,4 / 44,2 ;
- 20/80 : 60,0 / 33,6 / 36,7 ;
- 20/80 et le reséquencement : 60,6 / 33,5 / 37,6.

La couverture reste la meilleure règle. La plus proche s'en rapproche : les pièces du modèle rare, l'essence
maintenant, servent moins souvent. Le reséquencement ne change presque rien aux règles, qui ne regardaient que les 20
véhicules suivants.

**L'usine avec les 90 s du quai** (100 heures, la ligne au kanban ; tours d'arrêt par heure ; dans l'ordre / la plus
proche / la plus lointaine / la plus urgente / la couverture de la ligne). Dans l'usine, le quai de l'entrepôt est le
départ de la navette, et le modèle compte 90 s pour y poser une palette, comme dans un camion :

| L'usine | 1 robot | 2 robots | 4 robots |
|---|---|---|---|
| navette à la demande (`usine`) | 11,1 / 117,2 / 149,5 / 34,3 / 66,6 | 0 / 1,5 / 11,8 / 0 / 0 | 0,3 / 0,8 / 2,3 / 0,8 / 0,7 |
| navette à heure fixe (`train`) | 82,0 / 132,7 / 153,6 / 116,9 / 113,7 | 30,0 / 37,1 / 86,7 / 32,2 / 37,9 | 33,4 / 42,6 / 51,4 / 36,0 / 31,2 |

- **Le quai devient le goulot** : un robot à la fois, 90 s par palette. Avec la navette à heure fixe, 4 robots
  n'arrêtent pas plus la ligne que 2 (33,4 contre 30,0) : c'est le quai, pas les robots, qui manque.
- **L'ordre des commandes reste la meilleure règle** avec un ou deux robots. La plus proche, qui ne perdait rien avec
  un tour au quai, perd maintenant 106 tours par heure avec un robot.
- **Ce chiffre est à confirmer** : poser une palette sur un train de manutention prend sans doute moins de temps que la
  charger dans un camion ([recherche/hypotheses.md](recherche/hypotheses.md), Q21).
