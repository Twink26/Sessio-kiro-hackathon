import { GitCommit } from '../models/GitCommit';

/**
 * Monitors Git repository for commits and changes
 */
export interface IGitActivityMonitor {
  /**
   * Get commits made since the specified timestamp
   */
  getCommitsSince(timestamp: Date): Promise<GitCommit[]>;

  /**
   * Check if the current workspace is a Git repository
   */
  isGitRepository(): boolean;

  /**
   * Get the current Git branch name
   */
  getCurrentBranch(): Promise<string | null>;
}