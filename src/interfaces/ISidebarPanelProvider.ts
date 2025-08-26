import { SessionData } from '../models/SessionData';

/**
 * Manages the VS Code webview panel for displaying session recap
 */
export interface ISidebarPanelProvider {
  /**
   * Show the sidebar panel
   */
  show(): void;

  /**
   * Hide the sidebar panel
   */
  hide(): void;

  /**
   * Update the panel content with new session data
   */
  updateContent(sessionData: SessionData): void;

  /**
   * Register a callback for when files are clicked in the panel
   */
  onFileClick(callback: (filePath: string) => void): void;
}