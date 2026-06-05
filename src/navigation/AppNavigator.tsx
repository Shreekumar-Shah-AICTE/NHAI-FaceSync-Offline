/**
 * NHAI FaceSync Offline — App Navigation Stack
 * Handles transitions between Home, Enrollment, and Verification screens.
 */

import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { HomeScreen } from '../screens/HomeScreen';
import { EnrollmentScreen } from '../screens/EnrollmentScreen';
import { VerificationScreen } from '../screens/VerificationScreen';
import { DiagnosticsScreen } from '../screens/DiagnosticsScreen';

const Stack = createStackNavigator();

export const AppNavigator = () => {
  return (
    <Stack.Navigator
      initialRouteName="Home"
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: '#090D16' },
      }}
    >
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="Enrollment" component={EnrollmentScreen} />
      <Stack.Screen name="Verification" component={VerificationScreen} />
      <Stack.Screen name="Diagnostics" component={DiagnosticsScreen} />
    </Stack.Navigator>
  );
};
export default AppNavigator;
