# Intro au scroll Écrin Wrap

Ce dossier contient l'animation d'ouverture du site Écrin Wrap. En scrollant, la vidéo s'arrête sur 7 images, chacune avec son explication, et le clip suivant se joue entre deux arrêts. On voit la pose du covering noir mat, puis celle du PPF, le coup de cutter et la rayure qui disparaît à la chaleur.

## Contenu

```
ecrin-scroll-intro/
├── ecrin-intro.js     ← le script (aucune dépendance)
├── ecrin-intro.css    ← les styles (toutes les classes commencent par ew-)
├── demo.html          ← exemple qui marche tel quel
└── assets/
    ├── seq/f001.webp … f450.webp   ← 6 clips × 75 images (1280 px)
    └── kf/k0.webp … k6.webp        ← les 7 arrêts sur image en HD (1920 px)
```

Poids total : environ 19 Mo, chargés progressivement. Les arrêts sur image et une image sur huit arrivent en premier, le reste se complète ensuite.

## Intégration en 3 lignes

1. Copier le dossier `ecrin-scroll-intro/` dans les fichiers publics du site (par exemple `public/` sur Next.js, Vite ou Astro, ou à la racine pour un site HTML).
2. Dans le `<head>` :
   ```html
   <link rel="stylesheet" href="/ecrin-scroll-intro/ecrin-intro.css">
   ```
3. À l'endroit où l'intro doit apparaître, en général tout en haut du `<body>`, juste après le menu :
   ```html
   <section id="ecrin-intro" data-base="/ecrin-scroll-intro/assets"></section>
   <script src="/ecrin-scroll-intro/ecrin-intro.js" defer></script>
   ```

## Réglages

- **Textes :** tableau `STEPS` en haut de `ecrin-intro.js`, un élément par arrêt sur image.
- **Boutons de fin :** les liens `#devis` et `#couleurs` du dernier élément de `STEPS`. Les faire pointer vers les vraies sections du site.
- **Vitesse :** `HOLD` règle la durée de scroll d'un arrêt, `PLAY` celle d'un clip. Ces durées sont en hauteurs d'écran : plus grand veut dire plus lent.
- **Couleur d'accent :** `--ew-red` dans `ecrin-intro.css`.
- **Polices :** l'intro reprend la police du site (`font-family: inherit`).

## Prompt à donner à Claude Code

> J'ai un dossier `ecrin-scroll-intro/` qui contient une intro animée au scroll : `ecrin-intro.js`, `ecrin-intro.css`, `assets/seq/` et `assets/kf/`. Intègre-la tout en haut de la page d'accueil, juste sous le menu, en suivant le README du dossier. Place le dossier dans les fichiers statiques publics du projet et ajuste `data-base` en conséquence. Fais pointer les boutons « Demander un devis » et « Nos réalisations » vers les sections existantes du site. Vérifie que le menu fixe ne recouvre pas les textes et que l'intro fonctionne sur mobile.

Si le site est en React ou Next.js, Claude Code peut transformer le script en composant (un `useEffect` qui appelle la même logique sur une `ref`). Le fonctionnement reste le même.

## Vidéo seule

`ecrin-wrap-intro.mp4` (30 s, 1280×720, sans son) contient les 6 clips à la suite. Elle peut servir pour les réseaux sociaux ou comme version de secours.
