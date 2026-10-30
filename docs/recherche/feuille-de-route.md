# La feuille de route : la ligne cadencée, puis l'atelier

Sami (26/10/2026, `docs/prompt/recherche-glossaire-industrie.md`) : une variante avec une chaîne de production. La
contrainte y est moins le trajet et le temps à quai que **l'ordonnancement des tâches** et **les ressources rares**.

## Les choix de Sami (26/10)

- **La ligne cadencée d'abord.** Elle garde tout l'entrepôt : le magasin devient le supermarché, les camions deviennent
  les postes de la ligne. L'atelier d'usinage reste **à faire**, plus bas.
- **Les robots servent dès l'étape 1**, un bac par trajet.
- **Dans mcts-entrepot**, dans une page à onglets, la mise en page de lopin et de mcts-urgences : Entrepôt, Ligne
  cadencée, Comparaisons, Replays, Stats.
- **Des vraies données pour commencer** : une ligne automobile, d'après Toyota ([ligne-cadencee.md](ligne-cadencee.md)).

**Ce qui guide toutes les étapes** :
- **la ligne vient à côté de l'entrepôt, sans le remplacer.** L'entrepôt, ses plans, ses mesures, ses replays et ses
  empreintes ne bougent pas ; la ligne a ses modules (`src/line-*.js`), son empreinte et sa comparaison ;
- **ce qui décide est pur et testé**, sous le budget du lint ([../outillage.md](../outillage.md)) ;
- **tout est tiré d'une graine** et se rejoue ;
- **les règles simples d'abord** ; la recherche doit les battre par paires, avec un intervalle ;
- **les termes du glossaire** ([glossaire.md](glossaire.md)) nomment les choses ;
- **les chiffres sans source sont des hypothèses**, rassemblées dans `src/line-hypotheses.js`.

## La page à onglets (faite le 26/10)

- **Entrepôt** : la simulation d'avant, à l'identique ;
- **Comparaisons** : les règles et la recherche sur les mêmes journées ;
- **Replays** : chaque journée jouée jusqu'au bout se garde et se rejoue coup pour coup (`src/replay.js`), dans le
  navigateur et dans `replays/` ;
- **Stats** : les mesures de nuit, et la dernière comparaison journée par journée.

L'onglet **Ligne cadencée** vient avec l'étape 1.

Le 29/10, Sami trouvait les trois onglets de simulation trop semblables. Depuis :
- chaque onglet dit en haut ce qu'il montre, ce qu'il mesure et combien de temps il joue ;
- les plans sont groupés dans le menu (`web/menus.js`), sous un nom court, et le nom complet s'écrit sous le menu ;
- une légende accompagne chaque plan (`web/legend.js`) ;
- le supermarché de la ligne a sa propre couleur, distincte des rayons de l'entrepôt ;
- les véhicules avancent sur une bande sous les postes, d'un poste à chaque takt, et attendent quand la ligne s'arrête ;
- l'Usine se lit dans le sens des palettes : l'entrepôt, puis la navette, puis le supermarché et la ligne ;
- les variantes de la ligne de Sami sont devenues des réglages du panneau (`web/line-options.js`), car « commandé à
  l'entrepôt » et « servi par 3 préparateurs » semblaient identiques à l'écran. Les plans nommés restent pour les
  mesures de nuit, et un test vérifie que chacun se retrouve par ces réglages ;
- ce qui attend se voit : les bacs du supermarché, ses commandes à l'entrepôt et leur état, les bacs demandés à chaque
  poste.

## Étape 1 : la ligne cadencée, mono-modèle (faite le 26/10)

Les chiffres sont dans [../modele-ligne.md](../modele-ligne.md). En bref :
- une ligne bien servie ne s'arrête presque pas ;
- quand un seul robot sert cinq postes, la plus proche d'abord arrête deux fois moins la ligne que le kanban ;
- la recherche n'a de prise que quand le robot manque.

Les plans de départ ont changé en route : 1 robot pour la petite ligne, 2 pour celle de Sami, un plan « seul » à un
robot, 2 pour le bord étroit. Avec plus de robots, aucune ligne ne s'arrêtait.

**Le plan**, un texte comme ceux de l'entrepôt, avec deux signes de plus :
- `P` : un poste de la ligne, dans l'ordre de lecture ;
- `b` : un emplacement de bac au bord de ligne, rattaché au poste le plus proche.

Les blocs `A`…`L` sont les références du supermarché ; `~`, `c` et `#` gardent leur sens. Le plan dit quelles
références consomme chaque poste.

