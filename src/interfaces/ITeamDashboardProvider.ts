import { TeamSessionData } from './ITeamDataAggregator';

/**
 * Manages the VS Code webview panel for displaying team dashboard
 */
export interface ITeamDashboardProvider {
  /**
   * Show the team dashboard panel
   */
  show(): void;

  /**
   * Hide the team dashboard panel
   */
  hide(): void;

  /**
   * Update the panel content with new team data
   */
  updateContent(teamData: TeamSessionData): void;

  /**
   * Show authentication required message
   */
  showAuthenticationRequired(): void;

  /**
   * Show permission denied message
   */
  showPermissionDenied(): void;

  /**
   * Show opt-in required message
   */
  showOptInRequired(): void;

  /**
   * Register a callback for when user opts in to team sharing
   */
  onOptIn(callback: () => void): void;

  /**
   * Register a callback for when user requests authentication
   */
  onAuthenticate(callback: () => void): void;
}