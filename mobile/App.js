import React from 'react';
import { View, Text, SafeAreaView, StyleSheet, Platform, StatusBar } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import Toast from 'react-native-toast-message';
import HomeScreen from './src/screens/HomeScreen';

const Tab = createMaterialTopTabNavigator();

export default function App() {
  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <NavigationContainer>
        <HomeScreen />
      </NavigationContainer>
      <Toast />
    </>
  );
}
