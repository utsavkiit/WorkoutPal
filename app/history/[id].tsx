import React, { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Pressable } from 'react-native';
import { Card, Loading, Screen } from '../../src/components/ui';
import { deleteHistoryExercise, deleteHistorySet, deleteWorkout, getWorkout, saveHistoryEdits } from '../../src/data/database';
import { canCompleteSet, shiftWorkoutDates, validateHistoryDate, validateHistoryName } from '../../src/domain';
import { WorkoutExercise, WorkoutSession, WorkoutSet } from '../../src/types';
import { useApp } from '../../src/context/AppContext';
import { useTheme } from '../../src/theme';
import { now, validReps, validWeight, workoutDuration } from '../../src/utils';

type SetDraft = { weight: string; reps: string };

function draftFromWorkout(item: WorkoutSession) {
  const sets: Record<string, SetDraft> = {};
  const ended = new Date(item.endedAt!);
  item.exercises.forEach((exercise) => exercise.sets.forEach((set) => { sets[set.id] = { weight: set.weight?.toString() ?? '', reps: set.reps?.toString() ?? '' }; }));
  return { name: item.name, year: String(ended.getFullYear()), month: String(ended.getMonth() + 1), day: String(ended.getDate()), sets };
}

export default function HistoryDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const t = useTheme();
  const { refresh } = useApp();
  const [item, setItem] = useState<WorkoutSession | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ReturnType<typeof draftFromWorkout> | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (id) getWorkout(id).then(setItem); }, [id]);
  if (!item) return <Loading />;

  const beginEdit = () => { setDraft(draftFromWorkout(item)); setEditing(true); };
  const cancelEdit = () => { setEditing(false); setDraft(null); };

  // Re-fetches after an exercise/set delete so both the read model and the in-progress edit
  // draft reflect what's left, without dropping the user out of edit mode.
  const reloadAfterDelete = async () => {
    const updated = await getWorkout(item.id);
    if (!updated) return;
    setItem(updated);
    setDraft(draftFromWorkout(updated));
    refresh();
  };

  const confirmDeleteWorkout = () => Alert.alert('Delete workout?', 'This permanently removes the workout and everything logged in it.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: async () => { await deleteWorkout(item.id); refresh(); router.replace('/history'); } },
  ]);
  const confirmDeleteExercise = (exercise: WorkoutExercise) => Alert.alert(`Delete ${exercise.exerciseName}?`, 'This removes the exercise and its logged sets from this workout.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: async () => {
      try { await deleteHistoryExercise(exercise.id); await reloadAfterDelete(); }
      catch (e) { Alert.alert('Not deleted', e instanceof Error ? e.message : String(e)); }
    } },
  ]);
  const confirmDeleteSet = (exercise: WorkoutExercise, set: WorkoutSet) => Alert.alert(`Delete set ${set.setNumber}?`, `Removes this set from ${exercise.exerciseName}.`, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: async () => {
      try { await deleteHistorySet(set.id); await reloadAfterDelete(); }
      catch (e) { Alert.alert('Not deleted', e instanceof Error ? e.message : String(e)); }
    } },
  ]);

  const save = async () => {
    if (!draft) return;
    const nameResult = validateHistoryName(draft.name);
    if (!nameResult.ok) return Alert.alert('Invalid name', nameResult.error);
    const dateResult = validateHistoryDate(item.endedAt!, Number(draft.year), Number(draft.month), Number(draft.day), now());
    if (!dateResult.ok) return Alert.alert('Invalid date', dateResult.error);
    const sets: { id: string; weight: number | null; reps: number }[] = [];
    for (const exercise of item.exercises) {
      for (const set of exercise.sets) {
        const setDraft = draft.sets[set.id];
        const weight = exercise.exerciseType === 'weighted' ? (setDraft.weight === '' ? null : Number(setDraft.weight)) : null;
        const reps = setDraft.reps === '' ? null : Number(setDraft.reps);
        if (!canCompleteSet(exercise.exerciseType, weight, reps)) {
          return Alert.alert('Invalid set', exercise.exerciseType === 'weighted' ? `Enter weight and reps for ${exercise.exerciseName} set ${set.setNumber}.` : `Enter reps for ${exercise.exerciseName} set ${set.setNumber}.`);
        }
        sets.push({ id: set.id, weight, reps: reps! });
      }
    }
    const { startedAt, endedAt } = shiftWorkoutDates(item.startedAt, item.endedAt!, dateResult.date);
    setSaving(true);
    try {
      await saveHistoryEdits(item.id, { name: nameResult.name, startedAt, endedAt, sets });
      setItem(await getWorkout(item.id));
      setEditing(false); setDraft(null);
      refresh();
    } catch (e) {
      Alert.alert('Not saved', e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const setDateField = (field: 'year' | 'month' | 'day', value: string) => setDraft((v) => v && /^\d{0,4}$/.test(value) ? { ...v, [field]: value } : v);
  const setSetField = (setId: string, field: keyof SetDraft, value: string) => setDraft((v) => v ? { ...v, sets: { ...v.sets, [setId]: { ...v.sets[setId], [field]: value } } } : v);

  return (
    <Screen>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Pressable accessibilityLabel={editing ? 'Cancel edit' : 'Back'} onPress={editing ? cancelEdit : () => router.back()}>
            {editing ? <Text style={[styles.headerAction, { color: t.secondary }]}>Cancel</Text> : <Ionicons name="chevron-back" size={28} color={t.text} />}
          </Pressable>
          <Text style={[styles.headerTitle, { color: t.text }]}>{editing ? 'Edit workout' : 'Workout details'}</Text>
          <View style={styles.headerRight}>
            <Pressable accessibilityLabel="Delete workout" hitSlop={8} disabled={saving} onPress={confirmDeleteWorkout}>
              <Ionicons name="trash-outline" size={20} color={t.danger} style={{ opacity: saving ? 0.4 : 1 }} />
            </Pressable>
            <Pressable accessibilityLabel={editing ? 'Save' : 'Edit'} disabled={saving} onPress={editing ? save : beginEdit}>
              <Text style={[styles.headerAction, { color: t.accentDark, opacity: saving ? 0.5 : 1 }]}>{editing ? 'Save' : 'Edit'}</Text>
            </Pressable>
          </View>
        </View>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {editing && draft ? (
            <>
              <TextInput
                accessibilityLabel="Workout name" value={draft.name} onChangeText={(v) => setDraft((d) => d && { ...d, name: v })}
                placeholder="Workout name" placeholderTextColor={t.secondary} style={[styles.nameInput, { color: t.text, backgroundColor: t.input }]}
              />
              <View style={styles.dateRow}>
                <TextInput accessibilityLabel="Month" value={draft.month} onChangeText={(v) => setDateField('month', v)} keyboardType="number-pad" placeholder="MM" placeholderTextColor={t.secondary} style={[styles.dateInput, { color: t.text, backgroundColor: t.input }]} />
                <TextInput accessibilityLabel="Day" value={draft.day} onChangeText={(v) => setDateField('day', v)} keyboardType="number-pad" placeholder="DD" placeholderTextColor={t.secondary} style={[styles.dateInput, { color: t.text, backgroundColor: t.input }]} />
                <TextInput accessibilityLabel="Year" value={draft.year} onChangeText={(v) => setDateField('year', v)} keyboardType="number-pad" placeholder="YYYY" placeholderTextColor={t.secondary} style={[styles.dateInput, styles.yearInput, { color: t.text, backgroundColor: t.input }]} />
              </View>
            </>
          ) : (
            <>
              <Text style={[styles.title, { color: t.text }]}>{item.name}</Text>
              <Text style={[styles.meta, { color: t.secondary }]}>{new Date(item.endedAt!).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })} · {workoutDuration(item.startedAt, item.endedAt)}</Text>
            </>
          )}
          {item.exercises.map((exercise) => (
            <Card key={exercise.id} style={styles.card}>
              <View style={styles.exerciseHeader}>
                <Text style={[styles.exerciseName, { color: t.text }]}>{exercise.exerciseName}</Text>
                {editing && (
                  <Pressable accessibilityLabel={`Delete ${exercise.exerciseName}`} hitSlop={8} onPress={() => confirmDeleteExercise(exercise)}>
                    <Ionicons name="trash-outline" size={18} color={t.danger} />
                  </Pressable>
                )}
              </View>
              <View style={styles.columns}>
                <Text style={[styles.setCol, { color: t.secondary }]}>SET</Text>
                {exercise.exerciseType === 'weighted' && <Text style={[styles.valueCol, { color: t.secondary }]}>WEIGHT</Text>}
                <Text style={[styles.valueCol, { color: t.secondary }]}>REPS</Text>
              </View>
              {exercise.sets.map((set) => (
                <View key={set.id} style={[styles.row, { borderTopColor: t.border }]}>
                  <Text style={[styles.setCol, { color: t.secondary }]}>{set.setNumber}</Text>
                  {exercise.exerciseType === 'weighted' && (
                    editing && draft ? (
                      <TextInput accessibilityLabel={`${exercise.exerciseName} set ${set.setNumber} weight`} selectTextOnFocus keyboardType="decimal-pad" value={draft.sets[set.id]?.weight ?? ''} onChangeText={(v) => validWeight(v) && setSetField(set.id, 'weight', v)} placeholder="0" placeholderTextColor={t.secondary} style={[styles.valueInput, { color: t.text, backgroundColor: t.input }]} />
                    ) : <Text style={[styles.valueCol, { color: t.text }]}>{set.weight} {set.unit}</Text>
                  )}
                  {editing && draft ? (
                    <TextInput accessibilityLabel={`${exercise.exerciseName} set ${set.setNumber} reps`} selectTextOnFocus keyboardType="number-pad" value={draft.sets[set.id]?.reps ?? ''} onChangeText={(v) => validReps(v) && setSetField(set.id, 'reps', v)} placeholder="0" placeholderTextColor={t.secondary} style={[styles.valueInput, { color: t.text, backgroundColor: t.input }]} />
                  ) : <Text style={[styles.valueCol, { color: t.text }]}>{set.reps}</Text>}
                  {editing && (
                    <Pressable accessibilityLabel={`Delete set ${set.setNumber}`} hitSlop={8} onPress={() => confirmDeleteSet(exercise, set)}>
                      <Ionicons name="trash-outline" size={16} color={t.danger} />
                    </Pressable>
                  )}
                </View>
              ))}
            </Card>
          ))}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
const styles = StyleSheet.create({
  header: { height: 58, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontSize: 18, fontWeight: '800' }, headerAction: { fontSize: 16, fontWeight: '800' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  content: { padding: 20, paddingBottom: 50 }, title: { fontSize: 30, fontWeight: '900' }, meta: { marginTop: 7, marginBottom: 24 },
  nameInput: { height: 52, borderRadius: 14, paddingHorizontal: 16, fontSize: 22, fontWeight: '800', marginBottom: 12 },
  dateRow: { flexDirection: 'row', gap: 8, marginBottom: 24 },
  dateInput: { width: 64, height: 46, borderRadius: 12, textAlign: 'center', fontSize: 16, fontWeight: '700' },
  yearInput: { width: 86 },
  card: { marginBottom: 12 },
  exerciseHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  exerciseName: { fontSize: 18, fontWeight: '800' },
  columns: { flexDirection: 'row', paddingBottom: 6 }, row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderTopWidth: 1 },
  setCol: { width: 60, fontSize: 12, fontWeight: '700' }, valueCol: { flex: 1, textAlign: 'center', fontWeight: '700' },
  valueInput: { flex: 1, height: 40, marginHorizontal: 4, borderRadius: 10, textAlign: 'center', fontSize: 16, fontWeight: '700' },
});
