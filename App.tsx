import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { DataProvider, useData } from './src/context/DataContext';
import { AppNavigator } from './src/navigation/AppNavigator';
import { colors } from './src/theme';

function Root() {
  const { ready, loadFailed, retryLoad } = useData();

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
    <NavigationContainer>
      <AppNavigator />
      <StatusBar style="auto" />
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={styles.flex}>
      <DataProvider>
        <Root />
      </DataProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
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
    color: 'white',
    fontWeight: '600',
    fontSize: 15,
  },
});
