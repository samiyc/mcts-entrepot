# La production : l'atelier, la ligne, la fab

Sami (26/10/2026) : une ou plusieurs variantes avec des chaînes de production. Ce qui compte n'y est plus le trajet ni
le temps à quai, mais **l'ordonnancement des tâches** et **les ressources rares** : une machine, un outil, une
personne qualifiée. Exemples de Sami : Airbus (visité), Intel, Haimer, le WMG de Warwick. Les termes sont dans
[glossaire.md](glossaire.md).

## Trois formes d'atelier

| Forme | Ce qui circule | Ce qui est rare | Exemple |
|---|---|---|---|
| **Atelier d'usinage** (*job shop*) | des OF, chacun avec sa gamme, d'une machine à l'autre | les machines (un centre 5 axes), les outils, les régleurs | un atelier de pièces aéronautiques, Haimer et ses clients |
| **Ligne d'assemblage** (*flow shop*, ligne cadencée) | un produit qui avance de poste en poste au takt | les postes, les compagnons qualifiés, les pièces qui manquent | la ligne d'assemblage final de l'A320 |
| **Fab de semi-conducteurs** (*re-entrant*) | des lots de plaquettes qui repassent des dizaines de fois par les mêmes machines | la photolithographie, les fours, les implanteurs | Intel |

## L'ordonnancement d'atelier

- **Le problème est dur** : ordonnancer plusieurs machines est en général NP-difficile, d'où les heuristiques.
- **Les règles de priorité**, choisies quand une machine se libère, comme un robot libre dans le modèle :
  - **FIFO** : le premier arrivé ;
  - **SPT** : le plus court d'abord. Il minimise le temps de séjour total ;
  - **EDD** : l'échéance la plus proche d'abord. Il minimise le retard maximal ;
  - **CR** : le ratio critique, le temps qui reste avant l'échéance sur le travail qui reste. Il s'adapte à mesure que
    l'échéance approche, et marche bien sur les retards pondérés ;
  - **le goulot d'abord** : servir d'abord ce qui attend devant la contrainte.
- **Aucune règle ne domine partout.** EDD gagne sur le retard maximal, SPT sur le temps de séjour ; le résultat dépend
  des parcours, de la charge et de la tension des échéances. Une étude de cas donne un makespan de 210 jours sous EDD et
  de 222 sous CR, mais c'est un seul atelier.
- **Les hybrides** (SPT combiné à CR, ou au marge par travail restant) sont simples à mettre en œuvre et se règlent
  pour le retard pondéré.

C'est la situation qu'a déjà trouvée l'entrepôt : « la plus proche » perdait contre « la liste » sur certains plans,
« la plus lointaine » (LPT) gagnait ailleurs. **Une recherche qui regarde plusieurs affectations à l'avance doit battre
la meilleure règle sur chaque plan, par paires** : c'est la règle de CLAUDE.md, et elle vaut ici aussi.

## Le goulot, la théorie des contraintes

Goldratt (*Le But*) : la contrainte fixe le débit de tout le système. Ses cinq étapes :
1. **identifier** la contrainte ;
2. **l'exploiter** : qu'elle ne s'arrête jamais faute de travail ;
3. **subordonner** le reste à son rythme, sans fabriquer d'en-cours inutile ;
4. **l'élever** : ajouter de la capacité, en dernier ;
5. **recommencer** : le goulot s'est déplacé.

Le **tambour-tampon-corde** (DBR) en fait un ordonnancement. Le goulot donne le rythme ; un stock tampon devant lui le
protège des aléas ; la corde ne lâche de pièces dans l'atelier qu'à son rythme.

Pour le modèle, c'est la mesure à suivre : **une minute perdue au goulot est une minute perdue pour tout l'atelier**.
Une panne d'une machine qui n'est pas le goulot coûte peu, tant que le tampon tient.

## L'usinage : les outils

- **Un outil s'use** et se change après une durée de coupe. Son changement arrête la broche, sauf s'il est préparé
  d'avance.
- **Le préréglage hors machine** fait passer un changement d'outil (une barre d'alésage) de 15 minutes à moins d'une,
  selon des articles de presse spécialisée. Tant que la machine sert à mesurer ses outils et à couper des pièces
  d'essai, elle ne produit pas.
