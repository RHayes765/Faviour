// Brand palette derived from the Faviour logo (sampled): deep emerald green,
// pure red, near-black ink on white. Green doubles as the app's primary and
// the "like" color; the rank pill uses ink, echoing the logo's ring.

export interface ThemeColors {
  primary: string;
  onPrimary: string;
  like: string;
  dislike: string;
  likeSoft: string;
  dislikeSoft: string;
  accentSoft: string;
  background: string;
  card: string;
  border: string;
  chipBackground: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  textFaint: string;
  disabled: string;
  rankPillBg: string;
  rankPillText: string;
}

export const lightColors: ThemeColors = {
  primary: '#107C4B',
  onPrimary: '#FFFFFF',
  like: '#107C4B',
  dislike: '#E11B22',
  likeSoft: '#E7F3EC',
  dislikeSoft: '#FBE9E9',
  accentSoft: '#E7F3EC',
  background: '#F7F8F7',
  card: '#FFFFFF',
  border: '#E2E4E3',
  chipBackground: '#EEF1EF',
  text: '#1E1E1E',
  textSecondary: '#3A3D3B',
  textMuted: '#6B706D',
  textFaint: '#9AA09C',
  disabled: '#C9CECB',
  rankPillBg: '#1E1E1E',
  rankPillText: '#FFFFFF',
};

export const darkColors: ThemeColors = {
  primary: '#2FA36B',
  onPrimary: '#FFFFFF',
  like: '#2FA36B',
  dislike: '#EF453F',
  likeSoft: '#15341F',
  dislikeSoft: '#3A1B1B',
  accentSoft: '#15341F',
  background: '#101312',
  card: '#1A1E1C',
  border: '#2E3431',
  chipBackground: '#252A27',
  text: '#ECEFED',
  textSecondary: '#C6CCC8',
  textMuted: '#8F9692',
  textFaint: '#666D69',
  disabled: '#3A403D',
  rankPillBg: '#ECEFED',
  rankPillText: '#101312',
};

export const avatarColors = [
  '#4285F4', '#EA4335', '#FBBC05', '#34A853',
  '#3498DB', '#E74C3C', '#2ECC71', '#F39C12',
  '#9B59B6', '#1ABC9C', '#D35400', '#8E44AD',
] as const;

/** Deterministic color for a profile name (same hash as the legacy app). */
export function profileColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return avatarColors[Math.abs(hash) % avatarColors.length];
}
