import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { TrainingSession, SessionParticipant, SessionRole, SessionEvent, KeyAuthorization } from '../types/session';
import '../styles/simulator.css';

interface Props {
  sessionId: string;
  userId: string;
  onLeaveSession: () => void;
}

export default function Simulator({ sessionId, userId, onLeaveSession }: Props) {
  const [session, setSession] = useState<TrainingSession | null>(null);
  const [participants, setParticipants] = useState<SessionParticipant[]>([]);
  const [events, setEvents] = useState<SessionEvent[]>([]);
  const [userRole, setUserRole] = useState<SessionRole | null>(null);
  const [keyAuth, setKeyAuth] = useState<KeyAuthorization | null>(null);
  
  const [operatorAKey, setOperatorAKey] = useState('');
  const [operatorBKey, setOperatorBKey] = useState('');
  const [commandKey, setCommandKey] = useState('');
  
  const eventsEndRef = useRef<HTMLDivElement>(null);

  // Load session data
  useEffect(() => {
    loadSessionData();
    const interval = setInterval(loadSessionData, 2000);
    return () => clearInterval(interval);
  }, [sessionId]);

  // Scroll to latest events
  useEffect(() => {
    eventsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events]);

  const loadSessionData = async () => {
    // Update last_seen
    await supabase
      .from('session_participants')
      .update({ last_seen: new Date().toISOString() })
      .eq('session_id', sessionId)
      .eq('user_id', userId);

    // Load session
    const { data: sessionData } = await supabase
      .from('training_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (sessionData) setSession(sessionData);

    // Load participants with user data
    const { data: participantsData } = await supabase
      .from('session_participants')
      .select(`
        *,
        user:user_profiles(username, email)
      `)
      .eq('session_id', sessionId)
      .order('joined_at');

    if (participantsData) {
      setParticipants(participantsData);
      const me = participantsData.find(p => p.user_id === userId);
      if (me) setUserRole(me.role as SessionRole);
    }

    // Load events
    const { data: eventsData } = await supabase
      .from('session_events')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (eventsData) setEvents(eventsData.reverse());

    // Load key authorization
    const { data: keyAuthData } = await supabase
      .from('key_authorizations')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (keyAuthData) setKeyAuth(keyAuthData);
  };

  const logEvent = async (eventType: string, eventData: any = {}) => {
    await supabase.from('session_events').insert({
      session_id: sessionId,
      user_id: userId,
      event_type: eventType,
      event_data: eventData,
    });
  };

  const updateSessionState = async (updates: Partial<TrainingSession['system_state']>) => {
    if (!session) return;

    const newState = { ...session.system_state, ...updates };
    
    await supabase
      .from('training_sessions')
      .update({ system_state: newState })
      .eq('id', sessionId);
  };

  const handleInitialize = async () => {
    await updateSessionState({ initialized: true });
    await logEvent('system_initialized', { step: 1 });
    await supabase
      .from('training_sessions')
      .update({ current_step: 1, status: 'active' })
      .eq('id', sessionId);
  };

  const handleDiagnostics = async () => {
    await logEvent('diagnostics_started', { step: 2 });
    
    // Simulate diagnostics check
    setTimeout(async () => {
      const passed = Math.random() > 0.1; // 90% success rate
      await updateSessionState({ diagnosticsPassed: passed });
      await logEvent('diagnostics_completed', { passed, step: 2 });
      if (passed) {
        await supabase
          .from('training_sessions')
          .update({ current_step: 2 })
          .eq('id', sessionId);
      }
    }, 3000);
  };

  const handleKeySubmit = async () => {
    if (!session || !userRole) return;

    const isOperatorA = userRole === 'operator_a';
    const isOperatorB = userRole === 'operator_b';

    if (isOperatorA && operatorAKey.length === 8) {
      // Create or update key authorization
      if (keyAuth) {
        await supabase
          .from('key_authorizations')
          .update({
            operator_a_key: operatorAKey,
            operator_a_auth_at: new Date().toISOString(),
          })
          .eq('id', keyAuth.id);
      } else {
        await supabase.from('key_authorizations').insert({
          session_id: sessionId,
          operator_a_key: operatorAKey,
          operator_a_auth_at: new Date().toISOString(),
        });
      }
      
      await logEvent('operator_a_authenticated', { step: 3 });
      setOperatorAKey('');
    }

    if (isOperatorB && operatorBKey.length === 8) {
      if (keyAuth) {
        await supabase
          .from('key_authorizations')
          .update({
            operator_b_key: operatorBKey,
            operator_b_auth_at: new Date().toISOString(),
          })
          .eq('id', keyAuth.id);
      } else {
        await supabase.from('key_authorizations').insert({
          session_id: sessionId,
          operator_b_key: operatorBKey,
          operator_b_auth_at: new Date().toISOString(),
        });
      }
      
      await logEvent('operator_b_authenticated', { step: 3 });
      setOperatorBKey('');
    }

    // Check if both operators authenticated
    setTimeout(async () => {
      const { data: authData } = await supabase
        .from('key_authorizations')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (authData?.operator_a_auth_at && authData?.operator_b_auth_at) {
        await updateSessionState({ authenticated: true });
        await supabase
          .from('key_authorizations')
          .update({ status: 'complete' })
          .eq('id', authData.id);
        await supabase
          .from('training_sessions')
          .update({ current_step: 3 })
          .eq('id', sessionId);
        await logEvent('dual_key_authentication_complete', { step: 3 });
      }
    }, 500);
  };

  const handleLeaveSession = async () => {
    await supabase
      .from('session_participants')
      .delete()
      .eq('session_id', sessionId)
      .eq('user_id', userId);

    await logEvent('participant_left', { role: userRole });
    onLeaveSession();
  };

  if (!session) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        minHeight: '100vh',
        color: 'var(--accent-primary)',
        fontFamily: 'var(--font-mono)'
      }}>
        LOADING SESSION...
      </div>
    );
  }

  const state = session.system_state;
  const isInstructor = userRole === 'instructor';
  const isOperatorA = userRole === 'operator_a';
  const isOperatorB = userRole === 'operator_b';
  const isObserver = userRole === 'observer';

  return (
    <div className="simulator-container">
      <header className="simulator-header">
        <div className="header-left">
          <div className="system-title">STRATEGIC COMMAND SIMULATOR v2.4.1</div>
          <div className="session-code">SESSION: {session.session_code}</div>
        </div>
        <div className="header-right">
          <div className="run-id">RUN ID: {session.run_id}</div>
          <div className="role-badge" data-role={userRole}>{userRole?.toUpperCase().replace('_', ' ')}</div>
          <button className="btn-leave" onClick={handleLeaveSession}>LEAVE</button>
        </div>
      </header>

      <div className="classification-banner">
        CLASSIFICATION: UNCLASSIFIED // FOR TRAINING USE ONLY
      </div>

      <div className="simulator-grid">
        {/* Control Panel */}
        <div className="panel control-panel">
          <div className="panel-header">
            <span>MISSION CONTROL</span>
            <span className="status-indicator" data-status={session.status}>
              {session.status.toUpperCase()}
            </span>
          </div>
          
          <div className="panel-body">
            <div className="step-section">
              <div className="step-title">STEP 1: SYSTEM INITIALIZATION</div>
              {!state.initialized ? (
                <button 
                  className="btn btn-primary"
                  onClick={handleInitialize}
                  disabled={isObserver}
                >
                  INITIALIZE SYSTEM
                </button>
              ) : (
                <div className="status-check status-ready">✓ SYSTEM INITIALIZED</div>
              )}
            </div>

            {state.initialized && (
              <div className="step-section">
                <div className="step-title">STEP 2: DIAGNOSTICS</div>
                {!state.diagnosticsPassed ? (
                  <button 
                    className="btn btn-primary"
                    onClick={handleDiagnostics}
                    disabled={isObserver}
                  >
                    RUN DIAGNOSTICS
                  </button>
                ) : (
                  <div className="status-check status-ready">✓ DIAGNOSTICS PASSED</div>
                )}
              </div>
            )}

            {state.diagnosticsPassed && (
              <div className="step-section">
                <div className="step-title">STEP 3: KEY AUTHENTICATION</div>
                
                {isOperatorA && (
                  <div className="key-input-group">
                    <label>OPERATOR A KEY</label>
                    <input
                      type="password"
                      className="input-field"
                      value={operatorAKey}
                      onChange={(e) => setOperatorAKey(e.target.value.toUpperCase())}
                      maxLength={8}
                      placeholder="8 CHARACTER KEY"
                    />
                    <button 
                      className="btn btn-sm btn-primary"
                      onClick={handleKeySubmit}
                      disabled={operatorAKey.length !== 8 || !!keyAuth?.operator_a_auth_at}
                    >
                      {keyAuth?.operator_a_auth_at ? '✓ AUTHENTICATED' : 'SUBMIT KEY'}
                    </button>
                  </div>
                )}

                {isOperatorB && (
                  <div className="key-input-group">
                    <label>OPERATOR B KEY</label>
                    <input
                      type="password"
                      className="input-field"
                      value={operatorBKey}
                      onChange={(e) => setOperatorBKey(e.target.value.toUpperCase())}
                      maxLength={8}
                      placeholder="8 CHARACTER KEY"
                    />
                    <button 
                      className="btn btn-sm btn-primary"
                      onClick={handleKeySubmit}
                      disabled={operatorBKey.length !== 8 || !!keyAuth?.operator_b_auth_at}
                    >
                      {keyAuth?.operator_b_auth_at ? '✓ AUTHENTICATED' : 'SUBMIT KEY'}
                    </button>
                  </div>
                )}

                {(isInstructor || isObserver) && (
                  <div className="auth-status">
                    <div>Operator A: {keyAuth?.operator_a_auth_at ? '✓ AUTHENTICATED' : '⏳ PENDING'}</div>
                    <div>Operator B: {keyAuth?.operator_b_auth_at ? '✓ AUTHENTICATED' : '⏳ PENDING'}</div>
                  </div>
                )}

                {state.authenticated && (
                  <div className="status-check status-ready">✓ DUAL KEY AUTHENTICATION COMPLETE</div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Participants Panel */}
        <div className="panel participants-panel">
          <div className="panel-header">
            <span>PARTICIPANTS ({participants.length})</span>
          </div>
          <div className="panel-body">
            {participants.map((p) => {
              const isActive = new Date(p.last_seen).getTime() > Date.now() - 10000;
              return (
                <div key={p.id} className="participant-row">
                  <div className="participant-status" data-active={isActive}>
                    {isActive ? '●' : '○'}
                  </div>
                  <div className="participant-info">
                    <div className="participant-name">
                      {p.user?.username || 'Unknown'}
                    </div>
                    <div className="participant-role" data-role={p.role}>
                      {p.role.toUpperCase().replace('_', ' ')}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Event Log */}
        <div className="panel event-log-panel">
          <div className="panel-header">
            <span>EVENT LOG</span>
          </div>
          <div className="panel-body event-log">
            {events.map((event) => (
              <div key={event.id} className="event-entry">
                <span className="event-time">
                  {new Date(event.created_at).toLocaleTimeString()}
                </span>
                <span className="event-type">{event.event_type.toUpperCase().replace('_', ' ')}</span>
              </div>
            ))}
            <div ref={eventsEndRef} />
          </div>
        </div>
      </div>
    </div>
  );
}
