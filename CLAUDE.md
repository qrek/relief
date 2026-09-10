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

## Scènes enregistrées
Il n'y a plus de templates livrés avec l'app. Le bouton Scenes ouvre la bibliothèque des scènes
que le designer a lui-même enregistrées : le projet sérialisé va dans le champ `data` d'une entrée
IndexedDB de kind `template`, la vignette dans `blob`.

## Caméra et profondeur de champ
`lib/postFx.ts` porte la profondeur de champ, en cinq passes qui travaillent toutes en demi-taille
sauf la dernière : préfiltre, dilatation de la portée du premier plan, collecte du bokeh, filtre
tente, puis recomposition. La recomposition fait sa propre collecte courte à pleine résolution, si
bien que les premiers pixels de flou ne passent jamais par le tampon réduit et que ce qui est net
le reste.

Trois règles apprises à la dure :
- Le disque du pixel et celui du premier plan sont **deux collectes distinctes**. Les fondre dans
  une seule moyenne laisse l'arrière-plan, qui remplit le disque, écraser le premier plan, et la
  silhouette qui devrait fondre ressort découpée avec des points le long du bord.
- Toute grandeur estimée sur des échantillons tirés au hasard doit être une **moyenne**, jamais un
  maximum : un maximum sur des tirages est un pile ou face qui s'imprime en tramé.
- La rotation du disque doit venir d'un **bruit sans structure**. Un motif ordonné, y compris
  l'interleaved gradient noise, transforme la variance de la collecte en réseau visible.

`SceneRenderer` dans le viewport prend la main sur le rendu avec `useFrame(..., 1)`. Une priorité
supérieure à zéro coupe le rendu automatique de R3F et garantit que tout le reste, y compris les
chaînes d'effets des covers, a déjà tourné.

Deux pièges : une passe qui rend à travers une cible ne reçoit **ni tone mapping ni conversion de
couleur**, il faut donc inclure `tonemapping_fragment` et `colorspace_fragment` à la fin du shader.
Mais **pas** leurs déclarations `_pars_`, que three injecte déjà dans un ShaderMaterial.

`staging.sceneScale` dit combien de millimètres vaut une unité de scène. C'est ce réglage qui rend
le macro possible : un sujet d'un centimètre par unité photographié de près donne une profondeur de
champ inférieure au millimètre, exactement comme un vrai objectif. `focusField()` calcule les mêmes
optiques en TypeScript pour que le panneau affiche des chiffres qui correspondent à l'image.

`DepthOfFieldPass.debug` vaut 1 pour la profondeur linéaire, 2 pour le rayon de flou, 3 pour le
bokeh brut avant filtre tente, 4 pour l'image filtrée et 5 pour le masque de premier plan.

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
