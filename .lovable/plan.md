
# Refonte système de notifications — expérience native premium

Périmètre strictement front / présentation. Aucune modification de la logique métier, des tables, des edge functions push, du service worker FCM, des permissions ou des workflows existants. Rétrocompatible : chaque `toast(...)`, `create_user_notification`, push web continue de fonctionner tel quel.

## 1. Toaster (bandeau in-app) — refonte totale

Fichier `src/components/ui/sonner.tsx` réécrit autour de `sonner` (déjà installé, aucun changement de dépendance).

- **Fond opaque** premium (plus jamais transparent) : navy profond `#0b1026` / cream `#fdfcf8` selon type. Effet glassmorphism léger (backdrop-blur discret) via `backdrop-blur-xl` Tailwind + fallback opaque.
- **Coins arrondis** 18 px, **ombre portée** douce et colorée selon type, bordure fine 1 px `border-white/10`.
- **Icône typée** à gauche (cercle 40 px accent), **titre** semi-bold + **message** court + **timestamp** ("à l'instant", "il y a 2 min") + **action rapide** optionnelle (bouton Voir / Ouvrir).
- **Barre d'accent verticale** 3 px à gauche, couleur selon type.
- **Animations** : slide-in-down (mobile) / slide-in-right (desktop), fade-out + scale, 60 FPS via `transform`/`opacity` uniquement (CSS Tailwind, jamais framer-motion — contrainte projet).
- **Swipe-to-dismiss** (activé nativement par sonner sur mobile, on l'expose).
- **Positionnement responsive** : `top-center` en < 768 px, `top-right` en desktop, `expand` pour empilement propre, `visibleToasts: 4`, `gap: 12`.
- **Vibration légère** (`navigator.vibrate([10, 30, 10])`) déclenchée pour types `warning` / `error` / `nouvelle_mission` si `matchMedia('(pointer:coarse)')` ET permission ok — silencieux côté desktop.
- **Son discret** optionnel : petit `<audio>` préchargé, jouable si l'utilisateur a activé la préférence (nouveau flag `sound` dans `notification_preferences` déjà présent en DB, réutilisé).

### Helper unifié `notify`

Nouveau `src/lib/notify.ts` — enveloppe fine autour de sonner exposant :

```ts
notify.info(titre, opts?)
notify.success(titre, opts?)
notify.warning(titre, opts?)
notify.error(titre, opts?)
notify.mission(titre, opts?)      // 🟣 nouvelle mission
notify.convoyage(titre, opts?)    // 🚗
notify.document(titre, opts?)     // 📄
notify.paiement(titre, opts?)     // 💳
notify.avis(titre, opts?)         // ⭐
notify.rappel(titre, opts?)       // 🔔
```

`opts` : `{ description?, action?: { label, onClick | href }, duration?, priority? }`.

Les appels existants `toast.success(...)` / `toast.error(...)` **continuent de fonctionner** (sonner reste la lib) — le nouveau helper est adopté progressivement sans casse.

## 2. Cloche & dropdown — refonte visuelle

`src/components/notifications/NotificationBell.tsx` :

- Panneau dropdown en **glass premium navy** (plus le fond blanc actuel) cohérent avec la charte : `bg-[#0b1026]/95 backdrop-blur-xl border-white/10`, cream pour les lignes non lues, tokens dorés pour badges.
- Icônes par catégorie (Truck, CreditCard, FileText, MessageSquare, Star, Bell) dans une pastille 36 px avec couleur d'accent typée.
- Timestamp relatif ("à l'instant", "il y a 5 min", puis date courte).
- Ligne non lue : liseré doré gauche + point néon.
- Animation ouverture `scale-in` + `fade-in`, focus-trap léger, fermeture ESC.
- Aucune régression realtime : le hook `useEffect` + channel Supabase reste identique.

## 3. Centre de notifications `/notifications`

`src/routes/_authenticated/notifications.tsx` :

- Cartes redessinées façon Revolut : icône typée, accent gauche coloré, chip catégorie, chip priorité, timestamp relatif, actions (Voir / Marquer / Supprimer) en boutons pilules discrets.
- Filtres restylés : onglets pilules dans une barre glass, compteur non lues par onglet.
- Recherche debounced (300 ms) avec icône, focus-ring accent bleu néon.
- Sélection multiple : cases custom, barre d'actions flottante en bas quand sélection ≥ 1 (Marquer / Supprimer / Annuler).
- Empty state illustré (icône Bell XXL + texte encourageant).
- Regroupement par date : "Aujourd'hui", "Hier", "Cette semaine", "Plus ancien".
- Les mutations (mark read / delete / mark all) restent inchangées.

## 4. Bridge push web → toast

Dans `src/lib/push/client.ts` (si présent), on écoute déjà les messages FCM en foreground ; on ajoute simplement un `notify.<type>()` selon `data.category` reçu du push, pour que les notifications reçues quand l'onglet est ouvert apparaissent aussi comme bannières in-app cohérentes (au lieu d'être silencieuses). Le service worker `firebase-messaging-sw.js` (background) reste **strictement intact** — contrainte PWA.

## 5. Design tokens

Dans `src/styles.css`, ajout de tokens dédiés (ne remplace rien) :

```css
--notif-info: oklch(...);      /* bleu électrique */
--notif-success: oklch(...);   /* vert */
--notif-warning: oklch(...);   /* ambre */
--notif-error: oklch(...);     /* rouge */
--notif-mission: oklch(...);   /* violet */
--notif-convoyage: oklch(...); /* néon bleu */
--notif-document: oklch(...);
--notif-paiement: oklch(...);
--notif-avis: oklch(...);
--notif-rappel: oklch(...);
--shadow-notif: 0 20px 40px -20px rgb(0 0 0 / 0.35);
```

Palette conforme à la mémoire projet : navy dominant, cream pour surfaces claires, doré/néon bleu pour accents. Jamais de blanc pur, jamais de purple générique.

## 6. Accessibilité & perf

- Contraste AA vérifié sur chaque type (texte cream sur navy + accent).
- `role="status"` pour info/success, `role="alert"` pour warning/error.
- Animations en `transform`/`opacity` uniquement, `will-change` ciblé.
- Respect de `prefers-reduced-motion` : bascule sur fade court sans slide.
- `aria-live="polite"` géré par sonner.

## 7. Compatibilité stricte

- Toutes les tables (`user_notifications`, `notification_preferences`, `push_subscriptions`) intactes.
- Toutes les server fns (`notify.functions.ts`, `push.functions.ts`, `push/notify.functions.ts`) intactes.
- Aucune modification RLS, aucun trigger touché.
- Le service worker FCM et les hooks push existants ne sont pas modifiés.
- Toute la centaine d'appels `toast.*(...)` existants continuent d'afficher un toast — visuellement amélioré automatiquement.

## Livraison

1. Tokens CSS + réécriture `sonner.tsx` (bandeau premium, config responsive, vibration, son opt-in).
2. Helper `src/lib/notify.ts` (10 types typés).
3. Refonte `NotificationBell.tsx` (glass navy premium, timestamps relatifs, icônes typées).
4. Refonte `/notifications` (cartes premium, groupement date, sélection multiple, empty state).
5. Bridge push foreground → `notify.*`.
6. Vérif build + parcours visuel rapide (bell, centre, toast test dans MobileHomeScreen).

## Question avant lancement

Aucune si tu valides — la logique métier ne bouge pas. Dis-moi juste si tu veux :
- (a) **son + vibration activés par défaut** (opt-out dans `notification_preferences`), ou
- (b) **désactivés par défaut** (opt-in explicite depuis le centre de notifications).
