import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { DelivererLoginScreen } from '@/screens/deliverer/DelivererLoginScreen';
import { DelivererDashboardScreen } from '@/screens/deliverer/DelivererDashboardScreen';
import { DelivererOrderDetailsScreen } from '@/screens/deliverer/DelivererOrderDetailsScreen';
import type { DelivererStackParamList } from './types';

const Stack = createNativeStackNavigator<DelivererStackParamList>();

export const DelivererStack: React.FC<{ initialRoute?: keyof DelivererStackParamList }> = ({
  initialRoute = 'DelivererLogin',
}) => (
  <Stack.Navigator initialRouteName={initialRoute} screenOptions={{ headerShown: false }}>
    <Stack.Screen name="DelivererLogin" component={DelivererLoginScreen} />
    <Stack.Screen name="DelivererDashboard" component={DelivererDashboardScreen} />
    <Stack.Screen name="DelivererOrderDetails" component={DelivererOrderDetailsScreen} />
  </Stack.Navigator>
);
