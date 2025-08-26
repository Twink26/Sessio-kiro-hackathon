/**
 * Extension configuration interface
 */
export interface ExtensionConfig {
  enabled: boolean;
  maxCommitsToShow: number;
  enableAISummary: boolean;
  enableTeamDashboard: boolean;
  aiProvider: 'openai' | 'local' | 'disabled';
  privacySettings: {
    shareWithTeam: boolean;
    excludeFilePatterns: string[];
    excludeCommitPatterns: string[];
  };
}