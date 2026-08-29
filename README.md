# Faviour

Remember what you (and your family) liked — and why.

Faviour is a mobile app for tracking product verdicts: you're standing in a
grocery aisle wondering "have I tried this brand of wings before?", you open
the app, type three letters or scan the barcode, and get an instant
👍 / 👎 with the reasons.

Primarily built for food, but it works for any product.

## Features

- **Lookup-first home** — recency-sorted list, instant search across name,
  brand, category, and notes; a miss offers one-tap "Add it".
- **Barcode scanning** — scan → verdict (per family member), or prefill a new
  item; UPC-A/EAN-13 formats are normalized so cross-format scans match.
  Unknown barcodes get a best-effort name/brand suggestion from Open Food Facts.
- **The why** — binary like/dislike verdict plus tap-able reason tags
  ("Too salty", "Kids loved it", custom tags) and free-form notes.
- **Photos** — snap the package so you recognize it on the shelf.
- **Profiles** — per-person verdicts for the whole family.

Everything is stored locally on the device (AsyncStorage behind a repository
interface — see below). No account, no cloud, no tracking.

## Development

Expo SDK 57 / React Native 0.86 / TypeScript. Everything runs in **Expo Go** —
no dev build needed.

```
npm install
npx expo start        # scan the QR with Expo Go on your phone
npm test              # jest: storage, migrations, search, barcode utils
npm run typecheck
npm run web           # browser dev surface (camera/photos limited there)
```

## Building the standalone APK

Expo Go stays the dev loop; the standalone APK is what lives on phones
(works offline, no Metro tether). JS changes require a rebuild + reinstall.

```
npx expo prebuild --platform android --clean
cd android
.\gradlew.bat assembleRelease
```

Output: `android\app\build\outputs\apk\release\app-release.apk`. Install with
`adb install -r <apk>` (USB debugging) or share the file and sideload. Bump
`android.versionCode` in app.json for every rebuild so updates install over
prior versions. The release build is signed with the template debug keystore —
fine for sideloading, not for the Play Store. `/android` is generated (CNG)
and gitignored.

## Architecture notes

- `src/storage/repository.ts` — the persistence seam. UI code only talks to
  `FaviourRepository`; AsyncStorage is an implementation detail, so SQLite or
  a cloud backend can replace it later without touching screens.
- `src/storage/migrations.ts` — version-keyed schema migrations
  (`@faviour:meta` holds the schema version).
- `src/context/DataContext.tsx` — thin React state mirror over the repository;
  categories and brands are derived from items, never stored.
- Photos are copied into `documentDirectory/photos/` and referenced by
  **filename only** (absolute paths rot across app updates). Files are cleaned
  up on delete/replace.

## Deliberately out of scope (for now)

- Backend, accounts, sync — the repository seam is the insertion point.
- iOS builds (dev machine is Windows; Expo Go on iPhone would still work).
- Ratings beyond like/dislike — verdict + reason tags + notes is the model.

## History

Faviour succeeds two earlier prototypes (`MyFoodApp`, `OmNom` — bare React
Native CLI, plain JS) archived in `../archive/`.