**Le tour** ([ligne-cadencee.md](ligne-cadencee.md) pour les chiffres) :
- **au takt** (11 tours, soit 55 s), chaque poste prend une pièce de chacune de ses références ;
- **s'il en manque une, toute la ligne s'arrête** : le takt est retenu jusqu'à ce qu'elle arrive ;
- **un bac vide** (12 pièces) crée une demande ; le second bac de la référence couvre 11 minutes ;
- **un robot libre choisit la demande qu'il sert** : il prend un bac plein au bloc de la référence et le pose sur un
  emplacement libre du bord de ligne du poste. C'est le choix de l'entrepôt (`day-choice.js`), où la demande remplace
  la commande ;
- les chemins réservés, l'allée qui se bloque, céder le passage : **ceux de l'entrepôt**.

**Ce qui est caché** :
- l'allée `~` ;
- **une rupture fournisseur** : une référence manque au supermarché pendant 5 à 15 minutes (une hypothèse), et on ne
  le voit qu'en arrivant au bloc.

**Les règles simples** :
- le kanban dans l'ordre : les bacs vides dans l'ordre où ils se sont vidés ;
- **la couverture la plus courte** : le stock au bord de ligne sur la consommation, l'EDD des logisticiens ;
- **le plus proche**.

**La recherche** : celle de l'entrepôt, dans des mondes où l'allée et les ruptures sont retirées au sort. Son coût est
l'arrêt de la ligne.

**Les mesures** :
- **l'arrêt de la ligne**, en secondes : la mesure principale ;
- les véhicules sortis ;
- l'arrêt par poste et par référence, et le plus long ;
- l'en-cours maximal au bord de ligne ;
- les trajets et les attentes des robots.

**Les plans de départ** :
- une petite ligne : 3 postes, 6 références, 2 robots ;
- une ligne de Sami : 5 postes, 12 références, 4 robots, une allée `~` ;
- une ligne au bord étroit : un seul bac par référence.

**Fait quand** :
- `npm run line` compare les règles et la recherche par paires ;
- une empreinte `line` est posée ;
- l'onglet Ligne cadencée joue une journée ;
- les comparaisons, les replays et les stats reçoivent la ligne ;
- `docs/modele-ligne.md` donne les premiers chiffres.

## Étape 2 : la ligne plus vraie (faite le 26/10)

Chaque point est une option du plan ; les plans de l'étape 1 jouent coup pour coup comme avant
([../modele-ligne.md](../modele-ligne.md)).
- **Les bacs vides repartent** (fait, plan `retours`) : à chaque poste, le robot reprend les vides qui attendent, puis
  les pose sur une étagère de retour `r`.
- **Plusieurs bacs par trajet** (fait, plan `tournee`) : tant qu'il lui reste de la place au supermarché, le robot se
  voit proposer une autre demande ; il livre au poste le plus proche d'abord. Le choix des bacs qui complètent une
  tournée est une décision pour la recherche.
- **Le mélange de modèles** (fait, plan `melange`) : essence et hybride, chacun sans les pièces de l'autre. Les robots
  connaissent les 20 véhicules à venir ; la recherche tire les suivants.
- **Le supermarché réapprovisionné depuis l'entrepôt** (fait le soir, plan `supermarche`) : un stock fini par
  référence, vu de tous ; sous le seuil, une commande à l'entrepôt, de retour après un délai inconnu. L'entrepôt n'est
  pas encore joué : son délai est tiré. Le jouer vraiment relierait les deux simulations.

## Étape 3 : l'humain au clavier (faite le 26/10)

Le cariste (Z Q S D et E) prend un bac à côté d'un bloc et le pose devant son poste. La machine
ordonnance le reste ([homme-robot.md](homme-robot.md)). Il tient sa case, et les robots replanifient autour de lui.
Ses actions sont gardées dans le replay. Pour mesurer sans personne au clavier, deux caristes simulés : un qui aide
(la couverture la plus courte d'abord), un au hasard (`scripts/line-drivers.js`).

Fait le soir :
- **le replay d'analyse** : une heure jouée avec le cariste, contre la même heure sans lui, minute par minute (onglet
  Replays, « Analyser ») ;
- **la zone de prudence** : un robot à côté du cariste avance à demi-vitesse.

## Les suites (26/10, la nuit)

Fait :
- **le seuil de commande comme décision** (`supermarket.policy` : un seuil fixe, ou la couverture du délai attendu) ;
- **l'entrepôt comme une file de préparateurs** (`supermarket.warehouse`, plan `file`) : un pas vers l'entrepôt joué ;
- **une recherche plus calme** (`calm`), en option.

Les chiffres sont dans [../modele-ligne.md](../modele-ligne.md).

