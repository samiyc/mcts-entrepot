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

## La suite

Les étapes communes aux trois dépôts sont dans la [feuille de route](https://github.com/samiyc/lopin/blob/main/docs/ismcts-ailleurs/feuille-de-route.md) § 6 (Sami, 23/10 au soir) : l'ordonnanceur en commun pour les mesures de nuit, les replays avec un humain pour analyser les écarts, la vitrine. Le journal des versions est dans la page (`web/changelog.html`).

1. **Les mesures de nuit** — prêtes (23/10) : `night.json` à la racine du dépôt, à ajouter à la file de la machine par `mcts-backlog --add-file` (mcts-commun), puis à lancer par `mcts-backlog` ; : la recherche contre les règles sur des centaines de journées, et ses réglages
   (budget, profondeur) à 80 % de blocage, où elle est la plus lente.
2. **Le transfert de colis entre deux robots bloqués** (Sami) : dans une allée étroite, une case libre sert
   un moment de zone d'attente ; le robot le plus proche du camion fait des allers-retours très courts, les
   autres repartent au fond chercher les colis suivants.
3. **Un personnage au clavier** (Z Q S D et E, Sami) qui prend et pose des colis, comme le chef de la
   cuisine ; puis les replays de ses journées, comparées à la recherche.
4. **Une zone d'assemblage** (Sami, à préciser) : une commande de plusieurs colis, réunis sur une zone avant
   de partir au camion.
5. **Des commandes qui arrivent pendant la journée**, avec des échéances.
