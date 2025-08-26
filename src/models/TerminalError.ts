/**
 * Represents an error captured from the terminal
 */
export interface TerminalError {
  message: string;
  timestamp: Date;
  terminalName: string;
  errorType: 'error' | 'exception' | 'failure';
}