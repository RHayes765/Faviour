import {
  DarkTheme as NavDarkTheme,
  DefaultTheme as NavLightTheme,
  NavigationContainer,
} from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import React, { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AuthProvider } from './src/context/AuthContext';
import { DataProvider, useData } from './src/context/DataContext';
import { SyncProvider } from './src/context/SyncContext';
import {
  ThemeProvider,
  useTheme,
  useThemedStyles,
} from './src/context/ThemeContext';
import { AppNavigator } from './src/navigation/AppNavigator';
import type { ThemeColors } from './src/theme';

function Root() {
  const { ready, loadFailed, retryLoad } = useData();
  const { colors, scheme } = useTheme();
  const styles = useThemedStyles(makeStyles);

  const navTheme = useMemo(() => {
    const base = scheme === 'dark' ? NavDarkTheme : NavLightTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: colors.primary,
        background: colors.background,
        card: colors.card,
        text: colors.text,
        border: colors.border,
      },
    };
  }, [scheme, colors]);

  if (loadFailed) {
    return (
      <View style={styles.gate}>
        <Text style={styles.gateTitle}>Couldn&apos;t load your data</Text>
        <Text style={styles.gateText}>
          Your saved items are untouched — loading them just failed. Try again.
        </Text>
        <TouchableOpacity style={styles.retryButton} onPress={retryLoad}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!ready) {
    return (
      <View style={styles.gate}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer theme={navTheme}>
      <AppNavigator />
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={rootStyles.flex}>
      <ThemeProvider>
        <AuthProvider>
          <DataProvider>
            <SyncProvider>
              <Root />
            </SyncProvider>
          </DataProvider>
        </AuthProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

const rootStyles = StyleSheet.create({
  flex: {
    flex: 1,
  },
});

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    gate: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.background,
      padding: 32,
    },
    gateTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
    },
    gateText: {
      fontSize: 14,
      color: colors.textMuted,
      textAlign: 'center',
      marginTop: 8,
    },
    retryButton: {
      marginTop: 20,
      backgroundColor: colors.primary,
      borderRadius: 8,
      paddingHorizontal: 24,
      paddingVertical: 12,
    },
    retryButtonText: {
      color: colors.onPrimary,
      fontWeight: '600',
      fontSize: 15,
    },
  });
