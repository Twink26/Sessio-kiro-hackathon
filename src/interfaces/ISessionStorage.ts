import { SessionData } from '../models/SessionData';

/**
 * Interface for session storage operations
 */
export interface ISessionStorage {
  /**
   * Save session data to persistent storage
   */
  saveSession(sessionData: SessionData): Promise<void>;

  /**
   * Load the most recent session data
   */
  loadLastSession(): Promise<SessionData | null>;

  /**
   * Load session data by session ID
   */
  loadSession(sessionId: string): Promise<SessionData | null>;

  /**
   * Get all stored session IDs
   */
  getAllSessionIds(): Promise<string[]>;

  /**
   * Delete a specific session 
   */
  deleteSession(sessionId: string): Promise<void>;

  /**
   * Clear all stored sessions
   */
  clearAllSessions(): Promise<void>;

  /**
   * Check if storage is available and writable
   */
  isAvailable(): Promise<boolean>;
}