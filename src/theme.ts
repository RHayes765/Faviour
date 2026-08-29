export const colors = {
  primary: '#007AFF',
  like: '#34C759',
  dislike: '#FF3B30',
  background: '#f8f8f8',
  card: '#ffffff',
  border: '#dddddd',
  chipBackground: '#f0f0f0',
  text: '#111111',
  textSecondary: '#333333',
  textMuted: '#666666',
  textFaint: '#999999',
  disabled: '#cccccc',
} as const;

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
