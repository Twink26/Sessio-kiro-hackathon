import { SessionData } from '../models/SessionData';

/**
 * Team member information
 */
export interface TeamMember {
  id: string;
  name: string;
  email: string;
  isOnline: boolean;
  lastActive: Date;
}

/**
 * Aggregated team session data
 */
export interface TeamSessionData {
  teamId: string;
  members: TeamMemberSession[];
  aggregatedAt: Date;
}

/**
 * Individual team member session data
 */
export interface TeamMemberSession {
  member: TeamMember;
  sessionData: SessionData | null;
  hasOptedIn: boolean;
  lastUpdated: Date;
}

/**
 * Team data sharing permissions
 */
export interface TeamDataPermissions {
  canViewTeamData: boolean;
  canViewMemberDetails: boolean;
  isTeamLead: boolean;
  teamId: string;
}

/**
 * Service for aggregating and managing team session data
 */
export interface ITeamDataAggregator {
  /**
   * Check if user has opted in to team data sharing
   */
  hasUserOptedIn(): Promise<boolean>;

  /**
   * Opt user in to team data sharing
   */
  optInToTeamSharing(): Promise<void>;

  /**
   * Opt user out of team data sharing
   */
  optOutOfTeamSharing(): Promise<void>;

  /**
   * Get current user's team permissions
   */
  getUserPermissions(): Promise<TeamDataPermissions | null>;

  /**
   * Get aggregated team session data
   */
  getTeamSessionData(): Promise<TeamSessionData | null>;

  /**
   * Share current user's session data with team (if opted in)
   */
  shareSessionData(sessionData: SessionData): Promise<void>;

  /**
   * Check if team dashboard is available for current user
   */
  isTeamDashboardAvailable(): Promise<boolean>;
}