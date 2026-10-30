# Le modèle de l'entrepôt, première version (22/10/2026)

Une journée jouée tour par tour : des robots, des commandes, des chemins réservés dans l'espace et le
temps, une allée qui peut se bloquer sans prévenir, trois règles de référence et, depuis le soir du 22/10,
l'affectation par la recherche (plus bas).

## Ce qui se passe

- **Le plan** est un texte (`src/plans.js`) : `.` le sol, une majuscule un bloc de rayons, `T` le camion,
  `~` une case qui peut se bloquer, `#` un mur. Trois plans pour commencer : un petit entrepôt de 9 × 4, le
  plan de Sami de 17 × 7 avec son couloir de la ligne 2, deux couloirs étroits. La page permet d'en
  dessiner un autre.
- **Les commandes** sont des lettres de blocs, dans l'ordre où elles arrivent ; toutes sont là au départ. Depuis le
  29/10 (Sami), chaque journée tire les siennes parmi les blocs de la liste du plan, et chaque camion garde son nombre
  de commandes (`drawOrders: false` garde la liste écrite). Le plan d'assemblage tire les siennes depuis le 30/10.
- **Un robot libre** reçoit une commande de la règle, va jusqu'à une case de sol au bord du bloc, prend
  (un tour), rapporte au camion, dépose (un tour).
- **Les chemins** : chaque trajet est un chemin A* dans l'espace et le temps (`grid` de `mcts-commun`),
  réservé autour des chemins déjà réservés. Jamais deux robots dans la même case, jamais deux robots qui se
  croisent, dans le camion non plus (Sami, 23/10 au soir, plus bas).
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

(Ces chiffres datent d'avant la correction du 23/10, plus bas : dans les couloirs, la plus proche finit
désormais au tour 49,0.)

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
| petit entrepôt | 40,7 | 44,7 | 36,8 | **36,5** | +0,3 tour (−0,2 à +0,9) |
| plan de Sami | 71,1 | 66,5 | 60,2 | **57,3** | **+2,9 tours (+2,8 à +3,1)**, 30 journées sur 30 |
| deux couloirs | 49,0 | 46,2 | 41,0 | **37,0** | **+4,0 tours (+4,0 à +4,0)**, 30 journées sur 30 |

Chiffres refaits le 23/10 après la correction des cases de ramassage (plus bas) : elle ne change que les
couloirs, où les règles finissent plus tôt (la plus lointaine 46,0 → 41,0) ; l'avance de la recherche y passe
de 9 à 4 tours.

- **La recherche finit avant les trois règles**, et de loin sur les couloirs étroits, où une affectation
  mal pensée fait attendre les robots les uns derrière les autres.
- **Elle livre aussi plus tôt en moyenne** : la plus lointaine d'abord finit tôt mais fait attendre les
  commandes proches (tour moyen 27,4 sur le petit entrepôt, 44,2 sur le plan de Sami, 36,5 dans les couloirs) ; la
  recherche, 21,9, 35,2 et 19,8.
- Ses réglages par défaut sont les meilleurs essayés : explorer moins (0,15), noter plus serré (10) ou
  doubler le budget (128) ne font pas mieux.
- Chaque choix de la recherche prend une centaine de millisecondes ; une journée, 1 à 4 s.

## Les quais, les camions et les bornes (23/10, Sami)

Sami a redessiné son entrepôt (le plan **« Trois quais »**, 22 × 7) :

```
.....................#
c.AAA.BBB.CCC.DDD.wwwT
c....~~~~~...........#
..EEE.FFF.GGG.HHH.wwwT
c....................#
c.III.JJJ.KKK.LLL.wwwT
.....................#
```

- **`c` une borne de charge** : chaque robot part de la sienne, à gauche dans le hangar, et y retourne
  quand il n'a rien à faire. En chemin, il peut encore recevoir une commande. Les robots sans borne partent
  d'une case à l'écart près du premier quai (plus bas).
- **`T` un quai, `w` sa baie** : les cases devant la porte. Les commandes se répartissent entre les camions
  par `/` (`AFKD/EJCH/IBGL`, les quais de haut en bas), et chaque camion arrive à son tour (20, 40, 60).
  - Une commande se prépare **avant** son camion : la palette attend sur une case de la baie, une palette
    par case.
  - **La baie n'est qu'une zone réservée** (Sami, 23/10) : quand le camion arrive, il faut encore qu'un robot
    reprenne chaque palette de la baie et la monte dans le camion. Ce chargement est proposé aux robots libres
    avant les commandes à aller chercher. Une commande prise quand le camion est déjà là va directement dans
    le camion.
  - Une commande ne se prend que s'il reste une case libre dans sa baie (elle la réserve en partant), ou
    si son camion est déjà là.
  - La baie se remplit depuis le camion, pour que l'allée qui y mène reste libre.
- **`#` le mur, ou l'extérieur** entre les camions.
- **La mesure : le temps à quai des camions**, la somme, pour chaque camion, des tours entre son arrivée et sa
  dernière palette chargée : un camion doit rouler, pas attendre, sinon les livraisons suivantes glissent. Avec un seul camion là dès le départ, c'est le tour de la fin, comme avant : les trois
  premiers plans et leurs chiffres ne bougent pas (vérifié, même empreinte). La recherche se juge sur cette
  attente, son échelle multipliée par le nombre de camions.
- **Une quatrième règle** pour juger honnêtement : **le camion attendu d'abord**, la commande la plus
  proche parmi celles du camion qui arrive le premier.

**Ce que ça donne**, avec le chargement par un robot (20 journées, temps à quai des trois camions en tours ;
les journées se ressemblent presque toutes, le blocage ne changeant presque rien sur ce plan) :

| la plus proche | la plus lointaine | le camion attendu d'abord | la liste | recherche |
|---|---|---|---|---|
| 94,0 | 177,4 | 96,0 | 76,0 | **66,1** (20 journées sur 20, +9,9 tours sur la liste) |

Avant le chargement par un robot (la palette montait seule dans le camion), c'était 84,1 / 134,1 / 67,9 / 39,0
/ 32,0 : le chargement coûte 25 à 40 tours de quai sur la journée, c'est-à-dire un trajet baie → camion par
palette posée d'avance.

- **La liste gagne parmi les règles**, parce qu'elle est écrite dans l'ordre des camions et qu'elle mélange
  près et loin. « Le camion attendu d'abord » perd 20 tours sur elle : prendre d'abord les commandes proches
  de chaque camion laisse les lointaines pour la fin.