Reste :
- ~~la règle de jeu de la recherche~~ : **la couverture par défaut depuis le 30/10** (Sami), sa mesure de confirmation
  dans la file (`regle.json`) : confirmée, 40,2 tours d'arrêt de moins par heure aux bacs vides, 22,8 aux tournées, 1,7 de
  plus au supermarché ([../modele-ligne.md](../modele-ligne.md)). La campagne `night-rollout.json`, faite le 27/10 sur 100 heures, donnait la
  couverture devant la plus proche sur les quatre lignes où le robot manque, et nulle part derrière
  ([../modele-ligne.md](../modele-ligne.md)). La nuit du 30/10 le montrait encore aux bacs vides, où la recherche, jouée par la plus proche, perdait 38,7 tours
  contre le kanban ;
- ~~l'arrêt anticipé, `calm`, plus d'itérations~~ : **mesurés la nuit du 27/10** (119 jobs, par paires,
  [../modele-ligne.md](../modele-ligne.md)). L'arrêt anticipé est adopté dans les trois recherches : les mêmes résultats
  partout, jusqu'à un tiers de temps en moins. `calm` est adopté sur la ligne : aucune ligne n'y perd, et la recherche
  y coûte de 27 à 93 % de moins. 128 itérations ne sont pas adoptées : elles gagnent à l'assemblage et perdent chaque
  journée du plan de Sami. Reste à comprendre pourquoi chercher plus y joue moins bien (le score), et à décider d'un
  budget propre à l'assemblage : remesurés sur des journées tirées le 30/10 (`regle.json`), 128 et 256 itérations
  n'y gagnent plus rien, le budget reste à 64 ;
- **les lenteurs des journées complètes** (28/10, [../outillage.md](../outillage.md)) : un filtre avant A* écarte les
  chemins que des robots garés pour de bon rendent impossibles. Il ne change aucun résultat, et le temps d'A* baisse de
  7 à 16 %. Les vérifications de baie se font en un seul passage, jusqu'à 7 % de temps en moins. L'horizon des
  chemins des mondes de la recherche (`legHorizon`) est mesuré par paires dans la file (`horizon.json`), les lenteurs
  d'A* sont signalées à `mcts-commun`, et les nouveaux coûts des jobs, mesurés, sont adoptés. Le soir, la nouvelle lib
  (A* deux fois plus rapide chez nous) et Node 24 : le filtre ne rapporte plus et il est retiré, `copy` et `direct`
  sont essayés sans gain qui vaille. `legHorizon` à 40 tours donne les mêmes journées, pour 1 à 4 % de temps en
  moins : ses 50 jobs sont annulés (Sami, 28/10), l'option reste éteinte par défaut ;
- **le palier de réglages** (28/10 au soir, [../outillage.md](../outillage.md)) : un budget ×4, 8 coups à la racine,
  une profondeur de 3, et tout ensemble, mesurés par paires contre la recherche d'aujourd'hui. Aucune variante ne
  gagne partout, donc rien ne change par défaut. La profondeur 3 gagne aux quais, et le budget ×4 à l'assemblage. Rien
  n'est prouvé sur les lignes ni à l'usine. Sur le plan de Sami, toutes les variantes perdent, mais c'est une seule
  situation répétée chaque jour. Restent une journée à rejouer, et une confirmation sur des journées plus variées ;
- ~~relier l'entrepôt au supermarché~~ : **fait le 26/10**, l'usine (`src/plant.js`, onglet Usine,
  [../modele-ligne.md](../modele-ligne.md)). Il en reste les replays de l'usine ;
