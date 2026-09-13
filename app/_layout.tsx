import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AppProvider } from '../src/context/AppContext';
import { Loading } from '../src/components/ui';
import { useApp } from '../src/context/AppContext';

function Navigation() {
  const { ready }=useApp(); if(!ready) return <Loading/>;
  return <><StatusBar style="auto"/><Stack screenOptions={{headerShown:false}}><Stack.Screen name="(tabs)"/><Stack.Screen name="workout" options={{presentation:'fullScreenModal'}}/><Stack.Screen name="routine/[id]" options={{presentation:'modal'}}/><Stack.Screen name="history/[id]"/><Stack.Screen name="coach/goals"/><Stack.Screen name="coach/setup"/><Stack.Screen name="auth/callback"/></Stack></>;
}
export default function RootLayout(){return <AppProvider><Navigation/></AppProvider>;}
