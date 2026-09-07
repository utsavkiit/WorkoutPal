import React, { useEffect } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Text, StyleSheet } from 'react-native';
import { Screen } from '../../src/components/ui';
import { useTheme } from '../../src/theme';

export default function AuthCallback(){const router=useRouter();const params=useLocalSearchParams();const t=useTheme();useEffect(()=>{const id=setTimeout(()=>router.replace('/'),1000);return()=>clearTimeout(id)},[params,router]);return <Screen style={styles.screen}><Text style={[styles.title,{color:t.text}]}>Signing you in…</Text><Text style={{color:t.secondary}}>WorkoutPal will return you to your workouts.</Text></Screen>}
const styles=StyleSheet.create({screen:{alignItems:'center',justifyContent:'center',gap:8},title:{fontSize:22,fontWeight:'800'}});
