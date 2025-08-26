/**
 * Represents a Git commit made during the session
 */
export interface GitCommit {
  hash: string;
  message: string;
  author: string;
  timestamp: Date;
  filesChanged: string[];
}