import { createContext, useContext, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isOfflineSession: boolean;
  signOut: () => Promise<void>;
  offlineSignIn: (userId: string, email: string) => void;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  session: null,
  loading: true,
  isOfflineSession: false,
  signOut: async () => {},
  offlineSignIn: () => {},
});

function makeOfflineUser(userId: string, email: string): User {
  return {
    id: userId,
    email,
    app_metadata: {},
    user_metadata: {},
    aud: 'authenticated',
    created_at: '',
  } as unknown as User;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [offlineUser, setOfflineUser] = useState<User | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      // Se torna online con una sessione valida, rimuovi il login offline
      if (s) setOfflineUser(null);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function signOut() {
    setOfflineUser(null);
    await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
    Object.keys(localStorage)
      .filter(k => k.startsWith('sb-'))
      .forEach(k => localStorage.removeItem(k));
    setSession(null);
  }

  function offlineSignIn(userId: string, email: string) {
    setOfflineUser(makeOfflineUser(userId, email));
  }

  const effectiveUser = session?.user ?? offlineUser ?? null;

  return (
    <AuthContext.Provider value={{
      user: effectiveUser,
      session,
      loading,
      isOfflineSession: !session && !!offlineUser,
      signOut,
      offlineSignIn,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
