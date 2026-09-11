@AGENTS.md

# Relief

Éditeur 3D no-code dans le navigateur, pour les designers de marque : objets, matières, typographie,
effets, mouvement, mockups packaging et export multi-format.
La spécification complète est dans `FEATURES.md` (section 15 = ordre des phases).

## Stack
- Next.js 16 (App Router, TypeScript, Tailwind 4), React 19.
- three.js + @react-three/fiber + @react-three/drei, zustand (état + persistance localStorage).
- opentype.js pour convertir les TTF de `public/fonts` en typeface JSON (voir `src/editor/lib/ttf.ts`).
- Les modèles 3D (GLB/GLTF/FBX/OBJ) et les médias (images, vidéos) importés sont stockés en IndexedDB, pas en localStorage.
- Backend prévu : Supabase (auth, projets, storage) et déploiement Vercel. Pas encore branchés.

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

Une seule couleur d'accent, `--accent` dans `globals.css` (vert acide pour l'instant), avec
`--accent-ink` pour le texte posé dessus et `--accent-soft` / `--accent-edge` qui en dérivent.
Elle signifie toujours « actif » ou « sélectionné ». Les surfaces restent en `white/5`, `white/10` :
ne pas utiliser de blanc plein comme état actif, passer par ces variables.

## Cinq types d'objets
`SceneObject` est une union : `text` (texte 3D extrudé), `shape` (SVG extrudé), `model` (objet 3D),
`cover` (image ou vidéo avec une pile d'effets), `label` (typographie plate verrouillée sur le cadre).
Un `model` a une `source` soit `procedural` (un preset de `presets/objects.ts` plus ses paramètres),
soit `asset` (un fichier importé, référencé par son id IndexedDB).

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

Tout ce qui bouge est **périodique de période 1/vitesse**, pour qu'un clip de cette durée boucle
sans raccord. Le mouvement des objets utilise `sin(TAU * vitesse * t)`. Les effets reçoivent
`uTime` déjà converti en **angle** (`TAU * vitesse * t`) : un shader animé doit donc être écrit
périodique en `uTime` de période `TAU`. Pour le bruit, on parcourt un cercle
(`vec2(cos(uTime), sin(uTime))`) plutôt que de dériver linéairement.

Le mouvement s'applique sur un groupe interne, pas sur le groupe transformé par le gizmo.

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
pour le look. Le même panneau `EffectStack` sert les deux.

Deux leçons de shader qui complètent celles de la profondeur de champ :
- Une passe qui dessine **toujours** dans une cible ne reçoit pas les fonctions de tone mapping
  de three, qui ne les injecte que pour un tirage à l'écran. Elle doit inclure elle-même
  `tonemapping_pars_fragment`. Les fonctions de transfert de couleur, elles, sont toujours là.
- Dans une trame tournée, le rapport d'aspect s'applique **avant** la rotation à l'aller et
  **après** la rotation inverse au retour. Dans l'autre ordre la grille est cisaillée d'une
  quantité qui dépend de l'angle, et les plaques d'une trame couleur se retrouvent décalées de
  plusieurs cellules les unes par rapport aux autres.

Les aides d'édition (gizmo) sont retirées de l'image avant la profondeur de champ ou le look, puis
redessinées par-dessus le résultat par `drawHelpersOnTop`, pour rester nettes et non tramées.

**Bloom** n'est pas une passe comme les autres : `EffectChain` reconnaît son id et exécute une
pyramide (préfiltre à seuil doux, descente par moitiés, remontée en tente, composition additive)
dans `BloomStage`. C'est ce qui donne une lueur large et sans noyau visible ; la passe unique à
rayon fixe est gardée seulement comme repli. Un shader d'effet ne peut pas faire ça seul, puisqu'il
n'a qu'une passe.

**LED matrix** lit l'image au centre de chaque cellule et pousse la luminosité le long de la
teinte de la diode, jamais vers le blanc ; la saturation force la couleur. Le suivre de Bloom donne
la lueur d'un vrai panneau.

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
- Ce qui ne doit pas apparaître dans un export porte le flag `userData.excludeFromExport` (voir `lib/export.ts`).
