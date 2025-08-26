import { SessionData } from '../models/SessionData';

/**
 * Generates natural language summaries of session data
 */
export interface IAISummaryService {
  /**
   * Generate a natural language summary from session data
   */
  generateSummary(sessionData: SessionData): Promise<string>;

  /**
   * Check if the AI service is available and configured
   */
  isAvailable(): boolean;
}