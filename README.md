# Ecrin Wrap

Site vitrine (covering / PPF / detailing) — export du projet Claude Design "Ecrin Wrap".

Le site est autonome (aucun build, aucun serveur backend) : `Ecrin Wrap.dc.html` charge
`support.js`, qui charge lui-même React/ReactDOM/Babel depuis un CDN au démarrage,
parse le template et l'affiche. `car-viewer.js` charge three.js depuis un CDN pour le
configurateur 3D.

## Fichiers média manquants (à copier manuellement)

L'outil utilisé pour récupérer le projet Claude Design plafonne à 256 Ko par fichier ;
tous les fichiers ci-dessous dépassent cette limite et n'ont pas pu être téléchargés
automatiquement. Le site fonctionne déjà sans eux (repli CSS pour la voiture, cadres vides
pour les photos), mais pour l'expérience complète, va sur la page du projet dans
Claude Design, télécharge chaque fichier, et place-le au même chemin dans ce dossier :

- `assets/ecrin-logo.png`
- `uploads/svroadster.fbx` (modèle 3D utilisé par le configurateur — ~11 Mo)
- `uploads/Image_1.016-f13b2f11.png` (texture badge)
- `uploads/black-diagonal-carbon-fiber-seamless-texture-pattern-vector.png` (texture carbone)
- `uploads/lamborghini-brand-logo-car-symbol-black-design-italian-automobi-3f8db0e7.jpg` (texture badge)
- Le reste de `uploads/` (fichiers source bruts : `.blend`, `.blend1`, `.obj`, `.mtl`, `.stl`,
  le PDF Avery/Hexis, et les doublons `Image_*.png`) — pas utilisés par le site en marche,
  à copier seulement si tu veux les archiver dans le dépôt.

## Tester en local

```powershell
powershell -ExecutionPolicy Bypass -File serve.ps1
```

Puis ouvre http://localhost:8080/ dans le navigateur (connexion internet requise : les
librairies React / Three.js sont chargées depuis un CDN).
