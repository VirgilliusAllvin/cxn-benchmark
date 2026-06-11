import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { fetchProfile } from '../lib/db';
import type { UserProfile } from '../lib/types';

interface AuthContextValue {
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  profile: null,
  loading: true,
  signOut: async () => {},
});

/** Tenta carregar o perfil com timeout de 8 segundos */
async function safeLoadProfile(userId: string): Promise<UserProfile | null> {
  try {
    const timeout = new Promise<null>(resolve => setTimeout(() => resolve(null), 8000));
    const result = fetchProfile(userId);
    return await Promise.race([result, timeout]);
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession]   = useState<Session | null>(null);
  const [profile, setProfile]   = useState<UserProfile | null>(null);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    let mounted = true;

    // Carregar sessão inicial
    supabase.auth.getSession().then(async ({ data: { session }, error }) => {
      if (!mounted) return;
      console.log('[Auth] getSession:', session?.user?.email ?? 'no session', error ?? '');
      setSession(session ?? null);
      if (session?.user) {
        const p = await safeLoadProfile(session.user.id);
        console.log('[Auth] profile:', p);
        if (mounted) setProfile(p);
      }
      if (mounted) setLoading(false);
    }).catch(err => {
      console.error('[Auth] getSession error:', err);
      if (mounted) setLoading(false);
    });

    // Subscrever mudanças de auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      console.log('[Auth] onAuthStateChange:', event, session?.user?.email ?? 'no session');
      setSession(session ?? null);
      if (session?.user) {
        const p = await safeLoadProfile(session.user.id);
        console.log('[Auth] profile from event:', p);
        if (mounted) setProfile(p);
      } else {
        if (mounted) setProfile(null);
      }
      if (mounted) setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
  }

  return (
    <AuthContext.Provider value={{ session, profile, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