- ~~une recherche d'entrepôt qui connaît l'état de la ligne~~ : **faite le 26/10** (`src/plant-search.js`), avec la
  navette à heure fixe (plan `train`). Elle joue exactement l'ordre des commandes : un seul choix d'entrepôt ne déplace
  pas l'arrêt de la ligne ([../modele-ligne.md](../modele-ligne.md)). Sur 100 heures, elle ne gagne rien, à 90 s au
  quai (−0,3) comme avec le chargeur (0,4, dans l'intervalle) ;
- **les chiffres à confirmer sur le terrain** : [hypotheses.md](hypotheses.md), et ses questions. Trois valeurs
  trouvées en ligne sont appliquées depuis le 26/10 au soir (Sami), en attendant un référent : 90 s pour charger une
  palette, 80 % d'hybrides, la séquence prévue avec quelques véhicules déplacés ;
- ~~le robot qui charge lui-même le camion~~ : **un chargeur au quai fait la nuit du 26/10** (`src/day-loaders.js`,
  [../modele.md](../modele.md)) : le robot pose en 5 s, le chargeur charge à 90 s, un camion après l'autre. Il en reste :
  le chargeur sur la grille et au clavier, la prudence des robots près de lui, l'ordre de chargement à l'envers d'une
  tournée à plusieurs arrêts, le changement de camion à quai. Les robots qui se cédaient le passage en boucle (3 journées sur 100 du flux, sous
  la plus lointaine) ne le font plus depuis le 30/10 ;
- ~~la zone d'assemblage~~ : **un poste d'assemblage fait le 26/10** (`src/day-kits.js`, [../modele.md](../modele.md)) :
  un spécialiste, des pièces apportées par les robots, un travail de durée cachée, un colis qui part au camion. Il en
  reste : la prudence des robots près du spécialiste, un spécialiste pour plusieurs postes, le contrôle après
  assemblage, un colis qui va vers un autre poste ;
- ~~des commandes différentes chaque jour~~ : **faites le 29/10** (Sami) : chaque commande de la journée est tirée parmi
  les blocs de la liste du plan, chaque camion garde son nombre de commandes ; les blocages restent ceux d'avant
  (`drawOrders` dans `src/simulate.js`). La variété a fait sortir des défauts qui étaient déjà là : de 0 à 5 journées
  sur 100, par plan et par règle, finissaient avec une commande non livrée. **Corrigés le 30/10** (Sami), cinq causes,
  une journée de test chacune (`tests/defects.test.js`) :
  - **le robot de la borne (0,2)** (plan de Sami, flux) : il cédait le passage sur le chemin de sa borne, recevait une
    commande pendant ce temps, puis, à la case de prise, repartait vers sa borne et y « prenait » la commande. Un robot
    qui reçoit une commande oublie le but qu'il avait laissé pour céder le passage ;
  - **une case de prise sur l'allée fermée** (quais) : le robot l'attendait toute la journée en cédant le passage à
    personne. Retenu, il essaie maintenant les autres cases de prise de son bloc ;
  - **un relais annulé pendant que la palette est posée** (quais) : le preneur prenait la palette et laissait sa propre
    commande à personne. Un relais n'est plus annulé à ce moment-là ;
  - **le chargeur du poste d'assemblage enfermé** : il partait chercher une pièce pendant que deux autres arrivaient
    devant le poste ; posées, elles lui fermaient le retour. Il attend maintenant aussi les pièces en route vers sa zone ;
  - **deux robots chargés nez à nez à la porte du poste** : celui qui devait céder le passage n'avait aucune case libre,
    et l'autre n'était jamais sollicité. Le suivant cède maintenant quand le premier ne peut pas.

  Sur 400 journées de chaque plan, avec les quatre règles, plus aucune commande non livrée, et **le plan d'assemblage
  tire ses commandes** comme les autres. La ligne cadencée, qui partage la relance des robots, perd moins de tours
  (de 0 à 12 tours d'arrêt en moins par heure selon la ligne et la règle, sur 50 heures). **Les relais** ne servent
  plus guère que dans les couloirs (14 à 29 tours gagnés par journée, sur 100) : ailleurs, les robots qu'ils
  débloquaient attendaient surtout une case de prise sur l'allée fermée. Leur test passe des quais aux couloirs.
- ~~la mesure de nuit à refaire~~ : **faite le 30/10** (`base-2026-10-30`, 24 jobs) : aucune commande non livrée ; la
  recherche bat la meilleure règle partout sauf à l'assemblage, où son gain n'est plus sûr, et gagne maintenant au flux
  et sur la ligne à un robot ([../modele.md](../modele.md), [../modele-ligne.md](../modele-ligne.md)).

## À faire : l'atelier d'usinage (job shop)

Gardé pour plus tard (Sami, 26/10). Ce qu'il apporterait ([production.md](production.md),
[aleas-qualite.md](aleas-qualite.md)) :
- **des OF avec leur gamme**, des machines rares (le goulot), des outils spéciaux partagés que les robots portent de
  l'outillerie aux machines ;
- **des aléas cachés** :
  - le rejet au contrôle, avec retouche ou rebut ;
  - la panne, selon un MTBF et un MTTR ;
  - l'usure d'un outil ;
- **les règles FIFO, SPT, EDD, CR et le goulot d'abord** ; la recherche décide quel OF prend une machine qui se libère,
  ce que porte un robot, où va un outil ;
- **les mesures** :
  - le makespan ;
  - le retard maximal ;
  - l'en-cours maximal ;
  - l'arrêt du goulot, par cause ;
  - le FPY et les rebuts.

Et après lui : la maintenance préventive (quand arrêter une machine), les changements de série (SMED, grouper les OF
semblables).
