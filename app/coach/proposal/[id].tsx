import React, { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Card, PrimaryButton, Screen } from '../../../src/components/ui';
import { acceptCoachRoutineProposal, dismissCoachRoutineProposal, getCoachRoutineProposal, listExercises, listRoutines } from '../../../src/data/database';
import { CoachRoutineProposalItem, sourceRoutineStillMatches } from '../../../src/coaching/proposals';
import { useApp } from '../../../src/context/AppContext';
import { useTheme } from '../../../src/theme';

export default function RoutineProposalDetail() {
  const t=useTheme(); const router=useRouter(); const {id}=useLocalSearchParams<{id:string}>(); const {revision,refresh,session,syncNow}=useApp();
  const [item,setItem]=useState<CoachRoutineProposalItem|null>(null); const [names,setNames]=useState<Record<string,string>>({}); const [busy,setBusy]=useState(false); const [stale,setStale]=useState(false);
  useEffect(()=>{Promise.all([getCoachRoutineProposal(id),listExercises(),listRoutines()]).then(([proposal,exercises,routines])=>{setItem(proposal);setNames(Object.fromEntries(exercises.map((exercise)=>[exercise.id,exercise.name])));setStale(proposal?!sourceRoutineStillMatches(proposal.record.sourceRoutine,proposal.record.sourceRoutine?routines.find((routine)=>routine.id===proposal.record.sourceRoutine!.id)??null:routines[0]??null):false) }).catch(console.warn)},[id,revision]);
  if (!item) return <Screen style={styles.center}><Text style={{color:t.secondary}}>Recommendation not found.</Text></Screen>;
  const {record,status,appliedRoutineId}=item; const proposal=record.proposal; const source=record.sourceRoutine;
  const accept=async()=>{setBusy(true);try{await acceptCoachRoutineProposal(record.id);refresh();if(session)void syncNow().catch(console.warn);router.replace('/routines')}catch(error){Alert.alert('Could not accept recommendation',error instanceof Error?error.message:String(error))}finally{setBusy(false)}};
  const decline=async()=>{setBusy(true);try{await dismissCoachRoutineProposal(record.id);refresh();if(session)void syncNow().catch(console.warn);router.back()}catch(error){Alert.alert('Could not decline recommendation',error instanceof Error?error.message:String(error))}finally{setBusy(false)}};
  return <Screen><ScrollView contentContainerStyle={styles.content}>
    <View style={styles.header}><Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={()=>router.back()} style={styles.back}><Ionicons name="chevron-back" size={28} color={t.text}/></Pressable><Text style={[styles.title,{color:t.text}]}>Recommended routine</Text><View style={styles.back}/></View>
    <Text style={[styles.eyebrow,{color:t.accentDark}]}>{status==='pending'?'READY FOR YOUR DECISION':status==='accepted'?'ACCEPTED':'DECLINED'}</Text>
    <Text style={[styles.name,{color:t.text}]}>{proposal.name}</Text><Text style={[styles.body,{color:t.secondary}]}>{proposal.summary}</Text>
    <Card><Text style={[styles.section,{color:t.text}]}>{source?'Current routine':'Starting point'}</Text>{source?<><Text style={[styles.small,{color:t.secondary}]}>{source.name} · snapshot from {new Date(source.version).toLocaleDateString()}</Text>{source.exercises.map((exercise)=><Text key={exercise.exerciseId} style={[styles.line,{color:t.text}]}>{exercise.name} · {exercise.setCount} sets</Text>)}</>:<Text style={[styles.body,{color:t.secondary}]}>No saved routine was available when Coach prepared this recommendation.</Text>}</Card>
    <Card style={{borderColor:t.accentDark}}><Text style={[styles.section,{color:t.text}]}>Suggested routine</Text>{proposal.exercises.map((exercise,index)=><View key={exercise.exerciseId} style={styles.exercise}><Text style={[styles.exerciseName,{color:t.text}]}>{index+1}. {names[exercise.exerciseId]??source?.exercises.find((value)=>value.exerciseId===exercise.exerciseId)?.name??'Exercise unavailable'} · {exercise.setCount} sets</Text><Text style={[styles.small,{color:t.secondary}]}>{exercise.rationale}</Text></View>)}</Card>
    {!!proposal.removed.length&&<Card><Text style={[styles.section,{color:t.text}]}>Removed from the old routine</Text>{proposal.removed.map((exercise)=><View key={exercise.exerciseId} style={styles.exercise}><Text style={[styles.exerciseName,{color:t.text}]}>{source?.exercises.find((value)=>value.exerciseId===exercise.exerciseId)?.name??'Exercise'}</Text><Text style={[styles.small,{color:t.secondary}]}>{exercise.rationale}</Text></View>)}</Card>}
    {!!proposal.limitations.length&&<Card><Text style={[styles.section,{color:t.text}]}>What to keep in mind</Text>{proposal.limitations.map((value)=><Text key={value} style={[styles.line,{color:t.secondary}]}>• {value}</Text>)}</Card>}
    {status==='pending'&&stale&&<Card style={{borderColor:t.danger}}><Text style={[styles.section,{color:t.danger}]}>Routine changed</Text><Text style={[styles.body,{color:t.text}]}>This recommendation was based on an earlier routine. Request an updated review before accepting it.</Text></Card>}
    <Text style={[styles.small,{color:t.secondary}]}>Accept adds a separate saved routine for future workouts. Your current routine and any workout in progress stay unchanged.</Text>
    {status==='pending'?<View style={styles.actions}><PrimaryButton title={busy?'Saving…':'Accept and add routine'} disabled={busy||stale} onPress={accept}/><PrimaryButton title="Decline" kind="secondary" disabled={busy} onPress={decline}/></View>:status==='accepted'&&appliedRoutineId?<PrimaryButton title="View saved routines" kind="secondary" onPress={()=>router.replace('/routines')}/>:null}
  </ScrollView></Screen>;
}

const styles=StyleSheet.create({content:{padding:20,paddingBottom:100,gap:14},center:{alignItems:'center',justifyContent:'center'},header:{minHeight:48,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},back:{width:48,height:48,alignItems:'center',justifyContent:'center'},title:{fontSize:20,fontWeight:'900'},eyebrow:{fontSize:11,fontWeight:'900',letterSpacing:1.1},name:{fontSize:28,fontWeight:'900',lineHeight:35},body:{fontSize:15,lineHeight:22},section:{fontSize:19,fontWeight:'800',marginBottom:8},line:{fontSize:14,lineHeight:21,marginTop:5},small:{fontSize:13,lineHeight:19},exercise:{paddingVertical:8},exerciseName:{fontSize:15,fontWeight:'800',lineHeight:21,marginBottom:4},actions:{gap:10,marginTop:8}});
