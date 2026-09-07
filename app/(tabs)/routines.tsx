import React, { useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { archiveRoutine, duplicateRoutine, listRoutines } from '../../src/data/database';
import { useApp } from '../../src/context/AppContext';
import { Routine } from '../../src/types';
import { Card, EmptyState, Screen } from '../../src/components/ui';
import { useTheme } from '../../src/theme';

export default function Routines(){const t=useTheme();const router=useRouter();const {revision,refresh}=useApp();const [items,setItems]=useState<Routine[]>([]);useEffect(()=>{listRoutines().then(setItems)},[revision]);
  const menu=(r:Routine)=>Alert.alert(r.name,undefined,[{text:'Edit',onPress:()=>router.push(`/routine/${r.id}`)},{text:'Duplicate',onPress:async()=>{await duplicateRoutine(r.id);refresh()}},{text:'Delete',style:'destructive',onPress:async()=>{await archiveRoutine(r.id);refresh()}},{text:'Cancel',style:'cancel'}]);
  return <Screen><View style={styles.header}><Text style={[styles.title,{color:t.text}]}>Routines</Text><Pressable accessibilityLabel="New routine" onPress={()=>router.push('/routine/new')} style={[styles.add,{backgroundColor:t.accent}]}><Ionicons name="add" size={25} color="#07150C"/></Pressable></View><FlatList data={items} keyExtractor={i=>i.id} contentContainerStyle={styles.list} ListEmptyComponent={<EmptyState icon="📋" title="Build your first routine" body="Choose exercises once, then start training in seconds."/>} renderItem={({item})=><Pressable onPress={()=>router.push(`/routine/${item.id}`)} onLongPress={()=>menu(item)}><Card style={styles.card}><View style={{flex:1}}><Text style={[styles.name,{color:t.text}]}>{item.name}</Text><Text numberOfLines={2} style={[styles.detail,{color:t.secondary}]}>{item.exercises.length?item.exercises.map(e=>`${e.exercise?.name} ×${e.setCount}`).join('  ·  '):'No exercises'}</Text></View><Pressable onPress={()=>menu(item)} hitSlop={12}><Ionicons name="ellipsis-horizontal" size={22} color={t.secondary}/></Pressable></Card></Pressable>}/></Screen>;
}
const styles=StyleSheet.create({header:{paddingHorizontal:20,paddingTop:10,paddingBottom:16,flexDirection:'row',justifyContent:'space-between',alignItems:'center'},title:{fontSize:32,fontWeight:'900'},add:{width:44,height:44,borderRadius:14,alignItems:'center',justifyContent:'center'},list:{paddingHorizontal:20,paddingBottom:110,flexGrow:1},card:{marginBottom:12,flexDirection:'row',alignItems:'center',gap:12},name:{fontSize:18,fontWeight:'800',marginBottom:6},detail:{lineHeight:20}});
