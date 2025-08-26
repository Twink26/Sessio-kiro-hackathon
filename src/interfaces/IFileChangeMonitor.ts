import { FileEdit } from '../models/FileEdit';

/**
 * Tracks which files were actually modified during the session
 */
export interface IFileChangeMonitor {
  /**
   * Register a callback for when files are changed
   */
  onFileChanged(callback: (file: FileEdit) => void): void;

  /**
   * Get all files that have been edited in the current session
   */
  getEditedFiles(): FileEdit[];

  /**
   * Reset the monitor state (clear tracked files)
   */
  reset(): void;
}