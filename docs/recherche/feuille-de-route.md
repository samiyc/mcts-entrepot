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

Le cariste (Z Q S D ou les flèches, et E) prend un bac à côté d'un bloc et le pose devant son poste. La machine
ordonnance le reste ([homme-robot.md](homme-robot.md)). Il tient sa case, et les robots replanifient autour de lui.
Ses actions sont gardées dans le replay. Pour mesurer sans personne au clavier, deux caristes simulés : un qui aide
(la couverture la plus courte d'abord), un au hasard (`scripts/line-drivers.js`).

Fait le soir :
- **le replay d'analyse** : une heure jouée avec le cariste, contre la même heure sans lui, minute par minute (onglet
  Replays, « Analyser ») ;
- **la zone de prudence** : un robot à côté du cariste avance à demi-vitesse.

## Les suites possibles

- Le seuil de commande et la taille du stock du supermarché comme décisions : c'est là que se joue l'arrêt quand le
  stock est juste.
- L'entrepôt joué vraiment pour réapprovisionner le supermarché (les deux simulations reliées).
- La recherche plus rapide sur les lignes à deux robots (27 s par heure).
- La règle de jeu de la recherche : la couverture plutôt que la plus proche (campagne `night-rollout.json` en cours).

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
