@AGENTS.md

# Relief

Éditeur 3D no-code dans le navigateur, pour les designers de marque : objets, matières, typographie,
effets, mouvement, mockups packaging et export multi-format.
La spécification complète est dans `FEATURES.md` (section 15 = ordre des phases).

## Stack
- Next.js 16 (App Router, TypeScript, Tailwind 4), React 19.
- three.js + @react-three/fiber + @react-three/drei, zustand (état + persistance localStorage).
- opentype.js pour convertir les TTF de `public/fonts` en typeface JSON (voir `src/editor/lib/ttf.ts`).
- Les modèles 3D (GLB/FBX/OBJ) et les médias (images, vidéos) importés sont stockés en IndexedDB, pas en localStorage. Un `.gltf` seul est refusé avec un message (il référence des fichiers externes) : seul le `.glb` est autonome. Les GLB compressés Draco et meshopt et les textures KTX2 (Basis) sont décodés ; les décodeurs sont servis depuis `public/draco` et `public/basis`.
- On peut **déposer des fichiers** n'importe où sur la colonne du viewport (`useFileDrop` dans `Editor.tsx`, `lib/importers.ts`) : modèle → objet, image ou vidéo → cover, `.hdr`/`.exr` → environnement, police → bibliothèque. Un cadre pointillé pendant le survol, un avis en bas ensuite, en rouge quand un fichier a été refusé et pourquoi.
- Backend prévu : Supabase (auth, projets, storage) et déploiement Vercel. Pas encore branchés.

## Déploiement
Le dépôt `qrek/relief` est relié au projet Vercel `relief` (équipe `bacholiertheo-5383s-projects`,
id `prj_vDAXMYu1Ll9KXrOjZBqFVnfuON1H`) : chaque push sur `main` déploie la production sur
https://relief-seven-gray.vercel.app (l'alias long `relief-bacholiertheo-5383s-projects.vercel.app` est derrière la protection de déploiement Vercel et redirige vers une connexion ; ne partager que l'adresse courte). Il n'y a pas encore de backend : un projet
vit dans le navigateur de la personne qui l'ouvre. La route `/api/dev-snapshot` répond 404 en
production, `/api/fonts` fonctionne partout.

## Commandes
- `npm run dev` : serveur de dev sur http://localhost:3000
- `npm run build` : build de production (à lancer avant de considérer une feature terminée)
- `npm run lint`

