# Le glossaire de l'entrepôt et de l'atelier

Sami (26/10/2026, `docs/prompt/recherche-glossaire-industrie.md`) : employer les termes réels de l'industrie, pour
rapprocher la simulation des contraintes et des mesures réelles. Une ligne par terme ; un terme est ici avant d'être
employé ailleurs. Quand le modèle a déjà la chose, son nom dans le code suit entre crochets : la correspondance est
faite ici, le code n'est pas renommé. Les sources sont dans chaque fichier du dossier, pas ici.

## La logistique (ce que le modèle fait déjà)

- **Entrepôt, plateforme logistique, centre de distribution** (*DC*) : le bâtiment où l'on reçoit, stocke, prépare et
  expédie. Ulog, visité par Sami, en est un. [`plans.js`, un plan]
- **Quai** (*dock*), **porte de quai** : l'ouverture où un camion se met à cul pour être chargé ou déchargé.
  [`T`, `warehouse.docks`]
- **Zone de pré-chargement**, **zone de préparation expédition** (*staging area*) : le sol devant les quais où les
  palettes d'un camion attendent, préparées d'avance. [`w`, `dock.bay` et `dock.zones` ; la zone automatique, `auto`]
- **Commande** (*order*), **ligne de commande** : ce qu'un client demande ; une ligne est un article et sa quantité. Le
  modèle a une ligne par commande, une palette chacune. [`orders`]
- **Préparation de commandes** (*picking*), **préparateur** (*picker*) : aller chercher les articles dans les rayons.
  [la phase `toPick`, puis `picking`]
- **Emplacement** (*location*, *slot*) : la case d'un rayonnage où un article est rangé. [un bloc `A`…`L`, ses cases
  de ramassage `blocks`]
- **Allée** : le couloir entre deux rayonnages. Une **allée bloquée** a une palette posée, un cariste qui manœuvre, un
  inventaire. [`~`, `day.blockages`]
- **Réception** (*inbound*), **mise en stock** (*put-away*) : décharger un camion qui arrive, contrôler, ranger.
  Absente du modèle.
- **Dock-to-stock** : le temps de l'arrivée d'une marchandise à sa mise en stock, disponible dans le système.
- **Expédition** (*outbound*), **chargement** : monter les palettes préparées dans le camion. [la « charge »,
  `toTruck`]
- **Rotation d'un camion** (*truck turnaround time*), **temps à quai** (*dwell time*) : de l'arrivée du camion à son
  départ. [`truckWait`, la somme pour tous les camions]
- **Créneau de quai** (*dock appointment*) : l'heure de passage réservée par un transporteur. [`setup.trucks`]
- **Tri** (*sortation*), **allotissement** : répartir des colis par destination, par tournée.
- **Cross-docking**, **cross-dock** : les marchandises reçues repartent presque aussitôt, sans être stockées.
- **Chaîne du froid** : garder un produit dans sa plage de température de bout en bout ; les zones **positive**
  (0 à 5 °C) et **négative** (−18 °C ou moins).
