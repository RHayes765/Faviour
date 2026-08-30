# Project facts for agents

- **Expo SDK 54 / React Native 0.81** — deliberately pinned so the Play Store
  Expo Go client works as the dev loop. `package.json` is ground truth; use
  the versioned docs at https://docs.expo.dev/versions/v54.0.0/ and do NOT
  upgrade the SDK as a side effect of other work.
- Before any release build: `npx expo-doctor` must pass 18/18, then smoke the
  APK on an emulator before handing it to a person (see README).
- The anon/publishable Supabase key + RLS is the only client credential. The
  service_role/secret key must never appear in this repo or any local file.
