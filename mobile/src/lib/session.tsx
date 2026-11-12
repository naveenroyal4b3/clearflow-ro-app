import NetInfo from '@react-native-community/netinfo';
import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { cachedWorkspace, cacheWorkspace, clearCachedWorkspace } from './cache';
import { reportError } from './errors';
import { errorMessage } from './format';
import { loadWorkspace, signedInElsewhere } from './shared';
import { supabase } from './supabase';
import { emptyData, type Organization, type Profile, type WorkspaceData } from './types';

export type SessionStatus = 'loading' | 'signed-out' | 'needs-setup' | 'ready';

type SessionState = {
  status: SessionStatus;
  session: Session | null;
  profile: Profile | null;
  organization: Organization | null;
  data: WorkspaceData;
  // When set, the workspace came from this device's cache and is read-only.
  offlineSince: string | null;
  // Shown on the sign-in screen, for example after a refused second-device sign-in.
  authMessage: string;
};

type SessionContextValue = SessionState & {
  // Finishes a sign-in: refuses it while the account is signed in elsewhere, then loads the workspace.
  finishSignIn: (session: Session) => Promise<void>;
  reload: () => Promise<void>;
  signOut: () => Promise<void>;
  setAuthMessage: (message: string) => void;
  setOrganization: (organization: Organization) => void;
  setData: (update: (data: WorkspaceData) => WorkspaceData) => void;
};

export const signedInElsewhereMessage = 'This account is already signed in on another device. Sign out there first, or use "Forgot password?" to sign out of all devices.';

const initialState: SessionState = { status: 'loading', session: null, profile: null, organization: null, data: emptyData, offlineSince: null, authMessage: '' };
const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>(initialState);
  const sessionRef = useRef<Session | null>(null);
  const offlineRef = useRef(false);
  useEffect(() => { offlineRef.current = Boolean(state.offlineSince); }, [state.offlineSince]);

  const signedOut = useCallback((authMessage = '') => {
    sessionRef.current = null;
    clearCachedWorkspace();
    setState({ ...initialState, status: 'signed-out', authMessage });
  }, []);

  const openWorkspace = useCallback(async (session: Session) => {
    sessionRef.current = session;
    try {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('user_id, organization_id, role, full_name, login_email, phone, business_name, business_address, gstin, customer_id, active')
        .eq('user_id', session.user.id)
        .single();
      if (profileError) throw profileError;
      if (!profile.active) {
        await supabase.auth.signOut({ scope: 'local' });
        signedOut('This account has been disabled. Contact your business owner.');
        return;
      }
      if (!profile.organization_id) {
        setState(current => ({ ...current, status: 'needs-setup', session, profile, organization: null, data: emptyData, offlineSince: null }));
        return;
      }
      const { data: organization, error: organizationError } = await supabase.from('organizations').select('*').eq('id', profile.organization_id).single();
      if (organizationError) throw organizationError;
      const data = (await loadWorkspace(supabase, profile)) as WorkspaceData;
      cacheWorkspace({ userId: session.user.id, profile, organization, data });
      setState(current => ({ ...current, status: 'ready', session, profile, organization, data, offlineSince: null, authMessage: '' }));
    } catch (error) {
      // Without signal, show the last workspace synced to this device, read-only.
      const network = await NetInfo.fetch();
      const cached = cachedWorkspace(session.user.id);
      if (!network.isConnected && cached) {
        setState(current => ({ ...current, status: 'ready', session, profile: cached.profile, organization: cached.organization, data: cached.data, offlineSince: cached.savedAt }));
        return;
      }
      reportError(error, 'openWorkspace');
      await supabase.auth.signOut({ scope: 'local' });
      signedOut(errorMessage(error, 'Your business could not be loaded. Try again.'));
    }
  }, [signedOut]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) openWorkspace(data.session);
      else signedOut();
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') signedOut();
      if (event === 'TOKEN_REFRESHED' && session) sessionRef.current = session;
    });
    // Coming back online replaces the cached workspace with fresh data.
    const unsubscribe = NetInfo.addEventListener(network => {
      if (network.isConnected && offlineRef.current && sessionRef.current) openWorkspace(sessionRef.current);
    });
    return () => { listener.subscription.unsubscribe(); unsubscribe(); };
  }, [openWorkspace, signedOut]);

  const value = useMemo<SessionContextValue>(() => ({
    ...state,
    finishSignIn: async session => {
      if (await signedInElsewhere(supabase)) {
        await supabase.auth.signOut({ scope: 'local' });
        signedOut(signedInElsewhereMessage);
        return;
      }
      await openWorkspace(session);
    },
    reload: async () => { if (sessionRef.current) await openWorkspace(sessionRef.current); },
    signOut: async () => {
      const { error } = await supabase.auth.signOut();
      // Without signal the server sign-out fails; still forget this device's session.
      if (error) await supabase.auth.signOut({ scope: 'local' });
      signedOut();
    },
    setAuthMessage: authMessage => setState(current => ({ ...current, authMessage })),
    setOrganization: organization => setState(current => ({ ...current, organization })),
    setData: update => setState(current => ({ ...current, data: update(current.data) }))
  }), [state, openWorkspace, signedOut]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside SessionProvider');
  return value;
}
