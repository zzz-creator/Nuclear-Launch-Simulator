import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { TrainingSession } from '../types/session';
import '../styles/lobby.css';

interface Props {
  userId: string;
  onJoinSession: (sessionId: string) => void;
}

export default function SessionLobby({ userId, onJoinSession }: Props) {
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [sessionCode, setSessionCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadActiveSessions();
    const interval = setInterval(loadActiveSessions, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadActiveSessions = async () => {
    const { data } = await supabase
      .from('training_sessions')
      .select('*')
      .in('status', ['waiting', 'active'])
      .order('created_at', { ascending: false })
      .limit(10);

    if (data) setSessions(data);
  };

  const createSession = async () => {
    setLoading(true);
    setError('');

    try {
      // Generate session code
      const { data: codeData, error: codeError } = await supabase
        .rpc('generate_session_code');

      if (codeError) throw codeError;

      const sessionCode = codeData;
      const runId = `RUN-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

      // Create session
      const { data: session, error: sessionError } = await supabase
        .from('training_sessions')
        .insert({
          session_code: sessionCode,
          created_by: userId,
          status: 'waiting',
          run_id: runId,
          current_step: 0,
          system_state: {
            initialized: false,
            diagnosticsPassed: false,
            authenticated: false,
            armed: false,
            countdownActive: false,
            countdownAbortable: true,
            countdownSeconds: 60,
            systemLocked: false,
            lockType: null,
            systemHold: false,
            faultInjected: false,
            adminForcedOutcome: null,
            activeScenario: null,
            subsystems: {},
            delayMultiplier: 1.0,
            latencyEnabled: true,
          },
        })
        .select()
        .single();

      if (sessionError) throw sessionError;

      // Add creator as instructor
      const { error: participantError } = await supabase
        .from('session_participants')
        .insert({
          session_id: session.id,
          user_id: userId,
          role: 'instructor',
        });

      if (participantError) throw participantError;

      onJoinSession(session.id);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const joinSession = async (code: string) => {
    setLoading(true);
    setError('');

    try {
      // Find session by code
      const { data: session, error: sessionError } = await supabase
        .from('training_sessions')
        .select('*')
        .eq('session_code', code.toUpperCase())
        .single();

      if (sessionError) throw new Error('Session not found');

      // Check if already a participant
      const { data: existingParticipant } = await supabase
        .from('session_participants')
        .select('id')
        .eq('session_id', session.id)
        .eq('user_id', userId)
        .single();

      if (existingParticipant) {
        onJoinSession(session.id);
        return;
      }

      // Determine role based on existing participants
      const { data: participants } = await supabase
        .from('session_participants')
        .select('role')
        .eq('session_id', session.id);

      const existingRoles = participants?.map(p => p.role) || [];
      let role = 'observer';

      if (!existingRoles.includes('operator_a')) {
        role = 'operator_a';
      } else if (!existingRoles.includes('operator_b')) {
        role = 'operator_b';
      }

      // Add as participant
      const { error: participantError } = await supabase
        .from('session_participants')
        .insert({
          session_id: session.id,
          user_id: userId,
          role,
        });

      if (participantError) throw participantError;

      // Log join event
      await supabase.from('session_events').insert({
        session_id: session.id,
        user_id: userId,
        event_type: 'participant_joined',
        event_data: { role },
      });

      onJoinSession(session.id);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="lobby-container">
      <header className="lobby-header">
        <div className="system-title">STRATEGIC COMMAND SIMULATOR v2.4.1</div>
        <button className="btn-logout" onClick={handleSignOut}>
          SIGN OUT
        </button>
      </header>

      <div className="classification-banner">
        CLASSIFICATION: UNCLASSIFIED // FOR TRAINING USE ONLY
      </div>

      <main className="lobby-content">
        <div className="lobby-section">
          <h2 className="section-title">CREATE NEW TRAINING SESSION</h2>
          <p className="section-desc">
            Start a new multi-operator training exercise with unique session code
          </p>
          <button
            className="btn btn-primary btn-large"
            onClick={createSession}
            disabled={loading}
          >
            {loading ? 'CREATING...' : 'CREATE SESSION'}
          </button>
        </div>

        <div className="lobby-divider">
          <span>OR</span>
        </div>

        <div className="lobby-section">
          <h2 className="section-title">JOIN EXISTING SESSION</h2>
          <p className="section-desc">Enter session code provided by instructor</p>
          {error && <div className="error-message">{error}</div>}
          <div className="join-form">
            <input
              type="text"
              className="input-field"
              placeholder="XXXX-XXXX"
              value={sessionCode}
              onChange={(e) => setSessionCode(e.target.value.toUpperCase())}
              maxLength={9}
            />
            <button
              className="btn btn-primary"
              onClick={() => joinSession(sessionCode)}
              disabled={loading || sessionCode.length < 9}
            >
              {loading ? 'JOINING...' : 'JOIN SESSION'}
            </button>
          </div>
        </div>

        <div className="lobby-section">
          <h2 className="section-title">ACTIVE SESSIONS</h2>
          <div className="sessions-list">
            {sessions.length === 0 ? (
              <div className="no-sessions">No active sessions available</div>
            ) : (
              sessions.map((session) => (
                <div key={session.id} className="session-card">
                  <div className="session-code">{session.session_code}</div>
                  <div className="session-info">
                    <div className="session-status">{session.status.toUpperCase()}</div>
                    <div className="session-run-id">{session.run_id}</div>
                  </div>
                  <button
                    className="btn btn-sm btn-primary"
                    onClick={() => joinSession(session.session_code)}
                    disabled={loading}
                  >
                    JOIN
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
