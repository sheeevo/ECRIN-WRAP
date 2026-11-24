# Hero story : l'entrée « garage » pilotée par le scroll

Version de test : **`/preview`** (fichier `preview.dc.html`). Le site public (`/`) n'est pas modifié.

En descendant sur la page, on voit le studio s'allumer, puis le film posé sur la voiture, ensuite les teintes qui défilent (Satin Black, Nardo Grey, Candy Red, Midnight Purple), puis le PPF. La page enchaîne ensuite sur le reste du site, jusqu'au configurateur.

## Les visuels actuels sont provisoires

Tant qu'il n'y a pas de vraies vidéos, chaque étape est dessinée en direct : un garage généré par le code et la M2 détourée depuis `assets/hero-m2.jpg`, puis recolorée. C'est ce qui affiche le badge « Visuel provisoire ». Dès qu'une étape reçoit ses images, elles remplacent automatiquement le provisoire pour cette étape.

## Remplacer par de vraies vidéos

1. Générer un clip par étape avec un outil vidéo IA (Kling, Veo, Runway, Higgsfield…). Les prompts sont plus bas.
   - Format 16:9, 5 à 10 s, caméra lente.
   - Une version 9:16 pour mobile est un plus.
2. Convertir chaque clip en images :
   ```powershell
   powershell -ExecutionPolicy Bypass -File hero-story\make-frames.ps1 -Clip "C:\clips\pose.mp4" -Chapter pose
   ```
3. Coller la ligne affichée par le script dans `CHAPTERS`, en haut de `hero-story.js`.

Il faut garder le même ordre de couleurs que `FILMS` dans `hero-story.js`, sinon l'étiquette affichée ne correspond plus à la couleur de la voiture. On peut aussi modifier `FILMS` (nom, texte, couleur) pour coller aux clips.

**Poids :** environ 90 images par étape à 1600 px de large, soit 4 à 6 Mo par étape. Les images se chargent en arrière-plan, la page reste utilisable pendant ce temps.

## Prompts (à coller tels quels, en anglais)

Ces règles valent pour tous les clips : même voiture, même garage, même angle de départ. Pour que les étapes s'enchaînent, la meilleure méthode est de générer d'abord une **image de référence** (prompt 0), puis de l'utiliser comme image de départ (« image-to-video ») pour chaque clip.

**0 · Image de référence**
> Photorealistic automotive studio photograph. A sports coupe (e.g. BMW M2) parked three-quarter rear view in a dark, high-end car wrapping workshop. Polished dark grey epoxy floor with mirror reflections, rows of long white LED light bars on the black ceiling, matte black walls with a thin red LED accent line, subtle "ECRIN WRAP" lettering on the back wall. Moody, cinematic, 35mm lens, low camera height, 16:9.

**1 · Studio** (les lumières s'allument)
> Same shot. The workshop starts in darkness, then the ceiling LED bars switch on one row after another with a short flicker, revealing the car. Camera static, very slow push-in. Photorealistic, no people.

**2 · Pose** (le film se pose)
> Same shot. A satin black vinyl wrap film is applied across the car body, panel by panel, from front to rear: the film sweeps over the paint with a soft light edge like a squeegee pass, leaving a flawless satin black finish. Slow orbit of the camera, 10 degrees. Photorealistic, no visible hands.

**3 · Teintes** (changement de couleur)
> Same shot, car fully wrapped. The wrap colour transitions smoothly with a light sweep: satin black → Nardo grey gloss → candy red gloss → midnight purple colour-shift (purple to emerald flip). Each colour holds for about two seconds. Slow camera orbit continues. Photorealistic reflections on the floor.

**4 · Protection** (PPF)
> Same shot, car in its original silver paint. A transparent paint protection film is applied: an almost invisible glossy layer sweeps across the body from front to rear, with a thin bright light edge, making the paint deeper and glossier. Camera slowly pulls back. Photorealistic.

## Intégrer au site (quand la version de test est validée)

1. Reporter dans `Ecrin Wrap.dc.html` les modifications de `preview.dc.html`. Elles sont marquées « hero story » :
   - le bloc `#accueil` ;
   - la règle mobile ;
   - le chargement du script dans `componentDidMount` ;
   - `EcrinStory.start()` dans `enter()`.
2. Retirer le raccourci `?ecs-p` de `componentDidMount`, la règle `/preview` de `vercel.json`, et `preview.dc.html`.
3. Traduire les textes en EN/NL : ils sont aujourd'hui en français, dans `hero-story.js`.

Raccourci de relecture : `/preview?ecs-p=0.55` fige l'animation à 55 % et saute l'écran de chargement.
