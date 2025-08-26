import { SessionData } from '../models/SessionData';

/**
 * Central coordinator for all session tracking activities
 */
export interface ISessionTracker {
  /**
   * Start tracking the current session
   */
  startTracking(): void;

  /**
   * Stop tracking the current session
   */
  stopTracking(): void;

  /**
   * Get the current active session data
   */
  getCurrentSession(): SessionData;

  /**
   * Get the previous session data if available
   */
  getPreviousSession(): SessionData | null;

  /**
   * Save the current session to persistent storage
   */
  saveSession(): Promise<void>;
}