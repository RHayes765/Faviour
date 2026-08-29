import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';

import { AddItemScreen } from '../screens/AddItemScreen';
import { ItemDetailScreen } from '../screens/ItemDetailScreen';
import { ScanScreen } from '../screens/ScanScreen';
import { TabNavigator } from './TabNavigator';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function AppNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="Main"
        component={TabNavigator}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="AddItem"
        component={AddItemScreen}
        options={{ title: 'Item' }}
      />
      <Stack.Screen
        name="Scan"
        component={ScanScreen}
        options={{ title: 'Scan Barcode' }}
      />
      <Stack.Screen
        name="ItemDetail"
        component={ItemDetailScreen}
        options={{ title: 'Item' }}
      />
    </Stack.Navigator>
  );
}
