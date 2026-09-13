import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Card, PrimaryButton, Screen } from '../../src/components/ui';
import { ExercisePicker } from '../../src/components/ExercisePicker';
import { useApp } from '../../src/context/AppContext';
import { getCurrentCoachingProfile, listExercises, saveCoachingProfileRevision } from '../../src/data/database';
import { makeId } from '../../src/data/id';
import { CoachingProfileV1, TrainingGoalFocus, createDefaultCoachingProfile, validateCoachingProfile } from '../../src/coaching/goals';
import { Exercise } from '../../src/types';
import { useTheme } from '../../src/theme';

type GoalType = TrainingGoalFocus['type'];
const goalOptions: { value: GoalType; label: string }[] = [
  { value: 'general_strength', label: 'General strength' },
  { value: 'specific_lift_strength', label: 'A specific lift' },
  { value: 'hypertrophy', label: 'Build muscle' },
  { value: 'consistency', label: 'Consistency' },
  { value: 'maintenance', label: 'Maintain performance' },
];
const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function timezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

export default function GoalsScreen() {
  const t = useTheme();
  const router = useRouter();
  const { preferences, refresh } = useApp();
  const [existing, setExisting] = useState<CoachingProfileV1 | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [goalType, setGoalType] = useState<GoalType>('general_strength');
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [targetWeight, setTargetWeight] = useState('');
  const [targetReps, setTargetReps] = useState('');
  const [muscles, setMuscles] = useState('');
  const [sessions, setSessions] = useState('3');
  const [days, setDays] = useState('3');
  const [minutes, setMinutes] = useState('60');
  const [equipment, setEquipment] = useState('');
  const [considerations, setConsiderations] = useState('');
  const [motivation, setMotivation] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [coachingEnabled, setCoachingEnabled] = useState(false);
  const [shareHistory, setShareHistory] = useState(false);
  const [weeklyEnabled, setWeeklyEnabled] = useState(false);
  const [reviewDay, setReviewDay] = useState<0 | 1 | 2 | 3 | 4 | 5 | 6>(0);

  useEffect(() => {
    Promise.all([getCurrentCoachingProfile(), listExercises()]).then(([profile, exercises]) => {
      setExisting(profile);
      if (profile) {
        const goal = profile.goals.find((item) => item.status === 'active' && item.priority === 1) ?? profile.goals[0];
        setGoalType(goal.focus.type);
        setMotivation(goal.motivation ?? '');
        setTargetDate(goal.targetDate ?? '');
        if (goal.focus.type === 'specific_lift_strength') {
          const exerciseId = goal.focus.exerciseId;
          setExercise(exercises.find((item) => item.id === exerciseId) ?? { id: exerciseId, name: 'Unavailable lift', ownerId: null, muscleGroup: '', equipment: '', type: 'weighted', isCustom: false, archived: false, updatedAt: '' });
          setTargetWeight(goal.focus.target ? String(goal.focus.target.weight) : '');
          setTargetReps(goal.focus.target ? String(goal.focus.target.reps) : '');
        } else if (goal.focus.type === 'hypertrophy') setMuscles(goal.focus.muscleGroups.join(', '));
        else if (goal.focus.type === 'consistency') setSessions(String(goal.focus.sessionsPerWeek));
        else if (goal.focus.type === 'maintenance') {
          const exerciseId = goal.focus.exerciseIds[0];
          setExercise(exercises.find((item) => item.id === exerciseId) ?? { id: exerciseId, name: 'Unavailable exercise', ownerId: null, muscleGroup: '', equipment: '', type: 'weighted', isCustom: false, archived: false, updatedAt: '' });
        }
        setDays(String(profile.constraints.availableDaysPerWeek));
        setMinutes(String(profile.constraints.sessionMinutes));
        setEquipment(profile.constraints.equipment.join(', '));
        setConsiderations(profile.constraints.considerations ?? '');
        setCoachingEnabled(profile.consent.coachingEnabled);
        setShareHistory(profile.consent.shareWorkoutHistory);
        setWeeklyEnabled(profile.weeklyReview.enabled);
        setReviewDay(profile.weeklyReview.dayOfWeek);
      }
    }).catch((error) => Alert.alert('Could not load goals', error instanceof Error ? error.message : String(error))).finally(() => setLoading(false));
  }, []);

  const focus = useMemo<TrainingGoalFocus | null>(() => {
    if (goalType === 'general_strength') return { type: goalType };
    if (goalType === 'specific_lift_strength') {
      if (!exercise) return null;
      const weight = Number(targetWeight); const reps = Number(targetReps);
      return { type: goalType, exerciseId: exercise.id, target: weight > 0 && reps > 0 ? { weight, reps, unit: preferences.unit } : null };
    }
    if (goalType === 'hypertrophy') return { type: goalType, muscleGroups: muscles.split(',').map((item) => item.trim()).filter(Boolean) };
    if (goalType === 'consistency') return { type: goalType, sessionsPerWeek: Number(sessions) };
    return exercise ? { type: goalType, exerciseIds: [exercise.id] } : null;
  }, [exercise, goalType, muscles, preferences.unit, sessions, targetReps, targetWeight]);

  const save = async () => {
    if (!focus) return Alert.alert('Finish your goal', goalType.includes('lift') || goalType === 'maintenance' ? 'Choose an exercise first.' : 'Add the required goal detail.');
    const timestamp = new Date().toISOString();
    const base = existing ?? createDefaultCoachingProfile(makeId(), timestamp, timezone());
    const consentedAt = coachingEnabled && shareHistory ? (base.consent.consentedAt ?? timestamp) : null;
    const profile: CoachingProfileV1 = {
      ...base,
      revision: existing ? existing.revision + 1 : 1,
      effectiveAt: timestamp,
      updatedAt: timestamp,
      goals: [{ id: base.goals[0]?.id ?? makeId(), status: 'active', priority: 1, focus, motivation: motivation.trim() || null, targetDate: targetDate.trim() || null }],
      constraints: {
        availableDaysPerWeek: Number(days),
        sessionMinutes: Number(minutes),
        equipment: equipment.split(',').map((item) => item.trim()).filter(Boolean),
        considerations: considerations.trim() || null,
      },
      consent: {
        ...base.consent,
        coachingEnabled,
        shareWorkoutHistory: shareHistory,
        consentedAt,
        revokedAt: coachingEnabled ? null : (base.consent.coachingEnabled ? timestamp : base.consent.revokedAt),
      },
      weeklyReview: { ...base.weeklyReview, enabled: weeklyEnabled && coachingEnabled, dayOfWeek: reviewDay, timezone: timezone() },
    };
    const validation = validateCoachingProfile(profile);
    if (!validation.ok) return Alert.alert('Check your goals', validation.errors[0]);
    setSaving(true);
    try {
      await saveCoachingProfileRevision(profile);
      setExisting(profile);
      refresh();
      Alert.alert('Goals saved', 'Your previous goal revision is preserved.');
    } catch (error) {
      Alert.alert('Could not save goals', error instanceof Error ? error.message : String(error));
    } finally { setSaving(false); }
  };

  if (loading) return <Screen style={styles.center}><Text style={{ color: t.secondary }}>Loading goals…</Text></Screen>;
  return <Screen><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <View style={styles.header}><Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={styles.iconButton}><Ionicons name="chevron-back" size={28} color={t.text}/></Pressable><Text style={[styles.title, { color: t.text }]}>My Goals</Text><View style={styles.iconButton}/></View>
    <Text style={[styles.intro, { color: t.secondary }]}>Tell Coach what matters most. You can refine the optional details later.</Text>
    <Text style={[styles.section, { color: t.secondary }]}>PRIMARY GOAL</Text>
    <Card><View style={styles.wrap}>{goalOptions.map((option) => <Pressable accessibilityRole="radio" accessibilityState={{ checked: goalType === option.value }} key={option.value} onPress={() => { setGoalType(option.value); setExercise(null); }} style={[styles.pill, { backgroundColor: goalType === option.value ? t.accent : t.elevated }]}><Text style={{ color: goalType === option.value ? '#07150C' : t.text, fontWeight: '700' }}>{option.label}</Text></Pressable>)}</View>
      {(goalType === 'specific_lift_strength' || goalType === 'maintenance') && <><FieldLabel>Exercise</FieldLabel><PrimaryButton kind="secondary" title={exercise?.name ?? 'Choose exercise'} onPress={() => setPickerVisible(true)}/></>}
      {goalType === 'specific_lift_strength' && <View style={styles.row}><Field label={`Target weight (${preferences.unit})`} value={targetWeight} onChange={setTargetWeight} keyboard/><Field label="Target reps" value={targetReps} onChange={setTargetReps} keyboard/></View>}
      {goalType === 'hypertrophy' && <Field label="Muscle groups" value={muscles} onChange={setMuscles} placeholder="Chest, back"/>}
      {goalType === 'consistency' && <Field label="Sessions per week" value={sessions} onChange={setSessions} keyboard/>}
      <Field label="Why this matters (optional)" value={motivation} onChange={setMotivation} multiline/>
      <Field label="Target date (optional)" value={targetDate} onChange={setTargetDate} placeholder="YYYY-MM-DD"/>
    </Card>
    <Text style={[styles.section, { color: t.secondary }]}>TRAINING CONSTRAINTS</Text>
    <Card><View style={styles.row}><Field label="Days per week" value={days} onChange={setDays} keyboard/><Field label="Minutes per session" value={minutes} onChange={setMinutes} keyboard/></View><Field label="Available equipment (optional)" value={equipment} onChange={setEquipment} placeholder="Barbell, rack"/><Field label="Anything Coach should respect (optional)" value={considerations} onChange={setConsiderations} multiline placeholder="Time limits, movements to avoid…"/></Card>
    <Text style={[styles.section, { color: t.secondary }]}>PRIVACY & REVIEWS</Text>
    <Card><Toggle label="Enable AI Coach" detail="Coach stays off until you explicitly enable it." value={coachingEnabled} onChange={(value) => { setCoachingEnabled(value); if (!value) setWeeklyEnabled(false); }}/><Divider/><Toggle label="Share workout history with Coach" detail="Required for history-grounded coaching. This does not enable notifications." value={shareHistory} onChange={(value) => { setShareHistory(value); if (!value) { setCoachingEnabled(false); setWeeklyEnabled(false); } }}/><Divider/><Toggle label="Weekly reviews" detail="Generate a review after your selected local week closes." value={weeklyEnabled} onChange={(value) => { if (value && (!coachingEnabled || !shareHistory)) Alert.alert('Enable consent first', 'Enable Coach and workout-history access before weekly reviews.'); else setWeeklyEnabled(value); }}/>
      {weeklyEnabled && <><FieldLabel>Review day</FieldLabel><View style={styles.wrap}>{dayLabels.map((label, index) => <Pressable accessibilityRole="radio" accessibilityState={{ checked: reviewDay === index }} key={label} onPress={() => setReviewDay(index as typeof reviewDay)} style={[styles.day, { backgroundColor: reviewDay === index ? t.accent : t.elevated }]}><Text style={{ color: reviewDay === index ? '#07150C' : t.text, fontWeight: '700' }}>{label}</Text></Pressable>)}</View></>}
    </Card>
    <PrimaryButton title={saving ? 'Saving…' : existing ? 'Save new revision' : 'Save goals'} disabled={saving} onPress={save}/>
    <PrimaryButton kind="secondary" title="External agent setup" onPress={() => router.push('/coach/setup')}/>
    {existing && <Text style={[styles.revision, { color: t.secondary }]}>Current revision {existing.revision}. Earlier reviews keep the goal revision they used.</Text>}
  </ScrollView><ExercisePicker visible={pickerVisible} onClose={() => setPickerVisible(false)} onSelect={(item) => { setExercise(item); setPickerVisible(false); }}/></Screen>;
}

