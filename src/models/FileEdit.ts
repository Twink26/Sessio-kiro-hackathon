/**
 * Represents a file that was edited during the session
 */
export interface FileEdit {
  filePath: string;
  timestamp: Date;
  changeType: 'created' | 'modified' | 'deleted';
  lineCount?: number;
}