- **FIFO**, **FEFO** : premier entré premier sorti ; premier périmé premier sorti (les produits frais).
- **Réapprovisionnement** : remonter un article d'une réserve vers son emplacement de préparation.
- **WMS** (*warehouse management system*) : le logiciel de l'entrepôt ; il donne les missions aux préparateurs et
  aux robots. [`rules.js` et `search.js` en font le travail d'affectation]
- **Taux de service** : la part des commandes livrées complètes et à l'heure. [`delivered` sur `orders`]

## Les machines et les gens de l'entrepôt

- **Cariste** : le conducteur d'un chariot élévateur. Le personnage au clavier de la feuille de route.
- **Chariot élévateur** (*forklift*) : l'engin qui lève et porte les palettes.
- **AGV** (*automated guided vehicle*) : un véhicule guidé par une piste (fil, bande, aimants), qui suit un trajet fixe.
- **AMR** (*autonomous mobile robot*) : un robot mobile qui navigue seul et change de trajet. Les robots du modèle en
  sont. [`robots`]
- **Robot porteur sous palette** (*lift AMR*, le Kiva d'Amazon) : un robot qui passe sous une étagère ou une palette et
  la soulève. C'est le geste du modèle : un robot vide passe sous une palette posée, pas un robot chargé.
- **Goods-to-person**, **marchandise à l'opérateur** : le stock vient au préparateur, qui reste à son poste.
- **Borne de charge** : où un robot recharge sa batterie. [`c`, `warehouse.charges`]
- **Gestion de flotte** (*fleet manager*) : le logiciel qui donne leurs missions aux robots et règle leurs croisements.
  [`day-choice.js`, `day-legs.js`, `day-queues.js`]
- **Zone d'attente**, **zone tampon** : où un robot sans mission se gare sans gêner. [`aside`, `spotsOf`]
- **Chargeur** : dans le modèle, le seul robot qui entre dans un camion à quai pour une zone. Le nom réel le plus
  proche est le **cariste de chargement**. [`truck.loaders`]
- **Relais**, **transbordement** : une palette passée d'un engin à un autre. [`relay`, `day-relays.js`]

## La production

- **Atelier**, **ligne**, **cellule**, **poste de travail** (*workstation*) : l'atelier regroupe des machines ; une
  ligne les enchaîne ; une cellule en groupe quelques-unes pour une famille de pièces ; un poste est l'endroit d'une
  opération.
- **Job shop** (atelier à cheminements multiples) : chaque pièce a son propre parcours entre les machines.
- **Flow shop** (atelier à cheminement unique) : toutes les pièces passent par les mêmes machines, dans le même ordre.
- **Ligne d'assemblage final** (*FAL*, *final assembly line*) : les postes où l'on assemble un avion (Airbus, à
  Toulouse, Hambourg, Mobile, Tianjin).
- **Cadence** : le nombre de produits par période (les A320 sont comptés par mois).
- **Takt time** (temps de cycle client) : le temps disponible divisé par la demande : à quel rythme un produit doit
  sortir.
- **Temps de cycle** : le temps réel d'une opération, ou d'un produit de bout en bout.
- **Délai de fabrication** (*lead time*), **temps de traversée** : de l'entrée d'une pièce dans l'atelier à sa sortie.
- **Goulot**, **goulet d'étranglement** (*bottleneck*), **contrainte** : la ressource la plus chargée, qui fixe le
  débit de tout l'atelier.
- **Théorie des contraintes** (*TOC*, Goldratt) : identifier la contrainte, l'exploiter, subordonner le reste,
  l'élever, recommencer.
- **Tambour-tampon-corde** (*DBR*, *drum-buffer-rope*) : le goulot donne le rythme (le tambour) ; un stock tampon
  devant lui le protège ; la corde ne lâche de nouvelles pièces dans l'atelier qu'au rythme du goulot.
- **En-cours** (*WIP*, *work in progress*) : les pièces commencées mais pas finies.
- **Kanban** : une carte, ou un bac vide, qui autorise un poste à produire ce que le suivant a consommé.
- **Juste-à-temps** (*JIT*) : produire ce qu'il faut, quand il faut, sans stock d'avance.
- **Ordre de fabrication** (*OF*) : l'ordre de produire une quantité d'un article, rattaché à une gamme et à une
  nomenclature ; planifié, puis ferme.
- **Gamme**, **gamme opératoire** (*routing*) : les opérations d'un article, leur ordre, les postes de charge et les
  temps prévus ; écrite par le bureau des méthodes.
- **Nomenclature** (*BOM*, *bill of materials*) : la liste des composants d'un produit, par niveaux ; écrite par le
  bureau d'études.
- **Poste de charge** : une machine ou un groupe de machines vu comme une capacité.
- **GPAO**, **ERP** : le logiciel qui planifie et ordonnance la production (l'ERP intègre aussi les achats, la
  comptabilité…).
- **MES** (*manufacturing execution system*) : le logiciel de l'atelier, qui suit en temps réel chaque OF, chaque
  machine, chaque lot.
- **Ordonnancement** (*scheduling*), **règle de priorité** (*dispatching rule*) : décider quelle pièce passe sur quelle
  machine, et quand.
- **SPT**, **EDD**, **CR** : le plus court d'abord (*shortest processing time*), l'échéance la plus proche d'abord
  (*earliest due date*), le ratio critique (le temps qui reste avant l'échéance sur le travail qui reste).
- **Makespan** : le temps total pour finir toutes les tâches. [`finish`, le tour de la dernière livraison]
- **Retard** (*tardiness*) : de combien une tâche finit après son échéance.
- **Changement de série** (*changeover*), **réglage** (*setup*) : préparer une machine pour un autre article.
- **SMED** (Shingo) : réduire un changement de série à moins de dix minutes, en séparant le réglage interne (machine
  arrêtée) de l'externe (machine en marche).

## La maintenance

- **Panne**, **arrêt non planifié** : une machine qui s'arrête sans qu'on l'ait prévu.
- **MTBF** (*mean time between failures*) : le temps moyen entre deux pannes.
- **MTTR** (*mean time to repair*) : le temps moyen pour remettre une machine en service, de la panne détectée à la
  reprise.
- **Maintenance préventive**, **corrective**, **conditionnelle** : à date fixe ; après la panne ; quand une mesure
  (vibration, usure) le demande.
- **TPM** (*total productive maintenance*, Nakajima) : la maintenance par tous, les opérateurs compris, pour viser
  zéro panne.
- **TRS** (taux de rendement synthétique), **OEE** (*overall equipment effectiveness*) : disponibilité × performance ×
  qualité ; la norme française est la NF E60-182.
- **Outil coupant**, **durée de vie d'un outil** : une fraise, un foret, qui s'usent et se changent après un temps de
  coupe donné.
- **Porte-outil**, **frettage** (*shrink fit*) : le cône qui tient l'outil dans la broche ; frettage : l'outil serré à
  chaud (le métier d'Haimer).
- **Préréglage d'outil** (*tool presetting*) : mesurer un outil hors de la machine, pour que son changement ne
  l'arrête pas.
- **Magasin d'outils**, **outillerie** (*tool crib*, *tool room*) : où l'on range, prépare et répare les outils.
- **Pièce de rechange**, **pièce tournante** (*rotable*) : une pièce que l'on répare et remet en stock plutôt que de la
  jeter.
- **MRO** (*maintenance, repair and overhaul*) : l'entretien, la réparation et la révision ; en aéronautique, un métier
  à part entière.
- **AOG** (*aircraft on ground*) : un avion cloué au sol faute d'une pièce, la priorité absolue.

## La qualité

- **Contrôle en cours de fabrication**, **contrôle final** : vérifier une pièce entre deux opérations, ou à la fin.
- **Non-conformité** (*NC*), **fiche de non-conformité** (*FNC*) : une pièce hors de ses exigences ; on la détecte,
  l'isole, statue, enregistre, analyse.
- **Mise en quarantaine**, **blocage qualité** (*quality hold*) : une pièce ou un lot isolé en attendant la décision.
- **Retouche** (*rework*) : ramener la pièce à l'exigence d'origine.
- **Reprise**, **réparation** (*repair*) : rendre la pièce acceptable pour l'usage, sans la ramener à l'exigence
  d'origine ; elle demande souvent une dérogation.
- **Dérogation** : l'autorisation formelle d'utiliser ou de livrer une pièce non conforme.
- **Rebut** (*scrap*) : la pièce éliminée, rendue inutilisable.
- **Commission de revue** (*MRB*, *material review board*) : ceux qui décident du sort d'une pièce non conforme.
- **FPY** (*first pass yield*), **rendement au premier passage** : la part des pièces bonnes du premier coup, sans
  retouche.
- **RTY** (*rolled throughput yield*) : le produit des FPY des étapes, la perte cumulée.
- **Rendement** (*yield*) : dans les semi-conducteurs, la part des puces bonnes sur une plaquette.
- **SPC** (maîtrise statistique des procédés) : suivre une cote sur une carte de contrôle pour voir une dérive avant le
  défaut.
- **Poka-yoke** (détrompeur) : un dispositif qui empêche l'erreur.
- **8D** : la méthode en huit étapes pour traiter un problème qualité jusqu'à sa cause.
- **Traçabilité** par lot ou par numéro de série : savoir d'où vient chaque pièce et par où elle est passée.
- **EN 9100** (*AS9100*) : la norme qualité de l'aéronautique, construite sur l'ISO 9001.

## Les semi-conducteurs

- **Fab** : l'usine de puces. **Salle blanche** : l'air filtré où l'on travaille les plaquettes.
- **Plaquette** (*wafer*), **lot** : le disque de silicium ; les plaquettes voyagent par lots (souvent 25).
- **Flux rentrant** (*re-entrant flow*) : un lot repasse de nombreuses fois par les mêmes machines, une couche à chaque
  fois.
- **Photolithographie** : l'étape la plus chère, souvent le goulot de la fab.
- **X-factor** : le temps de cycle réel divisé par le temps de traitement pur.
- **Goulot flottant** : un goulot qui change de machine selon le mélange des produits.

## La sécurité, l'homme et le robot

- **Cobot** : un robot conçu pour travailler au contact d'un humain.
- **ISO 10218** : la norme de sécurité des robots industriels ; **ISO/TS 15066** : les robots collaboratifs.
- **Les quatre modes collaboratifs** : l'arrêt nominal de sécurité surveillé ; le guidage à la main ; la surveillance
  de la vitesse et de la séparation ; la limitation de puissance et d'effort.
- **ISO 3691-4** : la sécurité des chariots sans conducteur (AGV, AMR).
- **Scrutateur laser de sécurité** : le capteur qui ralentit ou arrête un robot quand quelqu'un entre dans son champ.
- **Zone de sécurité**, **zone réservée** : un espace interdit aux piétons, ou aux robots.
- **Arrêt d'urgence** : le bouton qui arrête tout.
- **Consignation** (*LOTO*, *lockout-tagout*) : couper et verrouiller les énergies d'une machine avant d'y intervenir.
- **Presqu'accident** (*near miss*) : un incident sans blessé, qui aurait pu en faire un.
- **Co-activité** : des piétons, des caristes et des robots dans le même espace.
