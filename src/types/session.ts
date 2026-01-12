export type SessionRole = 'operator_a' | 'operator_b' | 'observer' | 'instructor';
export type SessionStatus = 'waiting' | 'active' | 'paused' | 'completed';
export type KeyAuthStatus = 'pending' | 'partial' | 'complete';

export interface TrainingSession {
  id: string;
  session_code: string;
  created_by: string;
  status: SessionStatus;
  run_id: string;
  current_step: number;
  system_state: SystemState;
  created_at: string;
  updated_at: string;
}

export interface SessionParticipant {
  id: string;
  session_id: string;
  user_id: string;
  role: SessionRole;
  joined_at: string;
  last_seen: string;
  user?: {
    username: string;
    email: string;
  };
}

export interface SessionEvent {
  id: string;
  session_id: string;
  user_id: string | null;
  event_type: string;
  event_data: Record<string, any>;
  created_at: string;
}

export interface KeyAuthorization {
  id: string;
  session_id: string;
  operator_a_key: string | null;
  operator_b_key: string | null;
  command_key: string | null;
  operator_a_auth_at: string | null;
  operator_b_auth_at: string | null;
  command_auth_at: string | null;
  status: KeyAuthStatus;
  created_at: string;
}

export interface SystemState {
  initialized: boolean;
  diagnosticsPassed: boolean;
  authenticated: boolean;
  armed: boolean;
  countdownActive: boolean;
  countdownAbortable: boolean;
  countdownSeconds: number;
  systemLocked: boolean;
  lockType: string | null;
  systemHold: boolean;
  faultInjected: boolean;
  adminForcedOutcome: string | null;
  activeScenario: string | null;
  subsystems: Record<string, { status: string; value: string }>;
  delayMultiplier: number;
  latencyEnabled: boolean;
}
