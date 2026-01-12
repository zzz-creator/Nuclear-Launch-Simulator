import { useState } from 'react';
import { supabase } from '../lib/supabase';
import '../styles/auth.css';

export default function AuthScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isSignUp) {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              username: username || email.split('@')[0],
            },
          },
        });

        if (signUpError) throw signUpError;
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) throw signInError;
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <div className="system-title">STRATEGIC COMMAND SIMULATOR v2.4.1</div>
          <div className="auth-subtitle">Multi-User Training System</div>
        </div>

        <div className="classification-banner">
          CLASSIFICATION: UNCLASSIFIED // FOR TRAINING USE ONLY
        </div>

        <form onSubmit={handleAuth} className="auth-form">
          <h2 className="auth-form-title">
            {isSignUp ? 'CREATE OPERATOR ACCOUNT' : 'OPERATOR AUTHENTICATION'}
          </h2>

          {error && <div className="auth-error">{error}</div>}

          {isSignUp && (
            <div className="input-group">
              <label className="input-label">OPERATOR CALLSIGN</label>
              <input
                type="text"
                className="input-field"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter callsign"
              />
            </div>
          )}

          <div className="input-group">
            <label className="input-label">EMAIL ADDRESS</label>
            <input
              type="email"
              className="input-field"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="operator@command.mil"
              required
            />
          </div>

          <div className="input-group">
            <label className="input-label">PASSWORD</label>
            <input
              type="password"
              className="input-field"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              required
            />
          </div>

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'PROCESSING...' : (isSignUp ? 'CREATE ACCOUNT' : 'AUTHENTICATE')}
          </button>

          <div className="auth-toggle">
            <button
              type="button"
              className="btn-link"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError('');
              }}
            >
              {isSignUp
                ? 'Already have an account? Sign In'
                : "Don't have an account? Sign Up"}
            </button>
          </div>
        </form>

        <div className="auth-footer">
          <p>🔐 Secure multi-operator training environment</p>
          <p>👥 Real-time collaborative launch procedures</p>
          <p>🎯 Role-based access control</p>
        </div>
      </div>
    </div>
  );
}
