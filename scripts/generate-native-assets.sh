#!/usr/bin/env bash
# Génère les icônes + splash screens iOS / Android à partir des masters resources/*.png
# Usage : bash scripts/generate-native-assets.sh
# Puis : npx cap sync  (les dossiers android/ ios/ récupèrent les assets ci-dessous)
set -euo pipefail
cd "$(dirname "$0")/.."

ICON=resources/icon.png
FG=resources/icon-foreground.png
BG=resources/icon-background.png
SPLASH=resources/splash.png
SPLASH_DARK=resources/splash-dark.png

M=${MAGICK:-magick}

# ---------- ANDROID ----------
AND=resources/android
rm -rf "$AND"
declare -A LAUNCHER=( [mdpi]=48 [hdpi]=72 [xhdpi]=96 [xxhdpi]=144 [xxxhdpi]=192 )
declare -A ADAPTIVE=( [mdpi]=108 [hdpi]=162 [xhdpi]=216 [xxhdpi]=324 [xxxhdpi]=432 )
declare -A SPLASHDP=( [mdpi]=480 [hdpi]=720 [xhdpi]=960 [xxhdpi]=1440 [xxxhdpi]=1920 )

for d in "${!LAUNCHER[@]}"; do
  dir="$AND/mipmap-$d"; mkdir -p "$dir"
  s=${LAUNCHER[$d]}
  $M "$ICON" -resize "${s}x${s}" "$dir/ic_launcher.png"
  $M "$ICON" -resize "${s}x${s}" \
    \( -size "${s}x${s}" xc:none -fill white -draw "circle $((s/2)),$((s/2)) $((s/2)),0" \) \
    -alpha set -compose DstIn -composite "$dir/ic_launcher_round.png"
  a=${ADAPTIVE[$d]}
  $M "$FG" -resize "${a}x${a}" "$dir/ic_launcher_foreground.png"
  $M "$BG" -resize "${a}x${a}" "$dir/ic_launcher_background.png"
done

for d in "${!SPLASHDP[@]}"; do
  s=${SPLASHDP[$d]}
  mkdir -p "$AND/drawable-$d" "$AND/drawable-land-$d" "$AND/drawable-night-$d"
  $M "$SPLASH" -resize "${s}x${s}^" -gravity center -extent "${s}x${s}" "$AND/drawable-$d/splash.png"
  $M "$SPLASH" -resize "$((s*16/9))x${s}^" -gravity center -extent "$((s*16/9))x${s}" "$AND/drawable-land-$d/splash.png"
  $M "$SPLASH_DARK" -resize "${s}x${s}^" -gravity center -extent "${s}x${s}" "$AND/drawable-night-$d/splash.png"
done
mkdir -p "$AND/drawable"
$M "$SPLASH" -resize 2732x2732 "$AND/drawable/splash.png"
mkdir -p "$AND/playstore"
$M "$ICON" -resize 512x512 "$AND/playstore/ic_launcher-playstore.png"
$M "$SPLASH" -resize 1024x500^ -gravity center -extent 1024x500 "$AND/playstore/feature-graphic.png"

# ---------- iOS ----------
IOS=resources/ios
rm -rf "$IOS"; mkdir -p "$IOS/AppIcon.appiconset" "$IOS/Splash.imageset"
$M "$ICON" -resize 1024x1024 -background '#0b1026' -alpha remove -alpha off "$IOS/AppIcon.appiconset/AppIcon-512@2x.png"
for s in 20 29 40 58 60 76 80 87 120 152 167 180 1024; do
  $M "$ICON" -resize "${s}x${s}" -background '#0b1026' -alpha remove -alpha off "$IOS/AppIcon.appiconset/AppIcon-${s}.png"
done
$M "$SPLASH" -resize 2732x2732 "$IOS/Splash.imageset/splash-2732x2732.png"
$M "$SPLASH" -resize 2732x2732 "$IOS/Splash.imageset/splash-2732x2732-1.png"
$M "$SPLASH" -resize 2732x2732 "$IOS/Splash.imageset/splash-2732x2732-2.png"
$M "$SPLASH_DARK" -resize 2732x2732 "$IOS/Splash.imageset/splash-2732x2732-dark.png"

echo "Assets générés dans resources/android et resources/ios"