## Organisation
- `src/app` : pages Next (la page racine charge l'éditeur côté client uniquement).
- `src/editor/store.ts` : état du projet (objets, staging, format), historique undo/redo, persistance, migration.
- `src/editor/runtime.ts` : handles three.js vivants (renderer, scène, caméra, Object3D et couches par id), non persistés.
- `src/editor/presets` : matériaux, fonts, environnements, formats de canvas, shapes SVG, catalogue d'objets 3D.
- `src/editor/lib` : conversion TTF, extrusion SVG, helpers de géométrie, chargement de modèles et de médias, chaîne d'effets, vignettes, stockage IndexedDB, export image.
- `src/editor/components` : `Viewport.tsx` (Canvas R3F), `objects/` (meshes), `panels/` (UI), `ui.tsx` (primitives).

## Interface
Disposition d'origine, sombre et neutre : rail d'outils à gauche, calques en carte sur le viewport,
panneau à onglets à droite. Les onglets suivent trois niveaux : **Object** (la sélection),
**Material ou Effects** (un seul emplacement, nommé selon la sélection : un solide a une matière,
une image ou vidéo a des effets, il n'y a donc jamais d'onglet mort), **Scene** (lumière,
environnement, caméra ; le mot Staging du concurrent n'est plus employé), **Look** (les effets sur
l'image entière) et **Export**. `PanelId` garde `material` et `effects` comme deux ids, l'éditeur
résout lequel afficher. Deux refontes ont été essayées puis écartées par l'utilisateur (un
pupitre caméra en bas, puis une disposition façon Figma) ; ne pas reproposer de refonte de
structure sans qu'il la demande.

Le logo est `components/Logo.tsx` (un relief dessiné en courbes de niveau, dans l'accent) et
`app/icon.svg` pour l'onglet ; les deux doivent rester identiques.

Les icônes viennent de `lucide-react` (trait 1.75, 13 px dans les panneaux, 15 px dans la barre,
18 px dans le rail), via `IconButton` de `ui.tsx`, dont le `title` est obligatoire : le mot part
dans l'info-bulle, jamais nulle part. Une icône remplace un mot seulement là où le mot faisait
déjà office de pictogramme (actions de ligne, annuler, fichier, outils du rail). Les onglets, les
réglages nommés et les actions principales (Scenes, Export) gardent leur mot. Ne pas importer
`Image` de lucide sous ce nom, la règle d'accessibilité le prend pour une balise img.

Une seule couleur d'accent, `--accent` dans `globals.css` (vert acide pour l'instant), avec
`--accent-ink` pour le texte posé dessus et `--accent-soft` / `--accent-edge` qui en dérivent.
Elle signifie toujours « actif » ou « sélectionné ». Les surfaces restent en `white/5`, `white/10` :
ne pas utiliser de blanc plein comme état actif, passer par ces variables.

## Cinq types d'objets
`SceneObject` est une union : `text` (texte 3D extrudé), `shape` (SVG extrudé), `model` (objet 3D),
`cover` (image ou vidéo avec une pile d'effets), `label` (typographie plate verrouillée sur le cadre).
Un `model` a une `source` soit `procedural` (un preset de `presets/objects.ts` plus ses paramètres),
soit `asset` (un fichier importé, référencé par son id IndexedDB).

## Polices
Un id de police est une petite adresse. Les polices livrées gardent leur id simple (`inter`), un
fichier importé est `asset:<id>`, une famille Google est `google:<Famille>:<variante>` avec la
notation de Google (`400`, `700`, `400i`). `lib/fonts.ts` résout les trois : `loadFont(id)`
renvoie la typeface convertie, `describeFont(id)` un nom et une catégorie pour les panneaux.

Google Fonts fonctionne **sans clé** : la route `/api/fonts` demande la feuille CSS classique en se
présentant comme un client sans web fonts, ce qui fait servir des TTF au lieu de woff2, puis relaie
le fichier. Le catalogue (`presets/google-fonts.json`, 1 946 familles, triées par popularité)
vient des métadonnées publiques de Google ; le régénérer de temps en temps depuis
`https://fonts.google.com/metadata/fonts`. Une police Google téléchargée est gardée en IndexedDB
comme asset de kind `font` avec son id dans `data`, donc une seule fois par machine.

Les polices importées (TTF ou OTF) sont des assets de kind `font` ; le fichier est parsé à l'import
pour refuser un fichier cassé tout de suite. Elles ne quittent jamais le navigateur.

## Typographie plate et placage de logo
Un `label` ne vit pas dans la scène : sa `matrixWorld` est recalculée à chaque frame depuis la
caméra, donc il ne tourne jamais en orbite et reste au même endroit du cadre dans tous les formats.
Sa taille est une fraction de la hauteur du cadre. Attention, `Center` de drei place le contenu
**du côté** nommé, donc un alignement à gauche utilise le drapeau `right`.

`label.depth` vaut `front` (par-dessus tout, sans test de profondeur : une légende) ou `behind`
(posé à trente unités devant la caméra, avec test et écriture de profondeur : un titre d'affiche
que le sujet recouvre). Le facteur d'échelle suit la distance, donc la taille apparente est la
même dans les deux cas.

Chaque ligne d'un label est composée séparément (un `Text3D` par ligne dans son propre `Center`),
sinon l'alignement ne vaut que pour le bloc et un texte centré sort avec toutes ses lignes calées
à gauche. Le bloc est remonté d'une demi-hauteur de capitale pour que son milieu tombe sur l'ancre.

`material.artwork` imprime une image sur une surface : `lib/artwork.ts` compose la couleur du
matériau et l'image dans un canvas, puis la pose en `map`. Le décalage est appliqué sur la
texture, pas sur le canvas, pour que « Across » fasse tourner l'étiquette autour d'une canette.
La collection Packaging utilise des tours de révolution justement parce que leurs UV font un tour
complet du côté.

## Temps, mouvement et boucle
`lib/clock.ts` est la seule source de temps. En direct elle suit le temps réel ; pendant un export
vidéo elle est épinglée sur des temps d'image exacts, ce qui rend chaque frame déterministe.

Le mouvement des objets (Motion) est **périodique de période 1/vitesse** sur le temps live, avec
`sin(TAU * vitesse * t)`. Les effets, eux, n'ont **plus de vitesse** : ils reçoivent `uTime` en
**angle**, `TAU × (position de la tête de lecture dans le clip)`, soit un tour complet sur la durée
du clip. Un shader animé doit donc être écrit périodique en `uTime` de période `TAU`, et il boucle
par construction sur le clip ; où il en est se décide dans la timeline, comme une clé. Pour le
bruit, on parcourt un cercle (`vec2(cos(uTime), sin(uTime))`) plutôt que de dériver linéairement.
`isAnimated(def)` regarde simplement si le shader lit `uTime`.

Le mouvement s'applique sur un groupe interne, pas sur le groupe transformé par le gizmo.

## Keyframes et timeline
Le projet porte un **clip** (`project.clip.duration`, 4 s par défaut) qui boucle. L'horloge a
deux temps : `time`, le temps live qui court toujours (mouvements en boucle, effets animés), et
`clipTime`, la **tête de lecture**, à zéro et à l'arrêt à l'ouverture comme dans Blender ou After
Effects, qui n'avance que sur Play (`playing`, `seek`, `pause`). Un export épingle les deux sur le
temps de l'image. La timeline est un choix : rien n'oblige à s'en servir, et une scène sans clé
se comporte exactement comme avant. Les clés sont
**par canal** : `keys: KeyTracks` est un dictionnaire `canal → Key[]` (`{ id, t, v, ease }`, trié
par temps), avec `position.x` … `scale.z` sur un objet et la clé du paramètre sur un effet. Un canal
sans clé est absent et suit la valeur ordinaire. `lib/keyframes.ts` échantillonne (angles par le
plus court chemin, quatre eases, la première clé tient avant elle et la dernière après), et
`normalizeTracks` convertit la première forme (une clé pour tout le transform) en canaux.

**Poser une clé** se fait à côté de la valeur : `KeyDiamond` dans `ui.tsx`, porté par `Row`,
donc par `Slider` et `Vec3Field` (`keyState`, `onKey`). Le losange est creux sans clé, cerclé
d'accent quand le canal est animé, plein quand une clé est au temps courant ; cliquer pose la
clé à ce temps (ou la retire si elle y est). Un `Vec3Field` pose ses trois canaux d'un coup. Une
fois un canal keyé, **changer la valeur écrit la clé au temps courant** (auto-key), au gizmo
comme au champ. K pose les neuf canaux du transform de la sélection. La première clé ouvre la
timeline.

**La timeline** (`panels/Timeline.tsx`, sous le viewport, `timelineOpen` dans le store) liste
tout ce qui est keyé : une ligne de groupe par objet ou par effet (« Halftone · Look »), une ligne
par vecteur (Position, Rotation, Scale) ou par paramètre. Un losange par instant distinct, donc un
seul pour les trois canaux d'un vecteur. Cliquer un losange va à ce temps ; le glisser déplace les
clés de la ligne (`moveKeys`, coalescé) ; Suppr retire les clés sélectionnées (le gestionnaire du
panneau arrête la propagation, sinon le raccourci global supprimerait l'objet). L'en-tête porte
lecture, temps, durée du clip, et pour la ligne sélectionnée l'ease et « Close loop » (copie la
première clé à la fin). Les lignes sont adressées par `TrackRef` (objet + canaux, ou propriétaire +
instance + canaux) ; `withTrack` dans le store est le seul chemin vers leurs clés.

**La caméra est un objet.** Elle n'est pas dans `project.objects` (aucun `kind` à traverser)
mais la sélection peut la désigner par `CAMERA_ID` : une ligne « Camera » en tête des calques,
`CameraPanel` à la place du panneau objet (position, « Looks at », focale, mise au point, chacun
avec son losange), une ligne « Camera » dans la timeline. Ses clés vivent dans
`project.camera.keys` (canaux `position.*`, `target.*`, `focal`, `focus`) ; `setCamera` et
`setStaging` écrivent la clé au temps courant quand le canal est keyé ; un `useFrame` dans
`SceneContent` pose la caméra de prise de vue d'après ses clés à chaque image, sauf pendant une
orbite ou une prise au gizmo (`interacting`), et la profondeur de champ lit le `focus` keyé. En
vue libre ou double, `CameraHandle` est une boule invisible à la position de la caméra : un clic
la sélectionne, le gizmo la déplace.

Les panneaux affichent la valeur échantillonnée au temps courant, pas la valeur de base :
`useClockTick` échantillonne l'horloge quelques fois par seconde sans en faire un état React. Le
gizmo lève `runtime.dragging` pendant la prise, pour que l'échantillonnage ne se batte pas avec
la main. Un clip keyé est une période de plus pour la suggestion de durée de boucle vidéo.

## Templates et scènes enregistrées
Le bouton Scenes ouvre deux listes. En haut, les **templates** de `presets/templates.ts` : des
compositions finies (sujet, type, lumière, objectif, look) rendues par l'app elle-même, vignette
dans `public/templates/`. Une première série livrée en 2026 avait été jugée plate et supprimée ;
la règle depuis est **peu, mais très bien**. Un template est une affiche, pas un objet sur un
fond : il part d'une référence visuelle, se juge à l'image à la taille d'export, et n'entre dans
la liste que lorsqu'il tient la comparaison. Trois pour l'instant : « Like no one » (affiche riso,
titre derrière, galet à facettes devant, trame quatre couleurs), « Open sign » (un mot en diodes
vertes sur un panneau LED, avec sa lueur) et « Carpe feed » (chrome liquide sur papier, titre
condensé, petites lignes en bas). Pour en ajouter un : construire la scène dans l'app, capturer le
projet en JSON et une vignette 540 px, puis `add_template.py` (dans le scratchpad de session) ou à
la main dans `presets/templates.ts` avec des ids fixes lisibles.

En dessous, les scènes que le designer a lui-même enregistrées : le projet sérialisé va dans le
champ `data` d'une entrée IndexedDB de kind `template`, la vignette dans `blob`.

## Look : effets sur l'image entière
`staging.look` est une pile d'effets (les mêmes que ceux des covers) qui s'applique à **toute
l'image finie**, type et objets confondus, après la profondeur de champ. Elle a son propre onglet
Look. `MAX_EFFECTS` (24) est une borne de sécurité, pas une limite de design : chaque effet est une
passe plein écran de plus, la pile d'un cover ne retourne que quand elle change, celle du look tourne
à chaque image.
C'est ce qui transforme un rendu en impression. `lib/look.ts` porte la passe : la scène est
dessinée dans une cible, développée (tone mapping puis transfert sRGB, à la main), la pile tourne
dessus via `EffectChain`, et le résultat est recopié tel quel sur le canvas.

Les actions d'effets du store prennent un id de propriétaire : l'id d'un cover, ou `LOOK_ID`
pour le look. Le même panneau `EffectStack` sert les deux. L'onglet Look s'ouvre sur la galerie
(`showcase`) tant que la pile est vide : les effets sont l'argument du produit, ils se voient avant
de se lire.

**Les tailles d'effet sont en pixels de l'export**, pas de l'écran. Chaque passe reçoit `uFrame`,
le nombre de pixels du tampon par pixel de l'image finie (hauteur du tampon divisée par la hauteur
du format pour le look, par la hauteur native du média pour un cover). Un rayon, un grain, une
traînée se multiplient par `uFrame` avant de se diviser par `uResolution` ; la pyramide de Bloom
perd un niveau quand le tampon est plus petit. Avant ça, changer de format ou de taille de fenêtre
changeait le grain et le flou à l'écran, et l'écran ne ressemblait pas au fichier. Le plafond de
flou de la profondeur de champ (`maxBlur`) suit la même règle via `referenceHeight`.

**Vignettes d'effets** (`lib/effectThumbs.ts`) : chaque effet est prévisualisé par lui-même, sur une
petite scène fixe (un seul cube arrondi corail, gros dans le cadre, fond gris moyen) rendue par
`LookPass` dans un renderer hors écran, une vignette par tick de `setTimeout` (pas `rAF`, qu'un
onglet en arrière-plan bride), puis gardée en mémoire. Un fond gris, pas papier : une lueur et une
traînée doivent se voir, une trame aussi. Une première version avec un nœud torique a été jugée
bizarre et illisible ; une forme simple que l'œil connaît laisse toute la place à l'effet.
`PREVIEW_PARAMS` donne à chaque effet des réglages **exagérés pour la vignette** (cellules de
trame comptées pour cent pixels de haut, amplitudes poussées) : les valeurs par défaut sont
faites pour une affiche et ne se voient pas à cette taille. Les effets Alpha sont rendus sur fond
transparent puis posés sur le gris, pour qu'un contour ou une ombre ait un bord à trouver.

Deux leçons de shader qui complètent celles de la profondeur de champ :
- Une passe qui dessine **toujours** dans une cible ne reçoit pas les fonctions de tone mapping
  de three, qui ne les injecte que pour un tirage à l'écran. Elle doit inclure elle-même
  `tonemapping_pars_fragment`. Les fonctions de transfert de couleur, elles, sont toujours là.
- Dans une trame tournée, le rapport d'aspect s'applique **avant** la rotation à l'aller et
  **après** la rotation inverse au retour. Dans l'autre ordre la grille est cisaillée d'une
  quantité qui dépend de l'angle, et les plaques d'une trame couleur se retrouvent décalées de
  plusieurs cellules les unes par rapport aux autres.

Les aides d'édition marquées `userData.overlay` (gizmo, marqueurs de lumière, cadre caméra) sont
retirées de l'image avant la profondeur de champ ou le look, puis redessinées par-dessus le
résultat par `drawHelpersOnTop`, pour rester nettes et non tramées.

**Bloom** n'est pas une passe comme les autres : `EffectChain` reconnaît son id et exécute une
pyramide (préfiltre à seuil doux, descente par moitiés, remontée en tente, composition additive)
dans `BloomStage`. C'est ce qui donne une lueur large et sans noyau visible ; la passe unique à
rayon fixe est gardée seulement comme repli. Un shader d'effet ne peut pas faire ça seul, puisqu'il
n'a qu'une passe.

**LED matrix** lit l'image au centre de chaque cellule et pousse la luminosité le long de la
teinte de la diode, jamais vers le blanc ; la saturation force la couleur. Le suivre de Bloom donne
la lueur d'un vrai panneau.

## Lumières, ombres, environnement
`staging.lights` est une liste de `SceneLight` (soleil, spot, point), chacune placée comme le
ferait un photographe : azimut, hauteur et distance sur une sphère autour de l'origine, toujours
braquée sur le sujet. La convention d'azimut est celle de l'unique lumière d'avant (zéro devant le
sujet, positif à droite) ; `lightPosition()` dans `components/Lights.tsx` en est la seule définition.

