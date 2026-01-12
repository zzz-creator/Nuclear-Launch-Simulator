import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import { User } from '@supabase/supabase-js';
import AuthScreen from './components/AuthScreen';
import SessionLobby from './components/SessionLobby';
import Simulator from './components/Simulator';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionId, setSessionId] = useState<string | null>(null);

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        color: 'var(--accent-primary)',
        fontFamily: 'var(--font-mono)',
        fontSize: '18px',
        letterSpacing: '2px'
      }}>
        INITIALIZING SYSTEM...
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  if (!sessionId) {
    return <SessionLobby userId={user.id} onJoinSession={setSessionId} />;
  }

  return <Simulator sessionId={sessionId} userId={user.id} onLeaveSession={() => setSessionId(null)} />;
}

export default App;