- **La plus lointaine d'abord**, la meilleure règle des premiers plans, est **la pire ici** : elle ignore
  les camions.
- **Avec 3 cases par baie et 4 commandes par camion**, la quatrième commande de chaque camion ne peut partir
  qu'à son arrivée. C'est ce qui rend la décision intéressante : quoi préparer à l'avance.
- La recherche notait d'abord comme la liste, coup pour coup : avec trois camions, ses écarts dépassaient son
  échelle (20 tours) et chaque monde valait 0 ou 1. Avec l'échelle multipliée par le nombre de camions, elle
  gagnait 7 tours, et 9,9 avec le chargement.

**Une correction au passage.** Un robot garé pour de bon sur la case de ramassage d'un bloc empêchait les
autres d'aller y chercher : leur trajet échouait, et ils restaient sur place toute la journée. Le robot
essaie maintenant les autres cases du bloc, de la plus proche à la plus lointaine. Un trajet de dépôt qu'on
ne trouve pas tout de suite est retenté à chaque tour. Cela ne changeait que les couloirs (tableau plus haut).

## Une case, un robot ; un seul chargeur par camion (23/10, Sami, le soir)

Sami : les robots se superposaient sur une même case, dans le camion par exemple. Il faut l'interdire. Du
coup, un seul robot devrait faire les navettes entre la baie et le camion, pour éviter les bouchons devant
le quai.

**Ce qui change.**
- **Plus aucune case partagée.** Ni le camion, ni les bornes : un robot par case, toujours. Les robots sans
  borne à eux (le petit entrepôt, le plan de Sami et les couloirs n'en ont pas) partent d'une **case à
  l'écart**, la plus proche du premier quai :
  - pas un quai, pas une case de baie, pas une case juste à côté d'un quai, pas un `~` ;
  - une case dont la perte ne coupe aucune allée : le reste du sol reste relié sans elle ;
  - d'abord hors des cases de ramassage. Dans les couloirs, il n'y en a qu'une : on prend alors les recoins
    à côté des rayons.
- **Le camion prend les robots un par un, dans l'ordre d'arrivée.** Les autres attendent leur tour sur une
  case à l'écart, la plus proche du camion. Si le premier de la file ne peut pas y aller (dans un couloir
  étroit, bloqué par celui qui attend), le premier de la file qui le peut passe, et l'autre s'écarte. Un robot
  libre qui ne peut pas rentrer chez lui va aussi à l'écart.
- **Un chargeur par camion.** Dès qu'un camion est à quai, le premier robot qui prend une palette dans sa
  baie devient son chargeur, et lui seul entre dans ce camion.
  - Les autres robots déposent sur la baie. La baie pleine, ils entrent quand même : c'est noté
    (`overflow`) et testé.
  - Le chargeur prend d'abord les palettes de la baie, puis les commandes de son camion, qu'il porte tout
    droit dedans. Sans rien à faire, il attend à l'écart.
  - Il est libre de nouveau quand son camion part.
  - Dans la page, on lit « Robot 2 (charge le camion 1) », ou « attend son tour au camion ».
- **Le robot passe sous les palettes, pas avec une palette** (Sami, le même soir) : un robot vide passe sous
  une palette posée sur la baie, mais deux palettes ne tiennent jamais sur une case. Un robot chargé ne
  traverse donc pas une case de baie occupée.
  - Le chargeur ne prend une palette que si son chemin jusqu'au camion est libre, en comptant les cases
    promises à d'autres palettes. La baie se vide ainsi du côté du camion, comme une pile.
  - Le camion là, les autres robots déposent au fond de la baie, jamais sur la case à la porte du camion :
    le chargeur garde son passage. Avant, un chargeur parti du fond se retrouvait coincé derrière deux
    palettes posées entre lui et le camion.
  - Testé à chaque tour : jamais un robot chargé sur une case qui porte une palette.
- **Des journées plus longues** : 140 tours au lieu de 120 pour le plan de Sami, 240 au lieu de 160 pour les
  quais. Avec la file au camion, la plus lointaine d'abord ne finissait plus toutes ses journées.

