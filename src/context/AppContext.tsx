import React, { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import * as Linking from 'expo-linking';
import * as Network from 'expo-network';
import { Session } from '@supabase/supabase-js';
import { getActiveWorkout, getPreferences, initializeDatabase } from '../data/database';
import { currentSession, handleAuthUrl, supabase } from '../data/supabase';
import { pushPending } from '../data/sync';
import { SyncStatus, UserPreferences, WorkoutSession } from '../types';
import { cancelRestNotification, startRestNotification } from '../services/timer';

type AppValue = {
  ready: boolean; revision: number; refresh: () => void; activeWorkout: WorkoutSession | null;
  preferences: UserPreferences; session: Session | null; syncStatus: SyncStatus;
  syncNow: () => Promise<void>; timerEnd: number | null; startTimer: () => Promise<void>; cancelTimer: () => Promise<void>;
};

const defaults: UserPreferences = { unit: 'lb', restSeconds: 90, updatedAt: '' };
const AppContext = createContext<AppValue | null>(null);

export function AppProvider({ children }: PropsWithChildren) {
  const [ready, setReady] = useState(false); const [revision, setRevision] = useState(0);
  const [activeWorkout, setActiveWorkout] = useState<WorkoutSession | null>(null);
  const [preferences, setPreferences] = useState(defaults); const [session, setSession] = useState<Session | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('offline'); const [timerEnd, setTimerEnd] = useState<number | null>(null);
  const syncPromise = useRef<Promise<void> | null>(null);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  const load = useCallback(async () => { setActiveWorkout(await getActiveWorkout()); setPreferences(await getPreferences()); }, []);
  const syncNow = useCallback(async () => {
    if (syncPromise.current) return syncPromise.current;
    const run = (async () => {
      if (!ready || !session) { setSyncStatus('offline'); return; }
      setSyncStatus('syncing'); setSyncStatus(await pushPending(session)); await load(); setRevision((value) => value + 1);
    })();
    syncPromise.current = run;
    try { await run; } finally { if (syncPromise.current === run) syncPromise.current = null; }
  }, [ready, session, load]);
  useEffect(() => { initializeDatabase().then(async () => { const restoredSession=await currentSession(); console.info('[auth] restored session:', restoredSession?'authenticated':'none'); setSession(restoredSession); await load(); setReady(true); }); }, [load]);
  useEffect(() => { if (ready) load(); }, [ready, revision, load]);
  useEffect(() => { if (ready && session) syncNow(); }, [ready, session, syncNow]);
  useEffect(() => {
    const auth = supabase?.auth.onAuthStateChange((_event, next) => setSession((current) => current?.access_token === next?.access_token ? current : next)).data.subscription;
    const url = Linking.addEventListener('url', ({ url }) => handleAuthUrl(url).catch(console.warn));
    Linking.getInitialURL().then((value) => { if (value) handleAuthUrl(value).catch(console.warn); });
    return () => { auth?.unsubscribe(); url.remove(); };
  }, []);
  useEffect(() => {
    const state = AppState.addEventListener('change', (next) => next === 'active' && syncNow());
    const network = Network.addNetworkStateListener((next) => { if (next.isConnected) syncNow(); });
    return () => { state.remove(); network.remove(); };
  }, [syncNow]);
  const startTimer = useCallback(async () => { const end = Date.now() + preferences.restSeconds * 1000; setTimerEnd(end); await startRestNotification(preferences.restSeconds); }, [preferences.restSeconds]);
  const cancelTimer = useCallback(async () => { setTimerEnd(null); await cancelRestNotification(); }, []);
  const value = useMemo(() => ({ ready, revision, refresh, activeWorkout, preferences, session, syncStatus, syncNow, timerEnd, startTimer, cancelTimer }), [ready, revision, refresh, activeWorkout, preferences, session, syncStatus, syncNow, timerEnd, startTimer, cancelTimer]);
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() { const value = useContext(AppContext); if (!value) throw new Error('useApp must be inside AppProvider'); return value; }
