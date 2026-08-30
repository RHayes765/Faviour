import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type ImageSourcePropType,
} from 'react-native';

import { useThemeColors, useThemedStyles } from '../context/ThemeContext';
import type { ThemeColors } from '../theme';

interface Props {
  icon: keyof typeof Ionicons.glyphMap;
  /** When set, renders this image instead of the icon (e.g. the app logo). */
  image?: ImageSourcePropType;
  title: string;
  subtitle?: string;
  buttonLabel?: string;
  onButtonPress?: () => void;
}

export function EmptyState({ icon, image, title, subtitle, buttonLabel, onButtonPress }: Props) {
  const styles = useThemedStyles(makeStyles);
  const colors = useThemeColors();
  return (
    <View style={styles.container}>
      {image ? (
        <Image source={image} style={styles.image} />
      ) : (
        <Ionicons name={icon} size={56} color={colors.disabled} />
      )}
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {buttonLabel && onButtonPress ? (
        <TouchableOpacity style={styles.button} onPress={onButtonPress}>
          <Text style={styles.buttonText}>{buttonLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 100,
  },
  image: {
    width: 96,
    height: 96,
    opacity: 0.9,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textMuted,
    marginTop: 16,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: colors.textFaint,
    textAlign: 'center',
    marginTop: 8,
    marginHorizontal: 32,
  },
  button: {
    marginTop: 24,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: colors.primary,
    borderRadius: 8,
  },
  buttonText: {
    color: colors.onPrimary,
    fontWeight: '500',
  },
});
