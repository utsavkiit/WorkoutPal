import React, { useEffect, useState } from 'react';
import { Alert, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { createCustomExercise, listExercises } from '../data/database';
import { MUSCLE_GROUPS } from '../data/exercises';
import { Exercise, ExerciseType } from '../types';
import { useTheme } from '../theme';
import { PrimaryButton } from './ui';

export function ExercisePicker({ visible, onClose, onSelect }: { visible: boolean; onClose: () => void; onSelect: (exercise: Exercise) => void }) {
  const t=useTheme(); const [items,setItems]=useState<Exercise[]>([]); const [search,setSearch]=useState(''); const [muscle,setMuscle]=useState('All'); const [custom,setCustom]=useState(false);
  const [name,setName]=useState(''); const [customMuscle,setCustomMuscle]=useState('Chest'); const [equipment,setEquipment]=useState('Other'); const [type,setType]=useState<ExerciseType>('weighted');
  useEffect(()=>{ if(visible) listExercises(search,muscle).then(setItems); },[visible,search,muscle,custom]);
  const save=async()=>{ if(!name.trim()) return Alert.alert('Name required'); const id=await createCustomExercise({name,muscleGroup:customMuscle,equipment,type}); const exercise=(await listExercises()).find(e=>e.id===id); if(exercise){setCustom(false);setName('');onSelect(exercise);} };
  return <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}><SafeAreaView style={[styles.container,{backgroundColor:t.background}]}>
    <View style={styles.header}><Pressable onPress={custom?()=>setCustom(false):onClose}><Ionicons name="close" size={28} color={t.text}/></Pressable><Text style={[styles.title,{color:t.text}]}>{custom?'New exercise':'Choose exercise'}</Text><Pressable onPress={()=>setCustom(true)}><Ionicons name="add" size={28} color={t.accentDark}/></Pressable></View>
    {custom ? <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
      <Text style={[styles.label,{color:t.secondary}]}>NAME</Text><TextInput autoFocus value={name} onChangeText={setName} placeholder="e.g. Landmine Row" placeholderTextColor={t.secondary} style={[styles.input,{color:t.text,backgroundColor:t.input}]}/>
      <Text style={[styles.label,{color:t.secondary}]}>TYPE</Text><View style={styles.row}>{(['weighted','bodyweight'] as ExerciseType[]).map(v=><Pressable key={v} onPress={()=>setType(v)} style={[styles.choice,{backgroundColor:type===v?t.accent:t.elevated}]}><Text style={{color:type===v?'#07150C':t.text,fontWeight:'700'}}>{v==='weighted'?'Weighted':'Bodyweight'}</Text></Pressable>)}</View>
      <Text style={[styles.label,{color:t.secondary}]}>MUSCLE GROUP</Text><View style={styles.wrap}>{MUSCLE_GROUPS.slice(1).map(v=><Pressable key={v} onPress={()=>setCustomMuscle(v)} style={[styles.pill,{backgroundColor:customMuscle===v?t.accent:t.elevated}]}><Text style={{color:customMuscle===v?'#07150C':t.text}}>{v}</Text></Pressable>)}</View>
      <Text style={[styles.label,{color:t.secondary}]}>EQUIPMENT</Text><TextInput value={equipment} onChangeText={setEquipment} style={[styles.input,{color:t.text,backgroundColor:t.input}]}/><PrimaryButton title="Create exercise" onPress={save}/>
    </ScrollView> : <>
      <TextInput testID="exercise-search" accessibilityLabel="Search exercises" value={search} onChangeText={setSearch} placeholder="Search exercises" placeholderTextColor={t.secondary} style={[styles.search,{color:t.text,backgroundColor:t.input}]}/>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>{MUSCLE_GROUPS.map(v=><Pressable key={v} onPress={()=>setMuscle(v)} style={[styles.pill,{backgroundColor:muscle===v?t.accent:t.elevated}]}><Text style={{color:muscle===v?'#07150C':t.text,fontWeight:'600'}}>{v}</Text></Pressable>)}</ScrollView>
      <FlatList data={items} keyExtractor={i=>i.id} contentContainerStyle={{paddingBottom:24}} renderItem={({item})=><Pressable onPress={()=>onSelect(item)} style={[styles.item,{borderBottomColor:t.border}]}><View><Text style={[styles.itemName,{color:t.text}]}>{item.name}</Text><Text style={{color:t.secondary}}>{item.muscleGroup} · {item.equipment}</Text></View><Ionicons name="add-circle" size={27} color={t.accent}/></Pressable>}/>
    </>}
  </SafeAreaView></Modal>;
}
const styles=StyleSheet.create({container:{flex:1},header:{height:58,paddingHorizontal:18,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},title:{fontSize:18,fontWeight:'800'},search:{height:48,borderRadius:14,marginHorizontal:16,paddingHorizontal:16,fontSize:16},filters:{padding:12, gap:8},pill:{paddingHorizontal:14,paddingVertical:9,borderRadius:18},item:{minHeight:68,paddingHorizontal:18,borderBottomWidth:1,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},itemName:{fontSize:16,fontWeight:'700',marginBottom:4},form:{padding:18,gap:12},label:{fontSize:12,fontWeight:'800',marginTop:8},input:{height:52,borderRadius:14,paddingHorizontal:14,fontSize:16},row:{flexDirection:'row',gap:10},choice:{flex:1,padding:15,borderRadius:14,alignItems:'center'},wrap:{flexDirection:'row',flexWrap:'wrap',gap:8}});
