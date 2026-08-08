# Assets natifs — Ligneo Driver (Capacitor)

Masters (à modifier si le branding change) :

| Fichier | Taille | Usage |
| --- | --- | --- |
| `icon.png` | 1024×1024 | Icône principale (iOS + Android legacy) |
| `icon-foreground.png` | 1024×1024 transparent | Calque avant icône adaptative Android |
| `icon-background.png` | 1024×1024 `#0b1026` | Calque arrière icône adaptative Android |
| `splash.png` | 2732×2732 | Splash screen clair |
| `splash-dark.png` | 2732×2732 | Splash screen sombre |

## Régénérer toutes les tailles

```bash
npm run assets:native      # ou: bash scripts/generate-native-assets.sh
```

Génère :

- `resources/android/mipmap-{mdpi…xxxhdpi}/` : `ic_launcher`, `ic_launcher_round`, `ic_launcher_foreground`, `ic_launcher_background` (48→192 px, adaptatif 108→432 px)
- `resources/android/mipmap-anydpi-v26/` : `ic_launcher.xml`, `ic_launcher_round.xml` (icône adaptative)
- `resources/android/drawable*[-land|-night]-{densités}/splash.png` (portrait, paysage, mode sombre)
- `resources/android/playstore/` : icône 512×512 + feature graphic 1024×500
- `resources/ios/AppIcon.appiconset/` : 20→1024 px + `Contents.json`
- `resources/ios/Splash.imageset/` : 2732×2732 @1x/@2x/@3x + variante sombre + `Contents.json`

## Mise en place dans les projets natifs

Après `npx cap add android` / `npx cap add ios` :

```bash
cp -R resources/android/mipmap-*        android/app/src/main/res/
cp -R resources/android/drawable*       android/app/src/main/res/
cp -R resources/ios/AppIcon.appiconset  ios/App/App/Assets.xcassets/
cp -R resources/ios/Splash.imageset     ios/App/App/Assets.xcassets/
npx cap sync
```

Le fond du splash (`#0b1026`) est déjà configuré dans `capacitor.config.ts`.