Chaque lumière est **dessinée dans le viewport** (`LightMarkers` : disque à rayons pour un soleil,
cône pour un spot, petite sphère pour un point, toujours tournés vers le sujet). Cliquer un
marqueur sélectionne la lumière (`selectedLightId` dans le store, exclusif avec la sélection
d'objet), et le gizmo de translation le déplace : la position lâchée est reconvertie en azimut,
hauteur et distance par `placementFromPosition`, bornée aux plages des curseurs. Le modèle
sphérique reste donc la seule vérité ; le gizmo n'est qu'une autre façon de le régler. Le marqueur
d'un soleil est dessiné à six unités, pas à la distance réelle de la lumière, sinon il serait hors
de tout écran.
Les anciens champs `lightColor/Intensity/Azimuth/Elevation` sont migrés en lumière clé par
`normalizeStaging`, au même endroit, ce qui garde les scènes enregistrées et les templates
identiques au pixel près (vérifié sur « Like no one »).

Spots et points ont `decay` à zéro : le curseur veut dire luminosité, pas watts, et reculer une
lumière pour adoucir son ombre ne l'éteint pas. Les ombres portées (`castShadows`) tombent sur les
objets et sur un sol invisible en `shadowMaterial` (`shadowCatcher`) à `floorY` ; le canvas est en
`shadows="percentage"` parce que c'est la seule variante qui honore le rayon de flou par lumière
(`softness`). Les ombres de contact (`shadows`) restent un réglage à part. `presets/lights.ts` porte
`createLight` et les rigs (trois points, softbox, soleil rasant, paire de rims).

L'environnement est un **studio** (`studio:<id>`, `presets/studios.ts`), un preset drei (une
photo de lieu) ou `asset:<id>` pour une carte importée (`.hdr`, `.exr`, ou une image
équirectangulaire), stockée comme asset de kind `hdri` et chargée par `lib/hdri.ts`.

