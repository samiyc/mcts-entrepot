# La feuille de route de la variante « atelier »

Sami (26/10/2026, `docs/prompt/recherche-glossaire-industrie.md`) : une variante avec une chaîne de production. La
contrainte y est moins le trajet et le temps à quai que **l'ordonnancement des tâches** et **la gestion des
ressources, du matériel spécialisé ou rare**, pour ne pas ralentir la chaîne quand une pièce est rejetée ou qu'une
machine-outil part en réparation.

Ses choix (26/10) :
- **les recherches et cette feuille de route d'abord** ;
- **rien n'est codé avant qu'il l'ait relue.**

**Ce qui guide toutes les étapes** :
- **l'atelier vient à côté de l'entrepôt, sans le remplacer**. `src/simulate.js` et ses modules `day-*`, les plans,
  les mesures, les replays et les empreintes ne bougent pas. L'atelier a ses propres modules, ses propres empreintes, sa
  propre comparaison, comme le parcours détaillé à côté de la garde simple dans mcts-urgences ;
- **ce qui décide est pur et testé**, sous le budget du lint ([../outillage.md](../outillage.md)) ;
- **tout est tiré d'une graine** et se rejoue ;
- **les règles simples d'abord** ; la recherche doit les battre par paires, avec un intervalle ;
- **les termes du glossaire** ([glossaire.md](glossaire.md)) nomment les choses, dans la page et les docs ;
- **les chiffres sans source sont des hypothèses**, rassemblées dans un module à part et réglables dans la page.

## Étape 1 : un atelier d'usinage (job shop)

**L'atelier.** Un plan en texte, comme ceux de l'entrepôt, avec une légende de plus :
- des **machines** (une lettre par type : tour, fraiseuse, centre 5 axes), chacune avec une case de chargement devant
  elle ;
- un **magasin** de bruts, d'où partent les pièces ;
- une **outillerie**, où les outils attendent, se mesurent et se réparent ;
- un **contrôle**, où l'on mesure les pièces ;
- une **expédition**, où sortent les pièces finies ;
- les robots (des AMR) et leurs bornes, sur la même grille.

**Les ordres de fabrication.** Chacun a :
- une **gamme** : une suite d'opérations, chacune sur un type de machine, avec un temps, parfois un outil spécial ;
- une **échéance** ;
- une **priorité**, l'AOG étant la plus haute.

Ils sont tous là au départ, comme les commandes de l'entrepôt ; leurs arrivées en cours de journée viendront à
l'étape 3.

**Les ressources rares** :
- les **machines**, une seule de certains types : c'est là que naît le goulot ;
- les **outils spéciaux**, un ou deux pour plusieurs machines. On les porte de l'outillerie à la machine, et on les
  rapporte ;
- le **poste de contrôle**, unique.

**Les robots portent** les bruts du magasin à la première machine, les pièces d'une machine à la suivante et au
contrôle, les outils, les pièces finies à l'expédition. Ils roulent sur les chemins réservés dans l'espace et le temps
de mcts-commun (`grid`), déjà éprouvés par l'entrepôt.

