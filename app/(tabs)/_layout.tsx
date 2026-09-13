import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme';

export default function TabLayout(){const t=useTheme();return <Tabs screenOptions={{headerShown:false,tabBarActiveTintColor:t.accentDark,tabBarInactiveTintColor:t.secondary,tabBarStyle:{backgroundColor:t.tab,borderTopColor:t.border,height:84,paddingTop:6},tabBarLabelStyle:{fontSize:11,fontWeight:'700'}}}>
  <Tabs.Screen name="index" options={{title:'Workout',tabBarIcon:({color,size})=><Ionicons name="barbell-outline" color={color} size={size}/>}}/>
  <Tabs.Screen name="routines" options={{title:'Routines',tabBarIcon:({color,size})=><Ionicons name="list-outline" color={color} size={size}/>}}/>
  <Tabs.Screen name="history" options={{title:'History',tabBarIcon:({color,size})=><Ionicons name="time-outline" color={color} size={size}/>}}/>
  <Tabs.Screen name="coach" options={{title:'Coach',tabBarIcon:({color,size})=><Ionicons name="sparkles-outline" color={color} size={size}/>}}/>
  <Tabs.Screen name="settings" options={{title:'Settings',tabBarIcon:({color,size})=><Ionicons name="settings-outline" color={color} size={size}/>}}/>
</Tabs>}