Un studio n'est pas une photo mais un **rig** : des panneaux de lumière (rect, disque, anneau)
avec une couleur et une intensité linéaire, dans une pièce d'une teinte donnée, décrits en données
et construits en scène three par `buildStudioScene`, puis cuits en carte d'environnement par
`PMREMGenerator.fromScene` (`lib/studioEnv.ts`, un cache par renderer parce qu'une texture
appartient à son contexte). C'est ce qui fait qu'un chrome montre un vrai softbox qui se courbe et
qu'un verre trouve son bord sur une bande de rim. Quatre rigs : Softbox (polyvalent, défaut des
nouveaux projets), Window (lumière du jour latérale, rebond chaud), Rim (pièce noire, deux bandes
derrière, pour le chrome et le verre), Table (cyclo blanc, anneau, e-commerce). Minuscules,
réglables, sans licence ; pour en ajouter un, une entrée dans `STUDIOS`.

Les vignettes de matériaux (`lib/materialThumbs.ts`) sont **rendues** : une sphère sous le studio
Softbox, un petit carton sombre derrière pour que le verre réfracte quelque chose, une par tick
comme les vignettes d'effets. Le swatch peint sert d'attente.

**Développement** (`staging.tone`, `staging.exposure`) : ACES (défaut, celui des templates), AgX
(film, garde les couleurs saturées) ou Neutral (teinte la plus fidèle, pour une couleur de marque),
posés sur le renderer ; three relie les matériaux tout seul et la passe de look lit le même mode.