**Ce qui est caché**, tiré de la graine ([aleas-qualite.md](aleas-qualite.md)) :
- **le rejet** : chaque pièce contrôlée est bonne, à retoucher (un passage de plus sur sa dernière machine) ou au rebut
  (l'OF repart du début), selon des taux posés en hypothèses ;
- **la panne** : chaque machine tombe selon un MTBF, pour une durée tirée d'après un MTTR, et on ne connaît la durée
  qu'à la reprise ;
- **l'usure** : la vie d'un outil spécial est tirée autour de sa durée nominale. Usé, il part à l'outillerie, et sa
  machine attend.

**Ce qui se décide**, un étage au-dessus des chemins, comme dans l'entrepôt :
- quand une machine se libère : **quel OF elle prend** parmi ceux qui attendent devant elle ;
- quand un robot se libère : **quoi porter**, une pièce, un outil, un brut ;
- quand un outil spécial est libre : **à quelle machine il va**.

**Les règles simples d'abord** ([production.md](production.md)) :
- **FIFO** ;
- **SPT** : la plus courte opération ;
- **EDD** : l'échéance la plus proche ;
- **CR** : le ratio critique ;
- **le goulot d'abord** : servir d'abord ce qui attend devant la machine contrainte.

**La recherche** : `search` de mcts-commun, sur des mondes tirés comme aujourd'hui (`drawWorld`). Les rejets, les
pannes et les usures pas encore vus y sont retirés ; une panne en cours garde sa fin inconnue. On garde les mondes
communs et la notation par rapport à une règle.

**Les mesures** ([indicateurs.md](indicateurs.md)) :
- le makespan ;
- le retard total et le retard maximal ;
- l'en-cours maximal ;
- l'arrêt du goulot, par cause (panne, attente d'outil, attente de pièce) ;
- le FPY et les rebuts ;
- l'attente des outils rares.

**Les plans de départ** :
- un atelier de 4 machines et un outil spécial, 8 OF ;
- un atelier dont le goulot est une seule machine 5 axes ;
- un atelier où deux machines se partagent un outil long.

**Fait quand** :
- les règles se comparent par paires sur les mêmes journées (`npm run atelier`) ;
- une empreinte couvre l'atelier ;
- la page montre un atelier, et la recherche y joue dans un worker ;
- `docs/modele-atelier.md` donne les premiers chiffres.

## Étape 2 : la recherche contre la meilleure règle

On mesure, par paires, sur des centaines de journées (`night.json`, mcts-backlog) :
- la recherche contre chaque règle ;
- sous plusieurs niveaux d'aléas : un rejet de 2, 5 et 10 % ; des pannes rares ou fréquentes.

**L'hypothèse à vérifier** : la recherche gagne surtout quand les aléas touchent le goulot, et quand un outil rare est
partagé. C'est là qu'une règle locale ne voit pas ce qu'elle affame plus loin.

## Étapes suivantes (esquissées)

3. **Des OF qui arrivent en cours de journée**, avec leurs échéances, et un AOG de temps en temps.
4. **Le régleur au clavier** ([homme-robot.md](homme-robot.md)) : l'humain monte les outils, répare, décide du sort
   d'une pièce rejetée ; la machine ordonnance le reste. Un régleur au hasard pour mesurer, puis le replay de sa
   journée.
5. **La maintenance préventive** : arrêter une machine avant la panne coûte moins qu'une panne. Une décision de plus
   pour la recherche : quand.
6. **Les changements de série** (SMED) : un temps de réglage qui dépend de l'OF précédent. Grouper les OF semblables
   devient une décision.
7. **Une ligne cadencée** ([autres-variantes.md](autres-variantes.md)) : l'entrepôt alimente des postes au takt.

## Les choix à faire (Sami)

- **L'atelier d'usinage d'abord, ou la ligne cadencée comme marchepied ?** La ligne cadencée garde tout l'entrepôt ; elle
  remplace le camion par des postes qui s'arrêtent s'il leur manque une pièce. L'atelier d'usinage est plus loin, mais
  c'est lui qui a les rejets, les pannes et les outils rares des notes.
- **Les robots dans l'atelier : utiles dès l'étape 1, ou plus tard ?** On pourrait commencer par l'ordonnancement seul,
  les transports instantanés, pour isoler ce que la recherche gagne sur l'ordonnancement. Les robots viendraient
  ensuite, mesurés à part.
- **Dans quel dépôt ?** Dans `mcts-entrepot`, à côté de l'entrepôt, comme le prévoit cette feuille de route. Ou bien un
  dépôt `mcts-atelier` à part, si l'atelier grandit au point de ne plus partager que mcts-commun.
- **Les hypothèses chiffrées** : taux de rejet, MTBF, MTTR, durées d'opérations. Faut-il les tirer de vraies données
  (Airbus, WMG), ou rester sur des ordres de grandeur réglables ?
