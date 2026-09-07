import React, { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Card, EmptyState, Screen } from '../../src/components/ui';
import { listHistory } from '../../src/data/database';
import { useApp } from '../../src/context/AppContext';
import { WorkoutSession } from '../../src/types';
import { useTheme } from '../../src/theme';
import { workoutDuration } from '../../src/utils';

export default function History(){const t=useTheme();const router=useRouter();const {revision}=useApp();const [items,setItems]=useState<WorkoutSession[]>([]);useEffect(()=>{listHistory().then(setItems)},[revision]);return <Screen><Text style={[styles.title,{color:t.text}]}>History</Text><FlatList data={items} keyExtractor={i=>i.id} contentContainerStyle={styles.list} ListEmptyComponent={<EmptyState icon="🗓️" title="No workouts yet" body="Your completed sessions will build a simple training record here."/>} renderItem={({item})=>{const sets=item.exercises.reduce((n,e)=>n+e.sets.length,0);return <Pressable onPress={()=>router.push(`/history/${item.id}`)}><Card style={styles.card}><View style={[styles.dateBox,{backgroundColor:t.elevated}]}><Text style={[styles.month,{color:t.secondary}]}>{new Date(item.endedAt!).toLocaleDateString(undefined,{month:'short'}).toUpperCase()}</Text><Text style={[styles.day,{color:t.text}]}>{new Date(item.endedAt!).getDate()}</Text></View><View style={{flex:1}}><Text style={[styles.name,{color:t.text}]}>{item.name}</Text><Text style={{color:t.secondary}}>{workoutDuration(item.startedAt,item.endedAt)} · {sets} sets · {item.exercises.length} exercises</Text></View><Ionicons name="chevron-forward" size={20} color={t.secondary}/></Card></Pressable>}}/></Screen>}
const styles=StyleSheet.create({title:{fontSize:32,fontWeight:'900',paddingHorizontal:20,paddingTop:10,paddingBottom:16},list:{paddingHorizontal:20,paddingBottom:110,flexGrow:1},card:{flexDirection:'row',alignItems:'center',gap:14,marginBottom:11},dateBox:{width:52,height:54,borderRadius:13,alignItems:'center',justifyContent:'center'},month:{fontSize:10,fontWeight:'900'},day:{fontSize:21,fontWeight:'900'},name:{fontSize:17,fontWeight:'800',marginBottom:5}});
