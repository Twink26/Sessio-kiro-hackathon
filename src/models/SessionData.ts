import { FileEdit } from './FileEdit';
import { GitCommit } from './GitCommit';
import { TerminalError } from './TerminalError';

/**
 * Complete session data structure
 */
export interface SessionData {
  sessionId: string;
  startTime: Date;
  endTime?: Date;
  editedFiles: FileEdit[];
  gitCommits: GitCommit[];
  terminalErrors: TerminalError[];
  summary?: string;
}