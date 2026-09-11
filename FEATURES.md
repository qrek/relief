# Spécification produit — éditeur 3D pour designers de marque

Ce document décrit ce que la plateforme fait et comment elle est construite.
Les premières sections décrivent le périmètre fonctionnel visé au démarrage du projet ;
les sections numérotées à partir de 16 décrivent ce qui est effectivement livré, dans l'ordre.
---

## 1. Stack technique observée (pour reproduire en interne)

| Couche | Ce qu'ils utilisent |
|---|---|
| Front | Next.js (pages router), React, Tailwind, React Three Fiber + drei |
| 3D | three.js (WebGLRenderer, MeshPhysicalMaterial, MeshTransmissionMaterial, ShaderMaterial custom, TransformControls) |
| Texte 3D | troika-three-text (SDF) + fonts converties en JSON de glyphes (~80 fonts embarquées, un chunk par font) |
| Loaders | FBXLoader, OBJLoader, SVGLoader, RGBELoader (HDR), EXRLoader, GLTF |
| Exporters | GLTFExporter (GLB), USDZExporter (AR Apple), export textures (zip via JSZip) |
| Vidéo | WebCodecs VideoEncoder + Mediabunny (muxing MP4 / WebM, codecs avc1/hevc/vp8/vp09/av01). Encodage 100 % navigateur |
| Backend | Supabase : Auth, Postgres + RPC, Storage, Realtime |
| Auth | Email + code OTP, email + mot de passe, WebAuthn/passkeys |
| Paiement | Stripe Checkout + Customer Portal (PRO / Education / Enterprise, top-up crédits IA, achat stockage) |
| IA | fal.ai (client JS) : nano-banana / nano-banana-pro / nano-banana-2 (edit), Seedream 4.5 / 5.0 Pro, GPT Image 2, Grok Imagine, Veo 3.1 fast image-to-video, SeedVR upscale, Bria background remove, Tripo3D h3.1 image-to-3D |
| Shapes externes | API The Noun Project (recherche d'icônes SVG) |
| Fonts externes | Recherche Google Fonts (api.fontsource.org) |
| Analytics / growth | Amplitude, GTM, CookieYes, FirstPromoter (parrainage) |

---

## 2. Concept produit

- Éditeur 3D no-code dans le navigateur pour designers de marque.
- Boucle : choisir un template, explorer matériaux/lumières/effets en temps réel, exporter image / vidéo / embed interactif / AR.
- Un "Unified Editor" : on bascule entre 4 outils (Shapes, 3D Text, Models/Objects, Effects/Cover) en gardant le même style visuel (matériaux, environnement, effets partagés).
- Panels flottants déplaçables partout dans le workspace ; pop-ups déplaçables.

---

## 3. Les 4 outils

### 3.1 Type Tool (texte 3D)
- Saisie de texte, extrusion 3D, profondeur, letter-spacing, leading, weight, size.
- Casse : Uppercase / Lowercase / Caps ; alignement gauche / centre / droite.
- ~80 fonts embarquées (classiques + expérimentales : Inter Tight, Instrument Serif, Old Standard TT, Pinyon Script, Ballet, Bangers, Silkscreen, Jacquard 24, Gaegu, Shojumaru, etc.) + recherche Google Fonts.
- Mode Multiple : ajouter plusieurs textes puis Composition Mode pour les arranger en une scène.

### 3.2 Shape Tool (vecteur vers 3D)
- Upload SVG, extrusion 3D, contrôle depth, bevel / edge smoothness, corner radius, segments.
- Bibliothèque de shapes intégrée + Shape Search (The Noun Project, milliers d'icônes) sauvegardables dans sa librairie.
- Custom Shapes (librairie perso), Multiple + Composition.

### 3.3 Object Tool (modèles 3D)
- Collections curatées d'objets 3D (noms dans le code) : Artifacts (29), BE (12), CP (18), FN (18), Forms of Future (24), Flora (32), Gems (32), Inflated (21), Loops (30), NR (18), Organics (27), Plastic (14), RM (18), ST (24), Simple (24), Soft (21), Sweets (34), Tribal (20) + objets nommés (Ball, Coin, Cube, Knot, Ring, Star, Human Figure, Mushroom, Dragon, Phoenix, Sneakers…).
- Objets ANIMATED (animation intégrée, prévisualisable, exportable en vidéo / embed).
- Objets multi-layer / Multimaterial : matériau différent par couche (clic sur la couche, Shift pour sélectionner, Space+A tout sélectionner).
- Import FBX (et GLB) vers Custom 3D Models. Freeze / unfreeze, hide / show, delete.
- AI Object Creator : image vers 3D ou texte vers 3D (Tripo3D), textured / untextured, styles (Realistic, Cartoon, Low Poly, Organic, Modular, Tech, Simplified…), sauvegarde dans la librairie, téléchargement du modèle.
- Mockups 3D (Canvas AI) : Devices (phone, tablet, laptop, monitor, smartwatch), Packaging (bottle, can, jar, box, tube, pouch, cup, mug), Print & Editorial (poster, magazine cover / spread, book cover, brochure, business card, stationery), Merchandise (hoodie, tote bag, cap, scarf, sticker, embroidered patch, flag), Signage / Outdoor (billboard, bus shelter, storefront, neon sign, street wall, transit advertising, digital kiosk…), Social & Digital (social post on phone, website on laptop, presentation screen, app interface).

### 3.4 Cover Tool (effets image et vidéo)
- Upload image ou vidéo (drag & drop ou Upload Media), ou capture depuis le canvas 3D.
- Effets 2D / shader temps réel sur médias (voir section 6), jusqu'à 3 effets empilés, réordonnables comme des calques, animables.
- Media Library : tout ce qui est généré / uploadé est stocké automatiquement.

---

## 4. Matériaux

- Material Gallery avec collections : Basic, Metal (Metal Basic, Metal Jacket, Chrome, Eggmetal, CarbonX), Glass / Soapy Glass / Liquid Glass / Crystal / Refraction, Plastic, Wood, Stone / Rocks and Stones / Rounded Stones, Fabric / Textile, Wax, Putty, Clay, Membrane, Oil, Watercolor, Risograph, Toon, Gradient, Transparent, etc. Plusieurs centaines de presets nommés (Acid Drops, Aqua, Baby Doll, Beach House, Car Wash, Coral, Death Valley, Disco, Ginger, Holi, Iced Tea, Pink Haze, Shampoo, Watermelon, Yosemite…).
- Dynamic Materials : matériaux procéduraux paramétrables, certains acceptent une image utilisateur comme texture.
- Material Settings (par objet ou par couche) : color, roughness, metalness, bump / bump scale, normal, displacement, opacity, transmission, thickness, IOR, clearcoat (+ roughness), iridescence, attenuation color / distance, specular color, anisotropy, env map intensity, texture scale / tiling / offset X-Y-Z, repeat, seamless / tiled mapping, projection mapping (UVW, triplanar, spherical, cylindrical, box, planar), HDR power.
- Bases : Custom Physical, Custom Transmission, AI Physical, AI Transmission.
- Custom Materials : upload de textures (color map, bump, normal…), création et sauvegarde dans sa librairie.
- AI Material Creator : génération de matériaux PBR par prompt / preset / image de référence, upscale de toutes les maps, téléchargement des textures.
- Le dernier matériau réglé est réappliqué automatiquement aux nouveaux objets.

---

## 5. Scène, staging, caméra

- Environment : collection d'HDRI (Basic Environment, Beach House, Car Wash, Death Valley, Yosemite, Studio, City Light, etc.), rotation d'environnement, intensité.
- Staging : direction de lumière, intensité, ombres on / off, couleur de fond (exportée avec le rendu), fond transparent (alpha).
- Scene Setup : position / rotation / scale précis, zoom, caméra (perspective, FOV), reset composition, axes visibles, gizmos (translate = Space, rotate = R).
- Canvas Format : presets de format et résolution pour image / vidéo / embed (Square, Portrait, Landscape, Story, formats sociaux, custom).
- Layers panel (Scene Items, Scene Text, Shapes, Objects), sélection, show / hide, delete active / delete all.

---

## 6. Visual Effects (post-processing 3D + effets Cover)

Liste extraite du code : Halftone, Kaleidoscope, Pixel Sort, Sobel, Risograph, Bloom, Blur, DOF (depth of field), Glow, Outline, Toon, Lens Distortion, Aberration(s) chromatique(s), Mosaic, Mirror, Tile, Shift (A/B), Stretch, Squeeze, Twist, Spiral, Wave (A/B) / Waves, Ripple, Liquid / Liquidity / Liquid Glass, Melt, Displacement, Fracture, Cell, Voronoi, Data Mask, Rays, Starburst, Raindrops, Drops, Dents, Worms, Chain, Trail, Tumble, Threshold, Glitch, Pixelate, Noise / Grain, Ascii, Projection mapping.
- Contrôles par effet : intensity, frequency, radius in / out, offset, phase, count, matrix X/Y, line X/Y, color in / out, brightness, contrast, saturation…
- Jusqu'à 3 effets combinés, réordonnables, animables, enable / disable, show / hide.

---

## 7. Animation et Video Mode

- Video Mode (Space+V) : crée des animations à partir de l'artwork, export MP4 / WebM avec rendu 100 % client (WebCodecs).
- Timeline avec keyframes (position, rotation, effets), easing (Linear, Bounce, Smooth…), loop / bounce / reverse, speed, playback.
- Objets animés prêts à l'emploi ; animation des effets ; enregistrement (Start / Stop record, Space+R).
- AI image vers vidéo (Veo 3.1 fast) : "Create Video" depuis une image générée.

---

## 8. IA (Endless AI) et crédits

- Crédits IA communs à tous les outils IA, rechargés chaque mois (PRO : 500 / mois), top-up possible, crédits d'équipe (RPC use_team_ai_credits).
- AI Object Creator (Space+G) : text-to-3D, image-to-3D, textured / untextured, styles.
- AI Material Creator (Space+N) : PBR par prompt / preset / référence + upscale.
- Canvas AI (Space+K) : transforme ce qui est visible dans le canvas. Modes : Cinematic Effects, Transform (subject), Place in Scene (intègre un modèle 3D dans une photo), Style Fusion, Visual Direction (Clean Minimal, Dark Cinematic, Brutalist, Editorial, Futuristic, Industrial, Luxury, Playful, Retro, Scandinavian, Raw Documentary, Art Nouveau, Anime…), Camera Setup (Hero Shot, Macro, Aerial, Low Angle, Eye Level, Flat Lay, Wide Shot…), Mockup type (section 3.3), Output restrictions, prompt custom, "Suggest prompt", image de référence de style, choix du modèle (Nano Banana / Pro / 2, Seedream 4.5 / 5.0 Pro, GPT Image 2, Grok Imagine).
- Utilitaires IA : Upscale (SeedVR), Background remove (Bria), AI variations, style presets.
- Tout résultat va dans la Media Library (table assets).

---

## 9. Export

- Image (Space+I) : PNG / JPEG (WebP en interne), jusqu'à 8K (4K en trial), alpha / transparent, sans watermark en PRO, choix de format canvas.
- Copy to clipboard (Space+C) : coller directement dans Figma, etc.
- Vidéo : MP4 / WebM, loops, jusqu'à 60 fps, alpha (WebM).
- USDZ (Space+U) : AR Apple / Quick Look.
- GLB : download du modèle 3D + "Download all textures".
- Embed (Space+X) : embed HTML interactif (iframe /embed/[uuid]), drag to rotate / pinch to zoom, utilisable dans Notion, Framer, Webflow, Readymag. L'embed cesse de fonctionner sans abonnement actif (page /embed/upgrade). "Duplicate the project to enable embedding" pour les templates.

---

## 10. Projets, templates, librairie

- Projects : save (Space+S), rename, duplicate (Space+D), delete, groupes de projets, "Recently viewed", "Trending".
- Templates (/templates, /template/[uuid]) : galerie curatée par catégorie (Background, Logo, Key Visual, Typography, Illustration ; cas d'usage : 3D logo renders, website heroes, product mockups, social assets, interactive embeds, AR, campaign visuals, deck visuals). Preview mode sans abonnement, "Open template" duplique dans ses projets. Un utilisateur peut Convert to Template / Publish / Unpublish son projet et copier le lien template (RPC create_template). Sauvegarde d'assets individuels d'un template (modèle, shape, matériau) dans sa librairie.
- Saved / Library (/saved) : Custom Materials, Custom Objects, Custom Shapes, Favorites, collections perso, Media Library (images / vidéos), quotas de stockage (achat de stockage), "Storage limit exceeded".
- Commentaires sur projet (table project_comments : créer, répondre, déplacer, résoudre, image attachée), mode commenting dans l'éditeur.
- Tutorials (/tutorials) : vidéos par cas d'usage (logo record label, cover magazine, stories Instagram, AR USDZ, embed Framer, embed Notion, halftone stamps, custom material, etc.).
- Report a Bug, Tips and tricks, onboarding tips contextuels, keyboard shortcuts.

---

## 11. Teams

- Créer une team (/team/[name]), slug unique, membres, invitations par email, seats payants ("Add seat"), rôles (Member), projets d'équipe et groupes, saved files d'équipe, crédits IA d'équipe, réglages d'équipe, contexte d'équipe (RPC get_team_context).

---

## 12. Compte, abonnements, growth

- Auth : email + code OTP, mot de passe, passkeys (WebAuthn). Delete account avec confirmation.
- Plans : Free trial 3 jours (10 images 4K, 1 vidéo, démos IA), PRO 20 $/mois annuel ou 24,99 $/mois, Education 9,99 $/mois, Enterprise sur devis. Cycle mensuel / annuel, Stripe Checkout + Portal, "Next payment", "Access until", price update.
- Boutique : Buy AI credits, Buy storage.
- Parrainage (referral links, FirstPromoter), newsletter, gating "Unlock PRO" (features requiresSubscription).
- Légal : Terms, Privacy, Cookie policy (CookieYes).

---

## 13. Raccourcis clavier (extraits du code)

Space = Move, R = Rotate, Shift = select layer, T = multi-objects, Delete / Backspace = delete active,
Space+A select all layers, Space+B media library, Space+C copy to clipboard, Space+D duplicate project,
Space+E environment, Space+G AI object creator, Space+H hide all windows, Space+I export image,
Space+J canvas format, Space+K canvas AI, Space+L staging, Space+M materials, Space+N AI material creator,
Space+P visual effects, Space+R record video, Space+S save, Space+T scene, Space+U USDZ, Space+V video mode,
Space+X embed mode, Space+Z custom materials.

---

## 14. Modèle de données (tables Supabase observées)

profiles, profiles_public, projects, project_groups, project_group_projects, project_shapes, project_models,
project_materials, project_comments, recent_project_views, templates, shapes, models, materials, assets
(media library), saves, team_saves, teams, team_members, spaces, embeds, ai_credits, referral_links.

RPC : create_template, set_project_shapes / models / materials, create / reply / move / update / delete_project_comment,
set_project_comment_image, use_team_ai_credits, get_team_context, touch_last_active.

Buckets storage : templates, saves.

API Next.js : /api/project/create, /api/checkout/*, /api/subscription/portal, /api/subscription/price-update,
/api/team/*, /api/user/update-limit, /api/user/deleteUser, /api/referrals/register, /api/broadcast.

---

## 15. Proposition de découpage pour la version interne

Phase 1 : cœur éditeur
1. Canvas R3F + scène (env HDRI, lumière, fond, caméra, format canvas).
2. Type Tool (texte 3D extrudé, fonts) + Shape Tool (SVG vers 3D).
3. Material Gallery (presets PBR + réglages) + Environment collection.
4. Export PNG / JPEG haute résolution + alpha + copy to clipboard.
5. Sauvegarde projets (Supabase ou équivalent interne), auth.

Phase 2 : objets, effets, vidéo
6. Object Tool (bibliothèque GLB interne, import FBX / GLB, multi-material). **Fait**, voir ci-dessous.
7. Visual Effects (post-processing empilable x3). **Fait** pour les covers, voir section 17.
8. Video Mode (timeline simple, export MP4 / WebM via WebCodecs). **Fait**, voir section 18.
9. Embed interactif (iframe) + USDZ / GLB export.

Phase 3 : IA et collaboration
10. AI object / material / canvas via fal.ai ou équivalent, système de crédits.
11. Templates internes, librairie partagée, teams, commentaires.

---

## 16. Object Tool interne — ce qui est construit (2026-09-10)

### Écart assumé avec les bibliothèques du marché
Les plateformes concurrentes distribuent des centaines d'objets 3D dessinés à la main, sous licence.
La version interne remplace cette bibliothèque par des **objets procéduraux paramétriques** :
chaque objet est généré en code, donc gratuit, sans téléchargement, et surtout réglable
par des sliders (torsion, gonflement, facettes, graine aléatoire, nombre d'éléments).
L'import de fichiers couvre le reste des besoins. Des packs GLB réels pourront être ajoutés
plus tard dans la même interface sans rien changer au modèle de données.

### Bibliothèque procédurale : 51 objets, 6 collections
| Collection | Objets |
|---|---|
| Simple (12) | Cube, Sphere, Cylinder, Cone, Capsule, Torus, Pyramid, Icosahedron, Octahedron, Dodecahedron, Disc, Pipe |
| Loops (8) | Torus Knot, Trefoil, Chain, Spring, Helix Ribbon, Ring Stack, Möbius, Spiral |
| Inflated (8) | Puffy Cube, Pillow, Puffy Star, Balloon, Inflated Ring, Puffy Cross, Puff Heart, Bubbles |
| Organics (8) | Blob, Pebble, Pod, Drop, Coral, Wave, Melt, Seed |
| Gems (7) | Brilliant, Emerald Cut, Marquise, Cabochon, Prism, Crystal, Crystal Cluster |
| Forms (8) | Arch, Column, Steps, Lattice, Twisted Bar, Cross, Ribbon Loop, Wave Panel |

Sept objets sont multi-couches : Chain, Ring Stack, Bubbles, Coral, Crystal Cluster, Column, Steps.

Le moteur de géométrie (`src/editor/lib/geometry.ts`) fournit superquadriques (le curseur qui va
du cube à la sphère à l'étoile), torsion, effilement, déplacement par bruit simplex, facettage,
rubans balayés le long d'une courbe, tours de révolution, et fusion de géométries.

### Import de fichiers
GLB, GLTF, FBX et OBJ, jusqu'à 60 Mo. Le fichier est stocké dans IndexedDB et reste dans la
librairie du navigateur. Le modèle est aplati en couches, ses transformations sont figées, et
il est normalisé dans un cube de 2 unités. Un interrupteur choisit entre les matériaux du
fichier et la galerie de matériaux interne.

### Matériaux par couche
Un objet a un matériau de base plus des surcharges par couche. Shift-clic sur un mesh dans le
viewport, ou un clic dans la liste de couches, cible cette couche seule. Choisir un matériau
sans couche sélectionnée l'applique à tout l'objet et efface les surcharges.

### Reste de l'outil
Vignettes 3D réelles pour chaque objet de la bibliothèque, générées par un rendu hors écran et
mises en cache. Gel d'objet (ni sélectionnable ni déplaçable), masquage, suppression,
duplication. Raccourcis T, S, O pour texte, formes, objets.

### Limites connues
- Les animations contenues dans un GLB ou un FBX sont détectées mais pas jouées.
- Les modèles compressés Draco ou KTX2 ne sont pas décodés.
- Le fichier projet JSON référence les modèles importés par identifiant, il ne les embarque pas.
  Ouvrir un projet dans un autre navigateur affichera les objets importés comme manquants.

---

## 17. Cover Tool interne — ce qui est construit (2026-09-10)

### Principe
Un `cover` est un objet de scène comme les autres : un plan qui affiche une image ou une vidéo,
avec jusqu'à trois effets shader empilés. Il se déplace, tourne et s'exporte comme le reste.

### Médias
Import d'images (PNG, JPG, WebP, GIF, AVIF) et de vidéos (MP4, WebM, MOV) jusqu'à 80 Mo,
stockés dans IndexedDB. Les vidéos jouent en boucle, muettes, et leur image alimente la chaîne
d'effets à chaque frame.

**Capture depuis le canvas** : un bouton rend la scène 3D courante au format du canvas, avec
transparence, en excluant les covers pour éviter la boucle de rétroaction, puis range le résultat
dans la bibliothèque. On peut donc traiter son propre rendu 3D comme un média.

### Mode fond
Un cover peut devenir un fond plein cadre : il suit la caméra, remplit l'image quel que soit le
format, et se place derrière toute la scène. C'est le cas d'usage des fonds de campagne.

### 25 effets, 3 familles
| Famille | Effets |
|---|---|
| Colour (10) | Grade, Duotone, Threshold, Posterize, Halftone, Dither, Risograph, Grain, Edges, Vignette |
| Optical (4) | Blur, Bloom, Aberration, Lens |
| Distort (11) | Pixelate, Mosaic, Wave, Ripple, Twist, Kaleidoscope, Mirror, Tile, Liquify, Glitch, Streak |

Chaque effet a ses propres curseurs et, quand c'est pertinent, ses couleurs. Les effets qui
bougent (Wave, Ripple, Twist, Kaleidoscope, Liquify, Glitch, Grain) ont un curseur de vitesse ;
à zéro l'image est figée. Chaque effet tourne sur sa propre horloge.

### Pile d'effets
Trois maximum. Réordonnables, désactivables un par un, réinitialisables.
L'ordre change le résultat : un halftone puis un twist ne donne pas la même chose que l'inverse.

### Implémentation
Chaque effet est un corps de fragment shader inséré dans un gabarit commun. La chaîne les exécute
comme des passes plein écran successives sur deux render targets en ping-pong, à la résolution du
média plafonnée à 2048 px. Une passe par effet, donc le flou et la détection de contours peuvent
échantillonner leur voisinage correctement, ce qu'une passe unique ne permettrait pas.

### Limites connues
- Pas de timeline à keyframes : l'animation se règle par un curseur de vitesse par effet.
- La chaîne travaille à la résolution du média, donc un export très grand agrandit ce résultat.
- Les effets s'appliquent aux covers, pas encore à toute la scène 3D en post-traitement.
- (Mise à jour du 2026-09-10 : 49 effets désormais, voir section 19.)

---

## 18. Mouvement et export vidéo — ce qui est construit (2026-09-10)

### Une horloge unique
`lib/clock.ts` fournit le temps à tout ce qui bouge. En direct elle suit le temps réel ; pendant
un export elle est épinglée sur des temps d'image exacts. Chaque frame est donc rendue au temps
voulu, pas au rythme du navigateur, et l'export est reproductible.

### Mouvement des objets
Sept préréglages, disponibles sur tous les types d'objets : Still, Spin, Tumble, Float, Orbit,
Swing, Pulse. Réglages : vitesse en cycles par seconde, amplitude, axe, et un décalage de phase
pour désynchroniser plusieurs objets. Pas de timeline à keyframes, volontairement : c'est le même
esprit que les curseurs de vitesse des effets.

Le mouvement s'applique sur un groupe interne, donc la poignée de transformation continue de
piloter la position de base sans conflit.

### Boucle sans raccord
Tout est périodique de période 1/vitesse. Le mouvement des objets utilise des sinusoïdes ; les
effets animés reçoivent leur temps sous forme d'angle et ont été réécrits pour être périodiques,
y compris ceux à base de bruit : Liquify parcourt un cercle dans le champ de bruit au lieu de
dériver, Glitch et Grain tirent un nombre fini d'états par cycle.

Le panneau d'export calcule la durée qui referme tous les cycles de la scène, mouvement et effets
confondus, et propose de la régler en un clic. Quand les vitesses n'ont pas de cycle commun, il le
dit au lieu de faire semblant.

Mesuré sur une scène animée : l'écart entre la première et la dernière image d'une boucle est de
0.96 sur 255, contre 23.45 au milieu du cycle. Le raccord est invisible.

### Export vidéo
MP4 en H.264 et WebM en VP9, encodés dans le navigateur via WebCodecs et muxés par mediabunny.
Rien ne sort de la machine. Réglages : durée jusqu'à 30 secondes, 24 / 25 / 30 / 60 images par
seconde, échelle du format de canvas, quatre niveaux de qualité. Barre de progression et
annulation. Les dimensions sont arrondies au pair, requis par H.264.

Repère de performance : un clip carré de 2 secondes en 720 px à 30 images par seconde s'encode en
2,2 secondes. Un format story de 2 secondes en 1080 par 1920 pèse environ 3 Mo.

### Limites connues
- Pas de timeline : l'animation se règle par préréglage et vitesse, sans courbes ni séquence.
- Pas de piste audio.
- Pas d'export vidéo avec alpha : WebCodecs ne le gère pas de façon fiable selon les navigateurs.
- La caméra ne s'anime pas encore, seuls les objets et les effets bougent.

---

## 19. Multi-format, social et 49 effets (2026-09-10)

### Export multi-format
On coche plusieurs formats et on lance un seul rendu : chaque format est produit puis empaqueté
dans un zip. Vaut pour l'image comme pour la vidéo, avec une barre de progression qui indique le
format en cours.

Deux modes de cadrage. **Refit** recule la caméra pour chaque ratio afin que rien ne sorte du
cadre : une idée, plusieurs formes, aucune recoupe. **Keep** garde la caméra exactement où elle
est, donc les formats larges révèlent plus et les formats hauts montrent moins. Refit est le
défaut, c'est celui qui sert à décliner une campagne.

Les bornes de la scène ne comptent que les objets du projet. Les ombres de contact,
l'environnement et les poignées ne sont pas du contenu et fausseraient le cadrage.

### Formats et zones de sécurité
Treize formats rangés en Social, Web et Print : carré, portrait 4:5, story et reel 9:16,
paysage 16:9, Pinterest 2:3, LinkedIn, miniature, Open Graph, hero 21:9, A4, affiche, et custom.

Un bouton **Safe** superpose les marges que l'interface de la plateforme recouvre : légendes,
pseudo, boutons. Sur une story, cela retire treize pour cent en haut et vingt pour cent en bas.
C'est un repère d'écran, jamais exporté.

### 49 effets
Vingt-quatre nouveaux s'ajoutent aux vingt-cinq précédents, en quatre familles.

| Famille | Effets |
|---|---|
| Colour (19) | Grade, Duotone, Threshold, Posterize, Halftone, Dither, Risograph, Grain, Edges, Vignette, Gradient Map, Hue Shift, Solarize, Crosshatch, Scanlines, CRT, Newsprint, Sharpen, Diffusion |
| Optical (8) | Blur, Bloom, Aberration, Lens, Zoom Blur, Motion Blur, Tilt Shift, Anamorphic |
| Distort (19) | Pixelate, Mosaic, Wave, Ripple, Twist, Kaleidoscope, Mirror, Tile, Liquify, Glitch, Streak, Squeeze, Spiral, Slice, Cells, Shatter, Drops, Worms, Displace |
| Alpha (3) | Sticker, Drop Shadow, Edge Glow |

La famille Alpha travaille sur la découpe du média : contour de sticker, ombre portée et halo
lumineux autour de la silhouette. Elle prend tout son sens sur une capture du canvas 3D, qui
arrive avec sa transparence.

Le préambule de shaders partagé s'est enrichi : conversion RVB vers TSV, hachures, trame
d'impression rotative par couche, cellules de Voronoï, et portée alpha pour les contours.

### Vérifications
Les 49 effets compilent sans erreur de shader. 48 modifient l'image dès l'ajout ; le
quarante-neuvième est Grade, neutre par défaut puisque c'est un outil d'étalonnage.
L'export multi-format produit quatre images cohérentes et deux vidéos qui se décodent aux bonnes
dimensions.

### Limites connues
- Les effets s'appliquent aux covers, pas encore à la scène 3D entière en post-traitement.
- Le cadrage Refit garde la direction de la caméra et ne recompose pas, il recule seulement.
- Les zones de sécurité sont des valeurs moyennes, les plateformes changent leur interface souvent.

---

## 20. Templates (2026-09-10)

### Pourquoi
Jusqu'ici on démarrait face à une scène vide. Partir d'une scène toute faite est le premier pas
de la boucle de création, et c'était ce qui manquait le plus pour obtenir un résultat vite.

### Douze scènes prêtes
Rangées en six catégories : Logo, Typography, Product, Social, Motion, Media.

| Template | Ce qu'il montre |
|---|---|
| Chrome Logo | Une forme SVG extrudée en chrome qui tourne, prête à recevoir votre logo |
| Knot Hero | Nœud holographique en 16:9, paramètres de forme exposés |
| Liquid Type | Typographie en verre liquide sur fond crépusculaire |
| Deck Cover | Couverture de présentation, titre en serif et anneaux métal |
| Gem Study | Grappe de cristaux facettés, taillée pour le packshot |
| Gold Monolith | Colonne à trois matériaux distincts, une par couche |
| Soft Pastel | Trois volumes gonflés qui flottent en décalé |
| Neon Grid | Treillis émissif et typo néon |
| Sticker Pack | Cœur et étoile bouffis sur fond rose, pensé pour la découpe |
| Organic Loop | Boucle de deux secondes en 9:16, prête à exporter en Reel |
| Editorial Halftone | Emplacement média avec halftone bleu nuit déjà réglé |
| Retro CRT | Emplacement média plein cadre avec CRT et grain |

### Emplacements média
Deux templates contiennent un cover **sans média mais avec sa pile d'effets déjà réglée**. On
dépose une image ou une vidéo et le look apparaît sans rien toucher. Tant que l'emplacement est
vide, il s'affiche comme un cadre explicite dans la scène plutôt qu'un rectangle sombre.

### Templates personnels
Un bouton enregistre la scène courante comme point de départ réutilisable : le projet sérialisé
et sa vignette partent dans IndexedDB, et l'onglet Mine les rouvre. Vérifié de bout en bout :
enregistrer, vider la scène, rouvrir, tout revient avec les mouvements et le format.

### Aperçus
Les vignettes sont des images figées, générées une fois dans le navigateur **au format propre de
chaque template** puis livrées dans `public/templates`. La galerie les affiche sans recadrer, si
bien que la vignette annonce aussi le format visé. C'est plus fidèle qu'un rendu générique et ça
ne coûte rien à l'ouverture.

### Limites connues
- Modifier un template en code impose de régénérer son aperçu à la main.
- Ouvrir un template remplace la scène courante après confirmation, il n'y a pas de multi-projet.
- Les templates ne peuvent pas embarquer de média, puisque les fichiers vivent par navigateur.

---

## 21. Décision sur l'IA (2026-09-10)

Pas d'intégration d'API de génération. Meshy exporte du GLB, du FBX et de l'OBJ, Higgsfield
exporte du MP4 : ces quatre formats entrent déjà dans l'outil par l'import de modèles et par la
bibliothèque de médias. On génère ailleurs, on dépose ici, et tout le travail de matière, de
lumière, d'effets, de mouvement et d'export multi-format s'applique ensuite.

---

## 22. Typographie plate, placage de logo et mockups (2026-09-10)

### Typographie plate
Un cinquième type d'objet, le `label`, pose du texte **sur le cadre** et non dans la scène. Il ne
tourne pas quand on met la caméra en orbite et il reste à la même place dans tous les formats,
ce qu'une accroche de mise en page doit faire. Réglages : police, taille en pourcentage de la
hauteur du cadre, couleur, opacité, alignement, casse, interlettrage, interligne, position sur le
cadre et inclinaison. Raccourci L.

Le texte 3D extrudé reste disponible pour les logos et les titres en volume. Les deux cohabitent :
le volume dans la scène, la typo plate par-dessus.

### Placage de logo
`material.artwork` imprime une image sur une surface. L'image et la couleur du matériau sont
composées dans un canvas, puis posées comme texture : la surface reste opaque, comme une vraie
étiquette imprimée. Contrôles : échelle, position autour et en hauteur, rotation, nombre de tours,
et un mode motif qui répète l'image au lieu de la poser une fois.

Comme c'est une propriété de matériau, cela fonctionne **par couche** : le logo sur le corps du
pot, rien sur le couvercle.

### Packaging
Huit objets pensés pour porter une étiquette : Can, Bottle, Jar, Tube, Carton, Pouch, Mug, Card.
Ils sont construits en tours de révolution ou en boîtes, parce que leurs UV font un tour complet
du côté : une image posée en artwork se comporte alors comme une étiquette qui s'enroule.
Jar, Tube et Mug sont multi-couches.

### Templates
Dix-sept au total, avec des tags. Cinq nouveaux : Can Mockup, Bottle Shot, Box Set, Poster Mark,
Billboard. Les deux derniers sont des mises en page composées, typographie plate sur le cadre et
un objet au centre, dans l'esprit des affiches et de l'affichage grand format.

### Limites connues
- Le placage suit les UV de l'objet. Sur une forme sans UV propre, il faut ajuster à la main.
- Pas de décalque libre posé au clic sur une surface arbitraire.
- La typographie plate n'a pas de bloc de texte avec retour à la ligne automatique.


---

## 23. Renommage, retrait des templates, caméra (2026-09-10)

### Relief
La plateforme s'appelle Relief. Le mot dit ce que fait l'outil dans les deux langues : le texte
extrudé, l'impression en relief, la matière qui prend du volume. Le renommage couvre l'interface,
les métadonnées, la clé de sauvegarde locale et l'extension des fichiers projet. La base IndexedDB
change de nom et reprend automatiquement le contenu de l'ancienne au premier lancement.

### Templates retirés
Les douze scènes livrées n'étaient pas au niveau : des objets isolés sur des fonds plats, sans
profondeur ni direction artistique. Elles sont supprimées. Le bouton devient **Scenes** et ne
contient plus que les scènes que le designer enregistre lui-même, ce qui reste utile.

### Caméra
La focale remplace le champ de vision : on règle en millimètres sur un capteur plein format, avec
une indication de ce que donne un grand angle ou un téléobjectif.

### Profondeur de champ
Le flou est calculé sur trois échelles, chacune à la taille qu'elle peut se permettre.

La scène part dans une cible en demi-flottant, ce qui garde vivantes les hautes lumières au-dessus
du blanc. Un préfiltre réduit l'image de moitié en conservant le cercle de confusion le plus fort
des quatre pixels source. En demi-résolution, une collecte de quatre-vingt-seize échantillons sur
un disque à angle d'or, tourné d'un angle différent sur chaque pixel et découpé par les lames du
diaphragme, donne ce que chaque pixel voit à travers son propre cercle ; un filtre tente dont la
largeur suit le rayon local efface la variance restante.

Le premier plan est traité à part, au quart de résolution. Une dilatation séparable établit jusqu'où
il peut déborder, puis soixante-quatre échantillons ramassent sa couleur et sa couverture. À cette
taille chaque texel lu est déjà une moyenne de seize pixels, ce qui est exactement ce qu'il faut
pour une couche qui est par définition la plus floue de l'image. La couche est gardée prémultipliée
par sa couverture et remontée par un filtre tente, pour que ni le noir des texels vides ni la grille
du quart ne se voient.

La recomposition mélange trois niveaux : l'image d'origine là où c'est net, sa propre collecte
courte à pleine résolution juste après, le tampon demi au-delà, et pose enfin le premier plan
par-dessus le tout. Rien de net n'est jamais construit à partir d'une image agrandie.

### Mise au point réelle et macro
- **Pull focus** : un clic dans le cadre met au point sur le point exact sous le curseur, à la
  distance réellement touchée, comme un assistant caméra qui repère un comédien.
- **Subject size** : combien de millimètres vaut une unité de scène. C'est ce qui distingue une
  nature morte d'un macro. Un sujet à un centimètre par unité, photographié de près, donne une
  profondeur de champ inférieure au millimètre.
- **Lecture optique** : le panneau affiche les bornes de netteté, l'épaisseur du champ, le rapport
  de grandissement avec la mention macro, et l'hyperfocale. Il prévient quand la mise au point
  demandée est plus proche que la focale, ce qu'aucun objectif ne sait faire.
- Ouverture de f/0.8 à f/22, lames de diaphragme de 5 à 9, angle du diaphragme, et un réglage
  d'intensité des hautes lumières dans le bokeh.

### Limites connues
Un premier plan flou de moins de six pixels ne passe pas par la couche au quart : sa silhouette
reste celle que donne la collecte ordinaire, un peu plus franche qu'elle ne devrait. À cette
échelle de flou l'écart n'est pas lisible, et l'envoyer dans un tampon quatre fois plus petit
coûterait plus qu'il ne rapporterait.

## 24. Look, type derrière la scène, premier template

### Look
Une pile d'effets sur l'image entière, dans son propre onglet Look. Le panneau de droite a été
réorganisé pour lever la confusion entre effets et mise en scène : Object, puis Material ou Effects
selon que la sélection est un solide ou une image, puis Scene, Look, Export. La limite de trois
effets par pile est remplacée par une borne de vingt-quatre, avec un rappel du coût au-delà de six. Les quarante-neuf effets des covers
s'appliquent désormais aussi au cadre fini, type et objets confondus, après la profondeur de champ.
Un nouvel effet, **Colour halftone**, reproduit une trame quatre couleurs de presse : quatre
plaques aux angles classiques, chaque point dimensionné par la quantité d'encre que l'image demande,
multipliées sur le papier. Un seuil garde le papier vierge là où un vrai tirage n'imprime rien.

### Typographie plate derrière la scène
Un texte plat peut se poser au fond de la pièce : les objets passent devant lui. C'est ce qui permet
le titre d'affiche qu'un sujet recouvre.

### Aides d'édition
Le gizmo n'est plus flouté ni tramé : il est retiré de l'image avant les passes et redessiné net
par-dessus.

### Template « Like no one »
Le premier template livré depuis la suppression de la série précédente. Une affiche portrait :
titre en trois lignes, bleu de presse, derrière un galet jaune à facettes, le tout tramé et grainé.
Il a été construit d'après une référence d'affiche riso et jugé à la taille d'export, en six
itérations, avant d'entrer dans la liste. Il apparaît en tête de la bibliothèque Scenes et se charge
d'un clic.

## 25. Lueur, panneau LED, chrome liquide

### Bloom refait
Le glow n'était qu'une passe de flou unique à rayon fixe : il ne pouvait ni s'étendre ni rester
lisse. Bloom est maintenant une pyramide : ce qui dépasse le seuil, avec un genou doux, descend par
moitiés successives et remonte avec un filtre tente à chaque étage, puis s'ajoute à l'image. La
lueur s'étend aussi loin que demandé sans jamais montrer de noyau. Elle sert aux covers comme au look.

### LED matrix
Nouvel effet : un panneau de diodes rondes. Chaque cellule lit l'image en son centre et s'allume de
cette couleur ; sous le seuil la diode reste éteinte et visible, comme un vrai panneau ne descend
jamais au noir pur. La luminosité est poussée le long de la teinte, jamais vers le blanc.

### Typographie plate centrée ligne par ligne
Chaque ligne d'un texte plat est composée séparément, donc un texte centré ou aligné à droite
l'est sur chaque ligne, pas seulement en bloc.

### Deux templates de plus
- **Open sign** : un mot en diodes vertes sur panneau noir, avec la lueur d'un vrai panneau. Carré.
- **Carpe feed** : une masse de chrome liquide sur papier, titre condensé en haut, petites lignes
  en bas. Portrait. Le bloom y ne sert qu'à faire respirer les reflets.

## 26. Polices : import et Google Fonts

Le sélecteur de police est un vrai panneau à trois sources, recherche en tête.

- **Yours** : importer un fichier TTF ou OTF, la police de marque du client. Elle est stockée dans
  le navigateur comme un modèle importé et ne quitte pas la machine. Le fichier est vérifié à
  l'import.
- **Google Fonts** : les 1 946 familles du catalogue, les plus utilisées en tête, par catégorie, avec
  le choix de la graisse. Les noms s'affichent dans leur propre dessin. Aucune clé, aucun compte :
  le serveur demande à Google le fichier TrueType et le relaie ; la police est ensuite gardée sur
  la machine. Licences libres, usage et export sans restriction.
- **Built in** : les treize polices livrées.

Limite connue : les polices variables sont servies en graisses fixes, on choisit une graisse, pas un
curseur continu.

## 27. Lumière

### Plusieurs lumières
La lumière unique devient une liste : soleil, spot ou point, chacune nommée, avec sa couleur, son
intensité, son azimut et sa hauteur autour du sujet, sa distance pour un spot ou un point, son cône
et la douceur de son bord pour un spot. Quatre rigs mettent un dispositif classique en place d'un
clic : studio trois points, softbox au-dessus, soleil rasant, paire de rims chaude et froide.

### Ombres portées
Chaque lumière peut porter une vraie ombre, sur les objets et sur un sol invisible à la hauteur du
plancher, avec une douceur propre. Les ombres de contact d'avant restent disponibles à côté.

### Environnement importé
Un fichier `.hdr` ou `.exr`, ou une image équirectangulaire, s'importe et sert d'éclairage et de
fond comme les presets. Il est stocké dans le navigateur.

### Logo
Une marque pour Relief : une colline dessinée en courbes de niveau, comme le relief sur une carte,
dans la couleur d'accent. Dans la barre et dans l'onglet du navigateur.