## Vue caméra, vue libre, les deux
`viewMode` dans le store vaut `camera`, `free` ou `split`, comme les regards de Blender. **Vue
caméra** (par défaut, touche 0 pour basculer avec la libre) : le canvas est le cadre, taillé au
format, et l'orbite déplace la caméra de prise de vue. **Vue libre** : le canvas prend toute la
zone, un second œil (`runtime.freeView.camera`, hors React, jamais persisté) orbite où il veut, et
la caméra de prise de vue est dessinée dans le décor par `CameraFrame` (corps, quatre rayons, le
cadre à la distance de mise au point quand la profondeur de champ est active, sinon à la distance
de la cible). Aucun flou ni look en vue libre : c'est le décor, pas l'image. « Shoot from here »
copie l'œil libre dans la caméra de prise de vue.

**Les deux** (`split`) : un seul canvas, deux viewports GL avec scissor (`lib/viewLayout.ts`
calcule les deux rectangles, partagés par le rendu, le pointeur et les surcouches DOM). Le décor
à gauche, l'image à droite ajustée à son format. Chaque volet mappe le pointeur sur son propre
rectangle et sa propre caméra (`setEvents({ compute })`). Le gizmo de three lit le pointeur contre
le `getBoundingClientRect` de son élément et ne se paramètre pas autrement : en vue double il
reçoit le canvas à travers un `Proxy` dont la boîte est le volet du décor. Chaque moitié a ses
OrbitControls, armés au `pointerdown` et au `wheel` selon le côté (phase de capture). Les
surcouches (`userData.overlay`) sont retirées du volet image : il est l'image, pas le décor. Les
passes de profondeur de champ et de look acceptent une taille explicite pour rendre dans un volet ;
`renderer.setRenderTarget(null)` restaure le viewport et le scissor courants de three, c'est ce qui
rend la chose possible sans les modifier davantage.