function FieldLabel({ children }: { children: React.ReactNode }) { const t = useTheme(); return <Text style={[styles.label, { color: t.secondary }]}>{children}</Text>; }
function Field({ label, value, onChange, placeholder, keyboard, multiline }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; keyboard?: boolean; multiline?: boolean }) { const t = useTheme(); return <View style={styles.field}><FieldLabel>{label}</FieldLabel><TextInput accessibilityLabel={label} value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={t.secondary} keyboardType={keyboard ? 'number-pad' : 'default'} multiline={multiline} style={[styles.input, multiline && styles.multiline, { color: t.text, backgroundColor: t.input }]}/></View>; }
function Toggle({ label, detail, value, onChange }: { label: string; detail: string; value: boolean; onChange: (value: boolean) => void }) { const t = useTheme(); return <View style={styles.toggle}><View style={{ flex: 1 }}><Text style={[styles.toggleLabel, { color: t.text }]}>{label}</Text><Text style={[styles.detail, { color: t.secondary }]}>{detail}</Text></View><Switch accessibilityLabel={label} value={value} onValueChange={onChange} trackColor={{ true: t.accent }} /></View>; }
function Divider() { const t = useTheme(); return <View style={[styles.divider, { backgroundColor: t.border }]}/>; }

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' }, content: { padding: 20, paddingBottom: 80, gap: 12 },
  header: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, iconButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: '900' }, intro: { fontSize: 15, lineHeight: 22, marginBottom: 4 }, section: { fontSize: 12, fontWeight: '900', letterSpacing: 1.2, marginTop: 10 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, pill: { minHeight: 44, borderRadius: 22, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', gap: 10 }, field: { flex: 1, marginTop: 12 }, label: { fontSize: 12, fontWeight: '800', marginBottom: 7 }, input: { minHeight: 48, borderRadius: 12, paddingHorizontal: 13, fontSize: 16 }, multiline: { minHeight: 86, paddingTop: 12, textAlignVertical: 'top' },
  toggle: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 14 }, toggleLabel: { fontSize: 16, fontWeight: '700' }, detail: { fontSize: 13, lineHeight: 18, marginTop: 3 }, divider: { height: 1, marginVertical: 9 }, day: { minWidth: 44, minHeight: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  revision: { fontSize: 13, lineHeight: 18, textAlign: 'center' },
});
