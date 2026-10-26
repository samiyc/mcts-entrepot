# Les recherches sur l'entrepôt et l'atelier

Sami (26/10/2026, `docs/prompt/recherche-glossaire-industrie.md`) : le projet est tourné vers l'entrepôt de stockage
et de distribution (Ulog, visité ; Amazon). Il veut y ajouter des variantes de production : une chaîne d'assemblage, un
atelier d'usinage (Airbus, visité ; Intel ; Haimer ; le WMG de Warwick). Là, la contrainte est l'ordonnancement des
tâches et les ressources rares, quand une pièce est rejetée ou qu'une machine casse. Il demande aussi un glossaire de
termes réels, pour rapprocher la simulation des contraintes et des mesures réelles.

Ce dossier rassemble ce que disent les sources publiées, et ce que le simulateur en reprend. À lire dans cet ordre :
1. [glossaire.md](glossaire.md) : les termes, et leur nom dans le code quand le modèle a déjà la chose ;
2. [logistique.md](logistique.md) : ce que mesurent les entrepôts, face à ce que mesure le modèle, et ses écarts ;
3. [production.md](production.md) : l'atelier, la ligne, la fab, l'ordonnancement et le goulot ;
4. [aleas-qualite.md](aleas-qualite.md) : les rejets, les pannes, les outils, et comment chacun devient un événement
   caché ;
5. [homme-robot.md](homme-robot.md) : les normes, les accidents, les engorgements, et le personnage au clavier ;
6. [indicateurs.md](indicateurs.md) : ce que l'on mesure, et les maxima à ajouter ;
7. [autres-variantes.md](autres-variantes.md) : la réponse à « Autre variantes ? » ;
8. [feuille-de-route.md](feuille-de-route.md) : les étapes de la variante « atelier », et les choix qui reviennent à
   Sami.

Un chiffre cité a sa source dans le fichier qui le donne. Beaucoup de sources sont des pages de vendeurs ou de
conseil ; le texte le dit quand c'est le cas. Un chiffre sans source est écrit comme une hypothèse : rien n'est encore
codé (la feuille de route attend la relecture de Sami).

L'outillage du dépôt, repris de lopin et de mcts-urgences le même jour, est dans [../outillage.md](../outillage.md).