Piège : `setViewport` et `setScissor` de three prennent des **pixels CSS** et appliquent eux-mêmes
le ratio de pixels. Leur passer des pixels du tampon décale et agrandit les volets dès que le ratio
n'est pas 1 (c'est le cas dès la qualité Balanced). Seules les tailles de tampon des passes sont en
pixels physiques.

`runtime.exporting` est levé par `renderImage` et `renderVideo` : pendant un export, le rendu
passe toujours par la caméra, quel que soit le regard à l'écran.

La caméra de prise de vue reste la caméra par défaut de R3F (labels, fonds et export la suivent
quel que soit le regard) mais elle est `manual` : son rapport d'aspect vient du format, pas du
canvas, ce qui n'est la même chose qu'en vue caméra. En vue libre, le raycast des clics passe par
l'œil libre (`setEvents({ compute })`), et une prise de mise au point mesure la distance depuis la
caméra de prise de vue, pas depuis l'œil.

Une **grille de repère** (drei `Grid`, au niveau du sol) s'allume dans la barre du bas. Comme les
marqueurs de lumière, le cadre caméra et le gizmo, elle porte `userData.overlay` : retirée de
l'image avant le flou ou le look, jamais exportée, redessinée nette par-dessus par
`drawHelpersOnTop`. Pour qu'elle passe quand même **derrière** le sujet, `writePictureDepth`
réécrit d'abord la profondeur de l'image dans le canvas (la scène rendue avec un matériau qui
n'écrit que la profondeur, aides masquées) ; le gizmo et les marqueurs ignorent le test de
profondeur et restent au-dessus. Une première version mettait la grille dans l'image pour qu'elle
soit occultée, et elle prenait la trame et le flou : jugé faux, à raison. `userData.excludeFromExport`
seul reste disponible pour une aide qui devrait être dans l'image sans être exportée, mais rien
ne l'utilise aujourd'hui.

## Caméra et profondeur de champ
`lib/postFx.ts` calcule la profondeur de champ sur trois échelles. Ce que chaque pixel voit à
travers son propre cercle est collecté en demi-résolution puis filtré. Ce qu'un premier plan
déborde sur tout ce qui est derrière lui est collecté au **quart**, où chaque texel est déjà une
moyenne de seize. La recomposition fait sa propre collecte courte à pleine résolution pour les
premiers pixels de flou, bascule sur le tampon demi au-delà, et pose le premier plan par-dessus.

Quatre règles apprises à la dure :
- `smoothstep(a, b, x)` avec `a > b` est un **comportement indéfini** en GLSL, et les
  implémentations qui répondent quand même répondent à l'envers. Le test « le cercle de cet
  échantillon atteint-il ce pixel » doit s'écrire `smoothstep(dist - soft, dist + soft, rayon)`,
  borne basse d'abord. Écrit dans l'autre sens il donnait exactement l'inverse, et le premier plan
  ramassait les pixels les moins flous les plus lointains.
- Le disque du pixel et celui du premier plan sont **deux collectes distinctes**. Les fondre dans
  une seule moyenne laisse l'arrière-plan, qui remplit le disque, écraser le premier plan, et la
  silhouette qui devrait fondre ressort découpée.
- Toute grandeur estimée sur des échantillons tirés au hasard doit être une **moyenne**, jamais un
  maximum : un maximum sur des tirages est un pile ou face qui s'imprime en tramé.
- La rotation du disque doit venir d'un **bruit sans structure**. Un motif ordonné, y compris
  l'interleaved gradient noise, transforme la variance de la collecte en réseau visible.

La couche de premier plan est stockée **prémultipliée** par sa couverture. C'est ce qui permet de
la remonter du quart au plein cadre sans tirer du noir depuis les texels vides autour du débordement.
La remontée passe par un filtre tente lu à la résolution de la cible, sinon les contours de la
couverture restent en escalier sur la grille du quart.

`SceneRenderer` dans le viewport prend la main sur le rendu avec `useFrame(..., 1)`. Une priorité
supérieure à zéro coupe le rendu automatique de R3F et garantit que tout le reste, y compris les
chaînes d'effets des covers, a déjà tourné.

Deux pièges : une passe qui rend à travers une cible ne reçoit **ni tone mapping ni conversion de
couleur**, il faut donc inclure `tonemapping_fragment` et `colorspace_fragment` à la fin du shader.
Mais **pas** leurs déclarations `_pars_`, que three injecte déjà dans un ShaderMaterial.

Chaque passe reçoit `uScale`, le nombre de pixels de son tampon par pixel plein cadre : 0.5 en
demi, 0.25 au quart. Tous les rayons du shader sont en pixels pleine résolution et se convertissent
par ce facteur. Attention aussi à ne pas nommer un sampler `uNear`, déjà pris par le plan proche
de la caméra.

`staging.sceneScale` dit combien de millimètres vaut une unité de scène. C'est ce réglage qui rend
le macro possible : un sujet d'un centimètre par unité photographié de près donne une profondeur de
champ inférieure au millimètre, exactement comme un vrai objectif. `focusField()` calcule les mêmes
optiques en TypeScript pour que le panneau affiche des chiffres qui correspondent à l'image.

`DepthOfFieldPass.debug` vaut 1 pour la profondeur linéaire, 2 pour le rayon de flou, 3 pour le
bokeh brut, 4 pour le bokeh filtré, 5 pour la couverture du premier plan et 6 pour la couche de
premier plan elle-même.

## Export multi-format
`lib/batch.ts` rend la même scène dans plusieurs formats d'affilée et les empaquette en zip.
Le recadrage `fit` recule la caméra pour que les bornes de la scène tiennent dans chaque ratio.
Ces bornes se calculent **à partir des groupes enregistrés dans le runtime**, pas d'un parcours
de la scène : les ombres de contact, l'environnement et les gizmos ne sont pas du contenu.
Un cover en mode fond est exclu du calcul puisqu'il suit la caméra.

`renderImage` et l'export vidéo passent tous les deux par `advance()` plutôt que `gl.render`,
pour que le mouvement, les chaînes d'effets et les fonds verrouillés à la caméra se mettent à
jour sur la caméra d'export avant la capture.

## Cover et effets
Un `cover` porte jusqu'à trois `EffectInstance`. Chaque effet de `presets/effects.ts` est un corps
de fragment shader qui reçoit `uv`, `col`, `uTime`, `uResolution`, `uAspect`, le sampler `uMap`,
ses paramètres en `p_<clé>` et ses couleurs en `c_<clé>`. `lib/effectChain.ts` les exécute comme
des passes plein écran successives sur deux render targets en ping-pong.

Un cover en mode `background` écrit lui-même sa `matrixWorld` pour suivre la caméra, ignore le
raycast, et doit rester **opaque** : un matériau transparent passerait dans la file de rendu
tardive et se dessinerait devant la scène.

## Matériaux par couche
Chaque objet a un `material` de base plus des surcharges `parts` indexées par id de mesh.
Les meshes se déclarent au runtime via `setParts`, ce qui alimente la liste de couches des panneaux.
Shift-clic dans le viewport sélectionne une couche. `effectiveMaterial(obj, partId)` résout la surcharge.

## Conventions
- Tout composant qui touche à three.js ou au DOM est `"use client"`.
- Les mutations du projet passent par les actions du store (elles gèrent l'historique). `coalesce=true` pour les sliders.
- Les rotations sont stockées en radians, affichées en degrés.
- Les géométries procédurales sont normalisées dans un cube de 2 unités ; la taille de l'objet est une échelle.
- Ajouter un champ à un objet implique de le gérer dans `normalizeProject` **et** de monter `PERSIST_VERSION`, sinon la migration ne s'exécute pas sur les projets déjà enregistrés.
- L'export vidéo pilote la boucle R3F avec `advance()` de @react-three/fiber, image par image. Le canvas est en `preserveDrawingBuffer` pour que les frames restent lisibles après un await.
- Ce qui ne doit pas apparaître dans un export porte le flag `userData.excludeFromExport` (voir `lib/export.ts`) ; ce qui doit en plus rester net par-dessus le flou et le look porte `userData.overlay`.
- Les modèles importés se chargent par `use(loadModel(id))`. Une promesse **rejetée reste dans le cache** : si on l'oubliait à l'échec, React relancerait un nouveau chargement à chaque rendu, suspendrait dessus, et l'erreur n'atteindrait jamais `ObjectBoundary` (l'objet restait vide sans message). `forgetModel` vide l'entrée quand le fichier est remplacé ou supprimé.
