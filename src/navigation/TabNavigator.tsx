import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import React from 'react';

import { InsightsScreen } from '../screens/InsightsScreen';
import { ItemsScreen } from '../screens/ItemsScreen';
import { ProfilesScreen } from '../screens/ProfilesScreen';
import { colors } from '../theme';
import type { TabParamList } from './types';

const Tab = createBottomTabNavigator<TabParamList>();

export function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarIcon: ({ focused, color, size }) => {
          const name =
            route.name === 'Lookup'
              ? focused
                ? 'search'
                : 'search-outline'
              : route.name === 'Insights'
                ? focused
                  ? 'stats-chart'
                  : 'stats-chart-outline'
                : focused
                  ? 'people'
                  : 'people-outline';
          return <Ionicons name={name} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Lookup" component={ItemsScreen} />
      <Tab.Screen name="Insights" component={InsightsScreen} />
      <Tab.Screen name="Profiles" component={ProfilesScreen} />
    </Tab.Navigator>
  );
}