- **Le frettage** (*shrink fit*, le métier d'Haimer) tient l'outil à quelques microns. L'équilibrage des porte-outils
  allonge la vie des outils au-delà de 8 000 tr/min.
- **L'outillerie** prépare les outils, les mesure et en garde l'historique ; elle repère l'outil usé avant qu'il fasse
  une mauvaise pièce.
- **Le changement de série** se réduit par le SMED : séparer ce qui demande la machine arrêtée de ce qui peut se faire
  pendant qu'elle tourne. Chez Toyota, un changement de presse serait passé de quatre heures à trois minutes en 1969 ;
  ce chiffre vient d'un vendeur et n'est pas vérifié.

**Pour le modèle** : les outils rares (un porte-outil spécial, un outil long) sont **une ressource partagée entre
machines**, que l'on porte de l'outillerie au poste. C'est là que les robots du modèle actuel reprennent du sens : ils
transportent des outils, des bruts, des pièces finies entre l'outillerie, le magasin et les machines.

## L'assemblage aéronautique

- **La cadence** : Airbus vise 70 à 75 A320 par mois fin 2027, avant de se stabiliser à 75. La cadence était de 42 par
  mois en 2014 et de 60 en 2019. Le frein cité est le manque de moteurs (CFM, Pratt & Whitney).
- **Les lignes** : dix lignes d'assemblage final, à Hambourg (4), Mobile (2), Tianjin (2) et Toulouse (2).
- **La deuxième ligne de Toulouse** (fin 2022) a un pilotage numérique sur tablettes, une logistique automatisée des
  pièces et des robots légers pour joindre les tronçons.
- **Le takt par poste** n'a pas été trouvé dans des sources publiques. C'est une donnée à chercher ailleurs, ou à
  poser en hypothèse.

**Pour le modèle** : une ligne cadencée, c'est un *flow shop* où **une pièce qui manque arrête un poste, puis la
ligne**. La logistique des pièces (le *kitting* : préparer le lot de pièces d'un poste) y est exactement le métier des
robots de l'entrepôt, avec une échéance par poste et par takt au lieu d'un camion.

## Les semi-conducteurs

- **Le flux rentrant** : des centaines d'étapes, et le même lot repasse par les mêmes machines pour chaque couche. La
  variabilité du temps de cycle et de l'en-cours en vient.
- **La photolithographie**, l'étape la plus chère, est souvent le goulot. Une étude de Siemens Dresde (1999) modélisait
  ce seul secteur, le reste de l'usine en boîtes noires.
- **Le goulot flottant** : selon le mélange des produits et des priorités, le goulot change de machine.
- **Le temps de cycle explose** quand la charge des machines approche 100 %.
- **Les implanteurs** ont des changements de réglage coûteux à chaque nouveau passage.
- **Le X-factor**, le temps de cycle sur le temps de traitement pur, se fixe par niveau de priorité.

**Pour le modèle** : c'est le cas où **la recherche a le plus à gagner**, parce qu'une règle locale (le lot le plus
pressé) ne voit pas qu'elle affame le goulot trois étapes plus loin. C'est aussi le plus lourd à simuler. À garder
pour plus tard.

## Ce que la variante « atelier » reprend

Le *job shop* d'usinage, d'abord ([feuille-de-route.md](feuille-de-route.md)) :
- il est le plus proche de l'entrepôt : des robots qui portent des choses entre des postes, sur la même grille, avec
  les mêmes chemins A* ;
- l'aléa caché y est naturel : un rejet au contrôle, une panne, un outil qui casse ([aleas-qualite.md](aleas-qualite.md)) ;
- les règles simples existent et sont connues (FIFO, SPT, EDD, CR, le goulot d'abord) : la recherche a quelque chose à
  battre.

## Sources

- [Comparative study of dispatching rules in a real-life job shop](https://avesis.mcbu.edu.tr/yayin/35fdc108-c9d3-41ca-b275-186a93410bf4/comparative-study-of-dispatching-rules-in-a-real-life-job-shop-environment)
- [A comparison of job shop dispatching rules using a total cost criterion](https://ink.library.smu.edu.sg/lkcsb_research/2272)
- [New dispatching rules for shop scheduling: a step forward](https://www.iaorifors.com/paper/29375)
- [Job shop scheduling using heuristics (Amrita)](https://www.amrita.edu/publication/job-shop-scheduling-using-heuristics-through-python-programming-and-excel-interface/)
- [MetricGate, job scheduling](https://metricgate.com/docs/job-scheduling/)
- [Theory of Constraints, Wikipédia](https://en.wikipedia.org/wiki/Theory_of_Constraints_in_streamline_manufacturing)
- [PMI, drum-buffer-rope et critical chain](https://www.pmi.org/learning/library/drum-buffer-rope-critical-chain-buffering-8526)
- [Learnsignal, les cinq étapes](https://www.learnsignal.com/blog/theory-of-constraints-five-focusing-steps-explained/)
- [Production Machining, le préréglage](https://www.productionmachining.com/articles/reducing-downtime-with-tool-presetting)
- [MoldMaking Technology, l'outillerie](https://www.moldmakingtechnology.com/articles/toolroom-management-presetting-increases-profits-and-productivity)
- [Big Daishowa, le préréglage en aéronautique](https://www.bigdaishowa.com/en/node/1135)
- [SMED, Wikipédia](https://en.wikipedia.org/wiki/Single-minute_exchange_of_die), [Lean Enterprise Institute](https://www.lean.org/lexicon-terms/single-minute-exchange-of-die/)
- [Forecast International, la nouvelle ligne A320 de Toulouse](https://flightplan.forecastinternational.com/2023/07/13/airbus-inaugurates-new-toulouse-a320-family-final-assembly-line/)
- [CompositesWorld, la ligne de Toulouse](https://compositesworld.com/news/airbus-inaugurates-new-toulouse-based-a320-final-assembly-line)
- [AFM, la cadence de 75](https://afm.aero/global-aircraft-manufacturer-airbus-inaugurates-new-final-assembly-line-to-support-ramp-up-to-75-a320-aircraft-per-month-in-2026)
- [Winter Simulation Conference 2008, X-factor](https://www.informs-sim.org/wsc08papers/280.pdf)
- [Winter Simulation Conference 2001, dispatching en fab](https://www.informs-sim.org/wsc01papers/163.PDF)
- [WWK, la photolithographie de Siemens Dresde (1999)](https://wwk.com/wp-content/uploads/2019/11/99_sept.pdf)
- [UCF, les implanteurs](https://stars.library.ucf.edu/scopus2000/7910)
- [Ajou, dispatching par prévision du temps de cycle](https://dcoll.ajou.ac.kr/dcollection/srch/srchDetail/000000035181)
- [OpenClassrooms, OF, gamme et nomenclature](https://openclassrooms.com/fr/courses/6016141-pilotez-la-production-dans-l-industrie-du-futur/6467536-gerez-les-ordres-d-achat-et-de-fabrication)
- [La Fabrique du Net, GPAO et ERP](https://www.lafabriquedunet.fr/logiciels/gestion/erp/erp-production)
