import React, { PropsWithChildren } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme';

export function Screen({ children, style }: PropsWithChildren<{ style?: ViewStyle }>) {
  const t = useTheme(); return <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: t.background }, style]}>{children}</SafeAreaView>;
}
export function Card({ children, style }: PropsWithChildren<{ style?: ViewStyle }>) {
  const t = useTheme(); return <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }, style]}>{children}</View>;
}
export function PrimaryButton({ title, onPress, disabled, kind='primary' }: { title: string; onPress: () => void; disabled?: boolean; kind?: 'primary'|'secondary'|'danger' }) {
  const t = useTheme(); const backgroundColor = kind === 'primary' ? t.accent : kind === 'danger' ? `${t.danger}1F` : t.elevated; const color = kind === 'primary' ? '#07150C' : kind === 'danger' ? t.danger : t.text;
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.button, { backgroundColor, opacity: disabled ? .45 : pressed ? .75 : 1 }]}><Text style={[styles.buttonText, { color }]}>{title}</Text></Pressable>;
}
export function EmptyState({ icon, title, body }: { icon: string; title: string; body: string }) {
  const t=useTheme(); return <View style={styles.empty}><Text style={styles.emptyIcon}>{icon}</Text><Text style={[styles.emptyTitle,{color:t.text}]}>{title}</Text><Text style={[styles.emptyBody,{color:t.secondary}]}>{body}</Text></View>;
}
export function Loading() { const t=useTheme(); return <View style={[styles.loading,{backgroundColor:t.background}]}><ActivityIndicator size="large" color={t.accent}/></View>; }

const styles=StyleSheet.create({ screen:{flex:1}, card:{borderWidth:1,borderRadius:18,padding:16}, button:{minHeight:52,borderRadius:14,alignItems:'center',justifyContent:'center',paddingHorizontal:18}, buttonText:{fontSize:17,fontWeight:'700'}, empty:{alignItems:'center',justifyContent:'center',padding:36,gap:8},emptyIcon:{fontSize:38},emptyTitle:{fontSize:20,fontWeight:'800'},emptyBody:{fontSize:15,textAlign:'center',lineHeight:21},loading:{flex:1,alignItems:'center',justifyContent:'center'} });