**Ce que ça coûte** (100 journées, 20 pour les quais ; tours jusqu'à la dernière livraison ; pour les quais, temps à quai) :

| Plan | la plus proche | la liste | la plus lointaine | le camion attendu d'abord |
|---|---|---|---|---|
| petit entrepôt | 40,8 → 48,0 | 44,8 → 47,2 | 36,7 → 40,5 | 40,8 → 48,0 |
| plan de Sami | 71,1 → 86,2 | 66,3 → 87,3 | 60,1 → 103,3 | 71,1 → 86,2 |
| deux couloirs | 49,0 → 78,6 | 46,2 → 73,9 | 41,0 → 64,9 | 49,0 → 78,6 |
| trois quais (temps à quai) | 94,0 → 126,0 | 76,0 → 104,0 | 177,4 → 314,7 | 96,0 → 115,0 |

- **Partager le camion était un gros cadeau.** Quatre robots qui déposent dans la même case au même tour,
  c'est ce qui rendait le plan de Sami rapide. Un par un, la file d'attente au camion coûte 15 à 40 tours.
- **La plus lointaine d'abord perd sa place sur le plan de Sami** : ses robots reviennent tous ensemble de
  loin et font la queue. La plus proche et la liste passent devant.
- **Dans les couloirs**, attendre son tour sans boucher l'allée unique coûte 25 à 30 tours.
- **Sur les quais, la plus lointaine d'abord s'effondre** (314,7) : elle va chercher pour tous les camions à
  la fois, les baies se remplissent, et les robots attendent, une palette sur le dos, qu'une case se libère.
- **La recherche** (20 journées sur les quais) : **92** tours à quai, contre 104 pour la liste, 20 journées sur
  20 (+12 tours ; elle en gagnait 9,9 avant). Une journée de recherche prend 22 s.
- **Une recherche de chemin coûteuse, corrigée en route** : une case où quelqu'un est garé pour de bon ne peut
  pas finir un trajet. Le chercher quand même fouillait tout l'espace et le temps à chaque tour. On le voit
  maintenant d'un coup d'œil, avant de chercher : une journée du plan de Sami est passée de 350 à 14 ms, sans
  changer un seul coup.

**La page ne gèle plus pendant la recherche** (Sami, le même soir). Sur le plan de Sami, la recherche réfléchit 1,7 s au premier tour (8 s dans les couloirs), et la page jouait ses tours dans le fil de la page : Chrome finissait par dire « Page ne répondant pas ». La recherche tourne maintenant dans des workers (`web/search-worker.js`). L'état d'une journée ne se transmet pas (il contient des fonctions) : le worker la refait depuis son plan, son numéro et les choix déjà faits, puis cherche le suivant ; même journée, mêmes coups (le plan de Sami finit au tour 69 dans la page comme sous Node). La comparaison joue ses 12 journées de recherche en même temps, sur les cœurs moins deux : 11 s. Et **les points de départ** des robots sans borne sont dessinés : un cercle pointillé à leur numéro.

**Un camion à une seule porte** (Sami, le même soir : son plan, le camion en 18e colonne, entouré de l'extérieur). Sa seule porte, (16,3), est aussi la case où l'on prend « H ». Aucune règle ne finissait la journée (5 à 10 livraisons sur 12), et la recherche mettait 77 s à son premier tour, chaque monde simulé s'y bloquant. Trois corrections :
- **un robot qui ne peut pas entrer dans le camion** attend son tour à l'écart, jamais sur la porte ;
- **les cases d'attente et de départ sont à trois pas au moins d'un quai** : deux robots garés de part et d'autre de la porte enfermaient celui du camion ;
- **une erreur de `mcts-commun`** : un robot qui replanifie ne voyait pas un robot arrêté pour de bon sur une case de son ancien chemin, et y entrait. Corrigée et testée là-bas. Elle cachait un face-à-face dans les couloirs : deux robots nez à nez dans l'allée unique se voient garés pour de bon. **Celui qui attend depuis le plus longtemps cède le passage** : il s'écarte sur la case libre la plus proche, à quatre pas au plus, puis repart.

Sur le plan de Sami, toutes les règles finissent (tours 91 à 115) et la recherche finit au tour 75. Ailleurs : petit entrepôt 44,1 à 46,5 (la liste et la plus proche), quais 100 (liste) et 114 (plus proche) au lieu de 104 et 126 ; plan de Sami et couloirs presque inchangés.


**Une recherche douze fois plus rapide, mêmes coups** (Sami, le même soir, sur un plan à quatre bornes). Le premier tour prenait 20 s, presque tout en recherches de chemin qui échouaient : la file du camion redemandait à chaque tour un chemin vers un camion dont l'unique porte était tenue par un robot garé. Une recherche qui échoue fouille tout l'horizon (80 tours) : 13 ms, et 1 313 fois au premier tour. On regarde maintenant d'abord si chaque accès à la cible est tenu pour de bon, et on renonce sans chercher. Une journée de recherche : 43 s → 3,5 s sur ce plan, 28 → 3,6 s sur le camion à une porte, 17,5 → 2,1 s dans les couloirs ; les coups de toutes les règles et de la recherche sont identiques.


## Les nouveaux plans de Sami : obstacles, bornes, zones d'attente (23/10, tard le soir)

Sami a redessiné le plan de Sami (13 × 7 : quatre bornes, deux zones `w` dans les coins, un camion à une porte) et les trois quais (16 × 7, avec des murs et deux allées `~`). Ce que ça a demandé :
- **Une zone d'attente n'a plus besoin de toucher le camion** : un groupe de `w` qui ne touche aucun quai appartient au camion le plus proche, ses cases après la baie de ce camion, les plus proches d'abord.
- **Une zone n'est pas une ligne** : le chargeur s'est retrouvé coincé dans un coin derrière deux palettes. Une palette ne se pose maintenant que si toutes les palettes en attente ou promises, et tout robot qui en porte une, gardent un chemin libre jusqu'au camion (ou jusqu'à leur case).
- **Pas de commande sans place** : le camion là, un robot autre que le chargeur réserve sa case dans la zone en partant chercher (au fond, jamais à la porte), et le chargeur ne va chercher lui-même qu'une fois sa baie vide. Sans quoi les quatre robots finissaient chacun une palette dans les mains devant un camion dont l'unique porte portait une palette en attente.
- **On ne ramasse pas sous une palette** : une case de zone peut toucher un bloc (le `w` en (11,1) touche D) ; on n'y prend rien quand une palette y attend, et on n'y pose rien quand un robot y va pour prendre.
- **Le plan de Sami dure 220 tours** : le camion est là dès le départ, donc tout passe par les zones et le seul chargeur ; 122 à 196 tours selon la règle et le blocage. Les trois quais : 92 à 247 tours à quai cumulés selon la règle.
- **Les allées bloquées** portent une croix ❌, pâle tant qu'aucun robot ne l'a vue.
- **La recherche, plus rapide, mêmes coups** : les vérifications de chemins se font en un balayage par destination, et sont gardées en mémoire (comme les distances au sol, qui ne dépendent que du plan). Une journée de recherche : 31 → 7,9 s sur le plan de Sami, 19,6 → 3,0 s sur les quais (empreinte des coups identique).


**Au plus près du camion, et un chargeur par zone** (Sami, le même soir, en regardant le plan de Sami : le robot 3 chargeait tout seul pendant que les deux zones se remplissaient).
- **Une palette se pose sur la case libre la plus proche du camion**, toutes zones confondues (et non plus au fond) ; le camion là, jamais sur une case qui touche sa porte, le passage des chargeurs. Les autres garde-fous restent : personne enfermé, pas de pose sous un robot qui vient prendre.
- **Un chargeur par zone** : le premier robot qui prend une palette dans une zone en devient le chargeur ; un robot ne charge qu'une zone. Sur le plan de Sami, la zone du haut et celle du bas ont chacune le leur, qui entrent au camion tour à tour par sa file. Un chargeur ne va chercher lui-même qu'une fois sa zone vide.
- En route, trois accrocs corrigés : un robot chargé dont le chemin passait par une case où l'on vient de poser une palette replanifie ; on ne propose pas une palette sous un autre robot ; un robot qui ne peut pas aller où il a choisi sort des zones au lieu d'y rester planté (les quatre robots, chacun sous une palette, attendaient chacun celle d'un autre).

Sur le plan de Sami (40 journées, tours jusqu'à la dernière livraison) : la plus proche 163 → 109, la liste 178 → 102, la plus lointaine 196 → 124 ; **la recherche 167 → 93** (3,3 s par journée). Les trois quais, qui n'ont qu'une zone par camion, ne bougent presque pas (liste 120, plus proche 188 tours à quai cumulés).


**Une baie dans l'allée unique** (Sami, le même soir : les deux couloirs étroits avec `www` juste avant le camion, dans la seule allée). Trois règles sur quatre bloquaient toutes leurs journées : un robot réservait (10,2) et partait chercher ; un autre réservait (9,2), arrivait le premier et posait ; le premier, chargé, ne pouvait plus passer, et la palette de (9,2) ne pouvait pas partir, (10,2) lui étant promise. Ce qui est vérifié maintenant :
- **la réservation d'une case** garde aussi le chemin des robots partis chercher une commande à case promise, depuis là où ils vont la prendre (et non depuis là où ils sont) ;
- **un chargeur ne va chercher lui-même** que si aucune palette, posée ou promise, ne se trouve entre l'endroit où il prendra et le camion ; et personne ne réserve une case qui lui couperait ce chemin ;
- au passage, deux erreurs : la réponse « ce camion prend encore une palette » gardée par camion valait pour toutes ses commandes, alors que pour un chargeur elle dépend de l'endroit où l'on prend ; et un robot pris dans une allée bloquée pouvait, en en sortant, prévoir de traverser une autre allée bloquée, refusait d'y entrer, et un autre robot arrivait sur sa case. Il ne ressort plus que par sa propre allée.

Sur ce plan, toutes les journées finissent : 58 à 84 tours selon la règle (75 à 95 avec un camion au tour 20) ; testé avec un blocage fort. Les autres plans gardent exactement leurs chiffres.


**Une zone d'attente faite au départ** (Sami, le même soir : sans zone, les robots font encore des allers-retours pour se laisser passer). Un camion à qui le plan ne donne aucune zone en reçoit une au début de la journée : le sol simple jusqu'à trois pas de lui (`auto`, dessinée comme une baie ; « Zone d'attente automatique » dans l'éditeur, `autoZones: false` pour s'en passer). Au passage, un robot ne traverse plus la case d'un camion pour aller ailleurs (dans le petit entrepôt, le camion est dans un coin et servait de raccourci).

Ce que ça donne (10 journées, tours jusqu'à la dernière livraison, attentes des robots) :

| Plan | | la plus proche | la liste | la plus lointaine | recherche |
|---|---|---|---|---|---|
| deux couloirs | sans zone | 77,0 (75) | 68,0 (68) | 64,0 (68) | 64,0 (66) |
| | zone auto | 82,0 (4) | 69,0 (1) | **58,0** (1) | **58,2** (1) |
| petit entrepôt | sans zone | 46,0 (5) | 43,6 (0) | 43,2 (3) | **40,9** (4) |
| | zone auto | 43,0 (1) | 48,0 (2) | 56,4 (8) | 47,9 (1) |

- **Dans les couloirs**, les attentes disparaissent (66 → 1 avec la recherche) et la recherche finit 6 tours plus tôt : on ne se croise plus dans l'allée, on pose et on repart.
- **Dans le petit entrepôt**, personne ne faisait la queue au camion : le passage par la zone et par le chargeur coûte 7 tours à la recherche. La case à décocher est faite pour ça. Les tests qui jugent les règles et la recherche sur ce plan s'y font sans zone.


**Des blocages qui reviennent** (Sami, le même soir : à 100 %, l'allée ne s'est bloquée qu'une fois, en début de journée, puis plus rien). La journée tirait au plus **un** blocage, avec la probabilité « Blocage », à un tour au hasard. Maintenant l'allée se bloque encore et encore : `duration` tours à chaque fois, avec entre deux des moments libres tirés au hasard, de sorte qu'elle soit bloquée **une part donnée du temps** (« Allée bloquée (% du temps) » ; 100 % : toujours). Les robots ne voient toujours un blocage qu'à côté ; la recherche retire les blocages à venir dans chacun de ses mondes, celui qu'on a vu restant tel qu'on l'a vu.
- **Valeurs par défaut** : 15 % (petit entrepôt, plan de Sami, quais), 20 % (couloirs) ; 2 à 4 blocages par journée. L'ancienne valeur (0,2 à 0,5) voulait dire « une chance par jour » : les mêmes nombres seraient bien plus durs aujourd'hui. Le petit entrepôt dure 100 tours, les couloirs 120.
- **Deux erreurs que les blocages répétés ont fait sortir** : un robot se croyait arrivé dès qu'il passait sur sa case cible alors que son trajet continuait (il attendait d'y pouvoir rester) ; et, un blocage vu, seuls les robots qui avaient une cible replanifiaient : un robot sans cible gardait un trajet par l'allée bloquée, refusait d'y entrer, et un autre arrivait sur sa case.
- **À 80 %**, l'allée ne se rouvre qu'environ 2 tours entre deux blocages : dans le petit entrepôt, où elle est le seul détour autour d'une palette en attente, deux robots chargés y restent pris. À 50 %, toutes les journées finissent (testé).
- Une recherche de chemin vers une case que l'allée fermée rend inaccessible n'est plus tentée : une journée de recherche sur le plan de Sami 14,3 → 5,9 s, mêmes coups.


**Les réglages de Sami par défaut** (23/10, tard) : une allée bloquée 80 % du temps, 8 tours à chaque fois, et la recherche dans la page. Ce qu'il a fallu pour qu'aucune journée ne reste prise à 80 % :
- **un robot à côté de l'allée la voit se rouvrir** : à 80 %, elle ne se rouvre qu'environ 2 tours entre deux blocages, et les robots, la croyant fermée pour toute la durée supposée, ne profitaient jamais de ces moments ;
- **personne n'est enfermé, même allée bloquée** : la vérification avant de poser une palette ne compte plus l'allée `~` comme un passage (dans le petit entrepôt, deux robots chargés restaient pris dans le recoin (5,2)-(6,2), dont la seule autre sortie était l'allée) ;
- **des journées plus longues** : le petit entrepôt 160 tours, le plan de Sami 260 (au pire 143 et 220 à 80 %) ;
- en prenant une commande, un robot ne tente plus que les trois cases de ramassage les plus proches (mêmes coups mesurés, un peu plus vite).

La recherche y est plus lente (allée fermée presque tout le temps, beaucoup de chemins impossibles) : 13 à 16 s par journée sur le plan de Sami et les quais, 7 à 10 s au premier tour ; elle tourne dans un worker, la page répond.


## Les premières mesures de nuit (23/10 au soir, mcts-backlog)

100 journées par plan, l'allée bloquée 80 % du temps, 8 tours à chaque fois ; tours jusqu'à la dernière livraison (la plus proche / la liste / la plus lointaine / le camion d'abord / la recherche) : petit entrepôt 54,4 / 81,4 / 71,6 / 54,4 / **50,3** ; plan de Sami 121,2 / 146,1 / 136,7 / 121,2 / **95,2** ; trois quais 125,7 / 123,4 / 148,3 / 149,0 / **109,2** ; deux couloirs 97,8 / 73,7 / **59,7** / 97,8 / 60,0.
- **La recherche gagne nettement sur trois plans** : −26 tours sur la meilleure règle dans le plan de Sami, −14 aux trois quais, −4 dans le petit entrepôt ; dans les couloirs, elle fait comme la plus lointaine d'abord (60,0 contre 59,7).
- Ce n'était pas le cas au début de la journée (la liste battait souvent la recherche aux quais) : les zones, le chargeur par zone et l'allée qui se rouvre ont changé le problème.

## Les relais : un colis passé d'un robot à l'autre (23/10 au soir, Sami)

Deux robots coincés face à face : celui qui porte un colis ne passe pas, l'autre est entre lui et le camion. Sami : une case libre sert un moment de zone d'attente, et **le robot le plus proche du camion fait les allers-retours courts**.
- **Quand** : un robot chargé n'a pas trouvé de chemin depuis deux tours (ou attend son tour au camion alors que personne ne l'utilise), et un robot vide (qui va chercher, libre ou qui rentre) est plus près du camion que lui.
- **Comment** : le robot chargé va à la case libre juste devant l'autre (ou reste où il est s'ils se touchent), y pose le colis (un tour), et repart chercher ce que l'autre devait chercher. L'autre prend le colis et le porte au camion. Un relais que personne ne finit en 20 tours est annulé.
- **La case d'attente** est du sol ordinaire, jamais un quai, une zone d'attente du plan, une borne, ni la place où rentre un robot : un robot qui y rentrait s'asseyait sur le colis. La page la dessine en pointillés. `relay: false` dans le plan coupe les relais.

**Mesure** (40 journées par plan, la règle « la plus proche », dernière livraison au tour, sans relais → avec) :

| plan | sans relais | avec | relais par jour |
|---|---|---|---|
| petit entrepôt | 54,9 | 53,7 | 0,03 |
| plan de Sami | 123,6 | 123,3 | 0,13 |
| trois quais | 126,3 | **119,1** | 0,82 |
| deux couloirs | 97,4 | 97,4 | 0 |

- **Aux trois quais, −7 tours** : un relais par jour à peu près, sur presque toutes les journées (le dernier colis au tour 118 au lieu de 126-127).
- **Ailleurs, presque rien** : les chemins réservés dans l'espace et le temps évitent déjà les face-à-face. Dans le plan de Sami, les robots qui « cèdent le passage » sont surtout coincés dans un cul-de-sac pendant que l'allée `~` est fermée : aucun relais n'y peut rien.
- **Ce qui reste** : un robot dont la place de départ est dans le seul couloir (un plan d'une ligne, `A........T`) bloque encore tout le monde. C'est le choix des places, pas un relais. La recherche n'a pas encore été remesurée avec les relais : ce sera fait par les mesures de nuit.

## La page (23/10, tard)

**Les replays rangés seuls** (Sami, 23/10 au soir) : le commit de ce soir-là n'avait ajouté que la ligne `replays/` au `.gitignore` ; la page ne gardait rien. C'est fait le 26/10 (`src/replay.js`, l'onglet Replays) : chaque journée jouée jusqu'au bout se garde, avec son plan, sa graine et ses choix, dans le navigateur et par le serveur de la page (`POST /api/replays` de mcts-commun) dans `replays/`, hors de git ; rouverte, elle se rejoue coup pour coup, la recherche comprise (testé sur chaque plan et chaque règle).

**L'allure** (Sami, 23/10, tard) : la page prend l'allure commune des projets (`mcts-commun/web/theme.css`, dans l'esprit de Lopin) : un bandeau dans la couleur de l'application, les réglages en carte, les sections pliables bien visibles (une barre, un chevron qui tourne, « Ouvrir / Fermer »), les tableaux et le thème sombre. Ici, un bleu-gris métallique, industriel, avec de fines rayures, et 📦 devant le titre.

## Les commandes au fil de la journée (26/10, Sami)

Jusqu'ici, toutes les commandes étaient là au départ. Avec `arrivals` (`src/day-arrivals.js`, plan **« flux »**) :
- **les premières commandes de la liste sont connues au départ** (`known`), les suivantes arrivent l'une après l'autre,
  `every` tours d'écart en moyenne, tirés de la graine de la journée ; **aucune après l'heure limite** (`until`), pour que
  la dernière ait le temps d'être servie. La première version n'en avait pas : la dernière commande du jour 6 arrivait au
  tour 293 sur 300 ;
- **une commande pas encore arrivée est cachée** : aucune règle, aucun robot ne la voit ; la page la montre « pas encore
  arrivée », son bloc en « ? » ;
- **la recherche tire à nouveau, dans chacun de ses mondes, les commandes à venir** : quand elles arrivent, et de quel bloc
  chacune vient (son camion gardé). Jamais les vraies ;
- une journée avec arrivées mesure aussi **la réponse** : du moment où la commande arrive à sa livraison.

Le plan « flux » : le plan de Sami, 4 commandes au départ, puis une tous les 15 tours environ (une hypothèse), aucune
après le tour 200. Ce que ça donne (tour de la dernière livraison) :

| | la plus proche | la liste | la plus lointaine | le camion d'abord | recherche |
|---|---|---|---|---|---|
| 100 journées | 175,3 | 171,8 | 168,2 | 175,3 | — |
| 20 journées | 166,1 | 165,5 | 163,8 | 166,1 | **148,7** (+16,8 sur la liste : 3,7 à 29,9) |

- **Quand les commandes arrivent au fil de l'eau, les règles se valent** : sur 100 journées, aucune ne se détache de la
  liste (les intervalles contiennent 0).
- **La recherche finit environ 15 tours avant la meilleure règle** sur 20 journées. Elle sait qu'il viendra d'autres
  commandes, et où sont les robots quand elles arriveront. Les mesures de nuit (`night.json`, 100 journées) diront si
  l'écart tient.

## 90 secondes pour poser une palette dans le camion (26/10, Sami, le soir)

Les recherches du soir ([recherche/hypotheses.md](recherche/hypotheses.md), Q5) trouvent 43 à 86 s par palette pour
charger un camion au chariot ; le modèle comptait un tour, 5 s. Sami : prendre la valeur trouvée, avec un peu de marge,
en attendant un référent.
- **Un robot qui pose sa palette dans son camion y reste 18 tours (90 s)** (`WAREHOUSE.loadTurns`,
  `src/warehouse-hypotheses.js`). Poser sur une baie, ou sur un quai avant son camion, prend toujours un tour ; les bacs
  de la ligne aussi. `loadTurns: 1` rejoue les journées d'avant.
- **Les journées s'allongent**, pour que toutes les règles finissent : petit entrepôt 160 → 220 tours, plan de Sami
  260 → 420, trois quais 240 → 300, deux couloirs 120 → 280, flux 300 → 420.

Ce que ça change (100 journées, tour de la dernière livraison ; la plus proche / la liste / la plus lointaine / le
camion attendu d'abord) :

| Plan | avant (1 tour) | après (18 tours) |
|---|---|---|
| petit entrepôt | 53,9 / 66,9 / 71,6 / 53,9 | 143,5 / 149,2 / 162,6 / 143,5 |
| plan de Sami | 121,0 / 136,5 / 136,0 / 121,0 | 305,0 / 310,5 / 314,4 / 305,0 |
| trois quais | 119,0 / 123,4 / 163,7 / 146,3 | 175,4 / 198,8 / 204,3 / 193,8 |
| deux couloirs | 97,8 / 73,7 / 59,7 / 97,8 | 207,0 partout |
| flux | 175,3 / 171,8 / 168,2 / 175,3 | 310,3 / 313,3 / 316,6 / 310,3 |

- **C'est le chargement qui fait la journée** : un quai, un chargeur, 18 tours par palette. Sur le plan de Sami, les
  règles tiennent en 10 tours ; dans les couloirs, elles finissent toutes au même tour. Le choix des commandes ne
  compte plus que là où il y a plusieurs quais : sur les trois quais, la plus proche gagne 21 tours sur la liste.
- **Les relais disparaissent** : la file au camion règle le pas des robots, et plus personne ne reste coincé sur les
  trois quais. Le test des relais se joue avec `loadTurns: 1`.
- **Ce que la recherche gagne encore** : aux trois quais, 39,9 tours sur la liste (37,5 à 42,2), 18,7 sur la plus
  proche. Les autres plans n'ont pas fini : plus de 10 minutes par journée, et le modèle a changé avant (« Le chargeur
  au quai », plus bas). Les gains du tableau de la page (les nuits du 23/10) ont été mesurés avec un tour.
- Ce que ça ouvre : préparer les palettes sur la baie pendant que le chargeur charge, plusieurs chargeurs, ou un cariste
  qui charge pendant que les robots préparent.

## Le chargeur au quai : le robot pose en 5 s (26/10, Sami, la nuit)

Les recherches de la nuit ([recherche/hypotheses.md](recherche/hypotheses.md), Q5 et Q22) :
- **lever une palette prend quelques secondes.** Un transpalette électrique lève de 31 à 56 mm/s, et au quai le
  plancher de la remorque est à niveau ;
- **les 90 s sont celles d'un cariste** qui entre dans la remorque, la traverse et ressort. Un cariste et son chariot
  chargent environ 70 palettes à l'heure.

Le robot qui restait 90 s dans le camion bloquait donc le quai pour un travail qui n'est pas le sien. Sami choisit
l'option C : **le robot lève et pose en 5 s, un chargeur humain charge les camions**, l'un après l'autre. On ne met 2
ou 3 chargeurs que dans un grand entrepôt, quand autant de camions chargent ensemble.

**Le modèle** (`src/day-loaders.js`) :
- **le robot pose sa palette en un tour**, sur la baie du quai, ou à la porte d'un quai sans baie. Il n'entre plus
  jamais dans le camion ;
- **une baie pleine arrête les commandes de son camion** : c'est la place sur la voie de préparation ;
- **le chargeur** (`WAREHOUSE.dockLoaders`, 1 par défaut ; `dockLoaders` dans le plan) :
  - il met chaque palette dans le camion en 18 tours (90 s), celle la plus proche du camion d'abord ;
  - il reste à son camion tant qu'une palette l'y attend, puis passe au camion arrivé le premier qui a des palettes
    en attente, et que personne d'autre ne charge ;
  - il marche d'un quai à l'autre à une case par tour ;
  - il n'y a jamais deux chargeurs dans le même camion ;
- **il n'est pas sur la grille** : il ne gêne pas les robots. Le mettre sur la grille, au clavier, avec la prudence des
  robots autour de lui, viendra ensuite ;
- **`dockLoaders: 0` rend l'ancien modèle**, où le robot charge lui-même. Aux trois quais, il rejoue les journées de
  90 s au tour près ;
- **les mesures** : la part du temps où le chargeur charge (`loaderBusy`), ses tours de marche (`loaderWalk`), et le
  plus de palettes en attente à un quai (`laneMax`) ;
- **la page** : le chargeur 👷 dans le coin de son quai, plein quand il charge. Le titre du camion et la ligne d'état
  disent ce qu'il charge (« chargeur : camion 2, palette 1 / 4 »).

Ce que ça change (100 journées, tour de la dernière livraison ; la plus proche / la liste / la plus lointaine / le
camion attendu d'abord) :

| Plan | le robot charge en 90 s | un chargeur |
|---|---|---|
| petit entrepôt | 143,5 / 149,2 / 162,6 / 143,5 | 118,8 / 120,5 / 121,9 / 118,8 |
| plan de Sami | 305,0 / 310,5 / 314,4 / 305,0 | 251,4 / 234,9 / 240,8 / 251,4 |
| trois quais | 175,4 / 198,8 / 204,3 / 193,8 | 265,0 / 253,8 / 272,5 / 252,2 |
| trois quais, 2 chargeurs | | 172,8 / 185,6 / 167,5 / 161,8 |
| trois quais, 3 chargeurs | | 139,7 / 185,7 / 157,4 / 140,2 |
| deux couloirs | 207,0 partout | 155,0 / 155,0 / 157,0 / 155,0 |
| flux | 310,3 / 313,3 / 316,6 / 310,3 | 243,9 / 239,4 / 256,4 / 243,9 |
| assemblage | 271,8 / 324,4 / 303,1 / 271,8 | 259,4 / 261,0 / 259,7 / 259,4 |

- **Les journées raccourcissent de 50 à 70 tours** là où il n'y a qu'un camion. Le chargeur est occupé 80 à 90 % du
  temps : c'est lui le goulot, et il est humain.
- **Sur le plan de Sami, la liste devient la meilleure règle** : la plus proche finit 16,5 tours plus tard (10,3 à
  22,8). Elle amène les palettes dans un ordre qui fait attendre le chargeur.
- **Aux trois quais, un chargeur pour trois camions ne suffit pas** : les journées s'allongent de 55 à 90 tours. À
  2 chargeurs, on retrouve à peu près les journées d'avant. À 3, elles raccourcissent : la plus proche et le camion
  attendu d'abord finissent vers le tour 140. Leurs camions attendent 41 et 49 tours de moins que sous la liste. C'est
  ce que disait Sami : plusieurs chargeurs quand plusieurs camions chargent ensemble.
- **Le poste d'assemblage ne départage plus les règles** : le chargeur fixe le pas, et le spécialiste n'attend plus
  ses pièces assez longtemps pour que ça se voie.
- **Sur le flux, 3 journées sur 100 ne finissaient pas sous la plus lointaine d'abord** : des robots se cédaient le
  passage en boucle dans l'allée bloquée. Corrigé le 30/10 (« La nuit de référence du 30/10 », plus bas).
- **L'usine** ([modele-ligne.md](modele-ligne.md)) : le quai de la navette n'est plus un goulot.
- **La recherche coûte moins cher** : une journée du plan de Sami passe de plus de 10 minutes à 57 s. Aux trois quais
  avec un seul chargeur, c'est 292 s. Ses mesures sont plus bas.

**La recherche avec le chargeur** (la nuit du 26 au 27/10, la file de la machine, 100 journées par plan). L'écart
se compte par paires sur **la meilleure règle** du plan, mêmes journées ; aux trois quais, en tours à quai des camions
(ailleurs, un camion là dès le départ : le tour de fin) :

| Plan | la meilleure règle | recherche | gain sur elle (IC 95 %) | journées gagnées / perdues |
|---|---|---|---|---|
| petit entrepôt | la plus proche, 118,8 | 118,8 | 0 : elle joue la plus proche | — |
| plan de Sami | la liste, 234,9 | 229,2 | **5,7 (3,2 à 8,1)** | 99 / 1 |
| deux couloirs | la liste, 155,0 | 151,0 | **4,0 chaque journée** | 100 / 0 |
| flux | la liste, 239,4 | 239,0 | 0,4 (−4,3 à 5,0) | 17 / 29 |
| assemblage | la plus proche, 259,4 | 249,7 | **9,7 (4,7 à 14,6)** | 56 / 41 |
| trois quais, 1 chargeur | le camion d'abord, 477,8 | 428,9 | **48,9 (42,2 à 55,6)** ; fin 252,2 → 244,0 | 100 / 0 |
| trois quais, 2 chargeurs | la liste, 289,3 | 266,0 | **23,3 (22,1 à 24,5)** ; fin 185,6 → 155,4 | 100 / 0 |
| trois quais, 3 chargeurs | le camion d'abord, 240,6 | 236,3 | **4,3 (3,3 à 5,4)** ; fin 140,2 → 139,4 | 82 / 18 |

- **La recherche bat la meilleure règle sur 6 plans sur 8.** Elle n'apporte rien au flux, où les commandes arrivent
  au fil de la journée et où le chargeur fixe le pas. Dans le petit entrepôt, elle joue la plus proche.
- **Elle gagne le plus aux trois quais, quand les chargeurs manquent** : 49 tours à quai de moins avec 1 chargeur, 23
  avec 2, 4 avec 3. Elle amène les palettes dans l'ordre où le chargeur peut les prendre.
- **Elle occupe mieux le chargeur** : 94 % du temps sur le plan de Sami (92 % sous la liste), 88 % aux quais avec 1
  chargeur (85 % au mieux sous une règle), 69 % avec 2 (58 à 66 %).
- **Sur l'assemblage, elle départage ce que les règles ne départagent plus** : 9,7 tours en moyenne, mais 41 journées
  perdues sur 100. Le gain est net en moyenne, pas à chaque journée.
- **Son coût**, d'après la durée des jobs (les 4 règles et la recherche, par journée) : environ 6 s dans le petit
  entrepôt, 50 s à 1 min sur le plan de Sami, les couloirs et le flux, 1,5 min sur l'assemblage, 3,5 à 5 min aux
  trois quais.
- **L'usine** : la recherche n'y gagne rien non plus ([modele-ligne.md](modele-ligne.md)).

Deux défauts ressortis avec les poses plus rapides, corrigés :
- **un robot sans borne de recharge part d'une case qui ne coupe aucune allée quand le `~` est fermé.** Sur le petit
  entrepôt, un robot au repos chez lui tenait la seule entrée du bloc C, et l'autre lui cédait le passage jusqu'au soir ;
- **un robot chargé ne se range jamais sur une palette**, même posée pour un relais.

## Le poste d'assemblage (26/10, Sami, le soir)

Sami : l'assemblage, c'est un humain, un spécialiste. Ce peut être juste mettre plusieurs petits éléments dans un plus
grand colis, ou une tâche plus longue, du câblage, avec des composants que les robots stockent et transportent. Fini,
l'assemblage devient un colis que les robots portent au camion, ou au poste suivant.

`src/day-kits.js`, plan **« assemblage »** :
- **un poste `S` sur le plan** : les robots y posent les pièces, un à la fois, un tour chacune ; il a sa zone d'attente,
  comme un quai ;
- **un kit** (`setup.kits`) : ses pièces (chacune une commande vers le poste), le camion de son colis, la durée de son
  travail. Le kit commence quand toutes ses pièces sont là et que le spécialiste est libre, un kit à la fois ;
- **la durée du travail est cachée** jusqu'à la fin : elle est tirée entre deux bornes (un câblage de 5 à 15 minutes,
  une mise en colis de 1 à 3, des hypothèses : [recherche/hypotheses.md](recherche/hypotheses.md), Q19 et Q20). La
  recherche la retire au sort dans ses mondes ;
- **le colis assemblé** n'est visible d'aucune règle avant la fin du travail. Il se prend sur le poste et part au
  camion ;
- la page dessine le poste et son spécialiste, les pièces déjà là (« 1/2 ») et le kit en cours.

Le plan : celui de Sami, un poste sous la rangée du bas, 8 palettes et deux kits (I et J câblés, K et L mis en colis),
480 tours. Sur 100 journées (tour de la dernière livraison) : **la plus proche 271,8, la liste 324,4, la plus lointaine
303,1, le camion attendu d'abord 271,8**. La liste va chercher les palettes du camion avant les pièces des kits : le
spécialiste commence tard, et la journée finit 52,6 tours plus tard (44,9 à 60,3). Le camion attendu d'abord sert le
poste en premier (il est « là » dès le départ). Avec le chargeur au quai (plus haut), les règles se valent.

Pas encore fait : les robots qui ralentissent près du spécialiste, un spécialiste pour plusieurs postes, le contrôle
après assemblage (retouche, rebut), un colis qui part vers un autre poste plutôt qu'au camion.

## La nuit de référence du 30/10

Sami (30/10) : la mesure de nuit à refaire après deux changements, les commandes tirées chaque journée (29/10) et les
cinq défauts corrigés (30/10, [recherche/feuille-de-route.md](recherche/feuille-de-route.md)). Les 24 jobs de
`night.json` (`base-2026-10-30`), 100 journées par plan, ont tous fini. **Aucune commande non livrée**, sous aucune
règle ni sous la recherche. L'écart se compte par paires sur la meilleure règle du plan, mêmes journées ; aux trois
quais, en tours à quai des camions (ailleurs, le tour de fin) :

| Plan | la meilleure règle | recherche | gain sur elle (IC 95 %) | journées gagnées / perdues | le 26-27/10 |
|---|---|---|---|---|---|
| petit entrepôt | la plus proche, 119,0 | 118,8 | 0,1 (0,0 à 0,2) | 7 / 0 | 0 |
| plan de Sami | la plus lointaine, 235,1 | 230,8 | **4,4 (3,0 à 5,8)** | 96 / 2 | 5,7 |
| deux couloirs | la plus proche, 153,3 | 151,1 | **2,2 (1,8 à 2,6)** | 55 / 0 | 4,0 |
| flux | la plus lointaine, 236,8 | 232,7 | **4,1 (2,2 à 5,9)** | 61 / 12 | 0,4 |
| assemblage | la plus proche, 250,1 | 246,9 | 3,2 (−2,6 à 9,0) | 47 / 46 | 9,7 |
| trois quais, 1 chargeur | la liste, 480,8 | 430,2 | **50,7 (42,9 à 58,5)** ; fin 251,3 → 247,7 | 95 / 5 | 48,9 |

- **La recherche bat toujours la meilleure règle**, sauf à l'assemblage, où son gain n'est plus sûr, et au petit
  entrepôt, où elle joue la plus proche.
- **Elle gagne maintenant au flux** (4,1 tours, contre 0,4) : ses robots ne se cèdent plus le passage en boucle.
- **À l'assemblage, son gain n'est plus net** (3,2, contre 9,7 sur la liste fixe) : 47 journées gagnées, 46 perdues. Un budget plus grand y
  gagnait le 27/10 (128 itérations, 16,1 tours sur la liste fixe) : 128 et 256 itérations y sont remesurées sur 100
  journées tirées (`regle.json`, Sami, 30/10) : **ni l'un ni l'autre ne gagne** (128 : −0,5, de −3,5 à 2,5 ; 256 :
  0,9, de −2,1 à 3,9, en tours d'attente des camions), pour 2 et 3 fois le temps. Le budget reste à 64.
- **La meilleure règle change** : la plus lointaine sur le plan de Sami et le flux, la plus proche aux couloirs. Les
  règles ne s'écartent que de quelques tours ; aux trois quais, la liste et le camion d'abord finissent ensemble.
- **Le chargeur** est occupé 93 % du temps sous la recherche au plan de Sami (91,5 % sous la meilleure règle), 87 %
  aux quais (86 %).
- **Les jobs vont plus vite** : 6 min par tranche de 50 journées au plan de Sami et à l'assemblage, 10 à 12 min aux
  quais, pour 15 à 24 min estimées.

Le tableau de la page (onglet Stats) reprend ces mesures.

## La suite

Les étapes communes aux trois dépôts sont dans la [feuille de route](https://github.com/samiyc/lopin/blob/main/docs/ismcts-ailleurs/feuille-de-route.md) § 6 (Sami, 23/10 au soir) : l'ordonnanceur en commun pour les mesures de nuit, les replays avec un humain pour analyser les écarts, la vitrine. Le journal des versions est dans la page (`web/changelog.html`).

1. **Les mesures de nuit** — prêtes (23/10) : `night.json` à la racine du dépôt (écrit par `npm run night`, en tranches d'une demi-heure au plus depuis le 27/10), à ajouter à la file de la machine par `mcts-backlog --add-file` (mcts-commun), puis à lancer par `mcts-backlog` : la recherche contre les règles sur des centaines de journées, et ses réglages
   (budget, profondeur) à 80 % de blocage, où elle est la plus lente.
2. **Le transfert de colis entre deux robots bloqués** — fait le 23/10 au soir (« Les relais », plus haut) ; reste
   à placer les robots hors du seul couloir d'un plan.
3. **Un personnage au clavier** (Z Q S D et E, Sami) qui prend et pose des colis, comme le chef de la
   cuisine : **fait le 26/10 sur la ligne cadencée**, le cariste ([`docs/modele-ligne.md`](modele-ligne.md)), avec ses
   replays et leur analyse. Reste le cariste dans l'entrepôt.
4. **Une zone d'assemblage** (Sami, 26/10, précisée le soir) : un humain, un spécialiste, assemble au poste des
   composants que les robots vont chercher et lui apportent : plusieurs petits éléments dans un plus grand colis, ou un
   assemblage long (du câblage). Fini, l'assemblage devient un colis que les robots portent au camion ou au poste
   suivant. **Première version faite le 26/10** (« Le poste d'assemblage », plus haut).
5. **Des commandes qui arrivent pendant la journée** — fait le 26/10 (« Les commandes au fil de la journée », plus
   haut) ; l'entrepôt relié au supermarché de la ligne : **fait le 26/10**, l'usine
   ([`docs/modele-ligne.md`](modele-ligne.md)).
6. **Une variante de production** (Sami, 26/10) : la ligne cadencée d'abord, faite le 26/10, à côté de l'entrepôt
   ([`docs/modele-ligne.md`](modele-ligne.md)) ; l'atelier d'usinage, avec ses rejets et ses pannes, plus tard. Les
   recherches, le glossaire des termes réels et la feuille de route sont dans [`docs/recherche/`](recherche/README.md). L'outillage du dépôt
   (lint, types, empreintes, hook) est dans [`docs/outillage.md`](outillage.md).
