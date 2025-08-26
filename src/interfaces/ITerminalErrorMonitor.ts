import { TerminalError } from '../models/TerminalError';

/**
 * Captures error output from integrated terminal
 */
export interface ITerminalErrorMonitor {
  /**
   * Register a callback for when terminal errors occur
   */
  onTerminalError(callback: (error: TerminalError) => void): void;

  /**
   * Get the most recent terminal error
   */
  getLastError(): TerminalError | null;

  /**
   * Reset the monitor state (clear tracked errors)
   */
  reset(): void;
}