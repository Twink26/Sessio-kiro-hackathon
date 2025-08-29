import { ConfigurationService } from '../services/ConfigurationService';
import { ExtensionConfig } from '../interfaces/IConfigurationService';

/**
 * Helper class to provide easy access to configuration values
 * with type safety and default fallbacks
 */
export class ConfigurationHelper {
  private static instance: ConfigurationHelper;
  private configService: ConfigurationService;
  private currentConfig: ExtensionConfig;

  private constructor() {
    this.configService = new ConfigurationService();
    this.currentConfig = this.configService.getConfiguration();
    
    // Listen for configuration changes
    this.configService.onConfigurationChanged((config) => {
      this.currentConfig = config;
    });
  }

  public static getInstance(): ConfigurationHelper {
    if (!ConfigurationHelper.instance) {
      ConfigurationHelper.instance = new ConfigurationHelper();
    }
    return ConfigurationHelper.instance;
  }

  /**
   * Get the current configuration
   */
  public getConfig(): ExtensionConfig {
    return this.currentConfig;
  }

  /**
   * Check if the extension is enabled
   */
  public isEnabled(): boolean {
    return this.currentConfig.enabled;
  }

  /**
   * Check if AI summary is enabled
   */
  public isAISummaryEnabled(): boolean {
    return this.currentConfig.enableAISummary && this.currentConfig.aiProvider !== 'disabled';
  }

  /**
   * Check if team dashboard is enabled
   */
  public isTeamDashboardEnabled(): boolean {
    return this.currentConfig.enableTeamDashboard;
  }

  /**
   * Get the maximum number of commits to show
   */
  public getMaxCommitsToShow(): number {
    return this.currentConfig.maxCommitsToShow;
  }

  /**
   * Get the AI provider configuration
   */
  public getAIProvider(): 'openai' | 'local' | 'disabled' {
    return this.currentConfig.aiProvider;
  }

  /**
   * Get OpenAI API key (only if provider is openai)
   */
  public getOpenAIApiKey(): string | null {
    if (this.currentConfig.aiProvider === 'openai') {
      return this.currentConfig.openaiApiKey || null;
    }
    return null;
  }

  /**
   * Get AI generation parameters
   */
  public getAIParameters(): { maxTokens: number; temperature: number } {
    return {
      maxTokens: this.currentConfig.aiMaxTokens,
      temperature: this.currentConfig.aiTemperature
    };
  }

  /**
   * Check if data should be shared with team
   */
  public shouldShareWithTeam(): boolean {
    return this.currentConfig.privacySettings.shareWithTeam;
  }

  /**
   * Get file patterns to exclude from tracking
   */
  public getExcludeFilePatterns(): string[] {
    return this.currentConfig.privacySettings.excludeFilePatterns;
  }

  /**
   * Get commit patterns to exclude from tracking
   */
  public getExcludeCommitPatterns(): string[] {
    return this.currentConfig.privacySettings.excludeCommitPatterns;
  }

  /**
   * Check if a file should be excluded based on patterns
   */
  public shouldExcludeFile(filePath: string): boolean {
    const patterns = this.getExcludeFilePatterns();
    return patterns.some(pattern => {
      // Simple glob pattern matching
      // Escape special regex characters except * and ?
      const escapedPattern = pattern
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '.*')
        .replace(/\?/g, '.');
      const regex = new RegExp(`^${escapedPattern}$`);
      return regex.test(filePath);
    });
  }

  /**
   * Check if a commit should be excluded based on patterns
   */
  public shouldExcludeCommit(commitMessage: string): boolean {
    const patterns = this.getExcludeCommitPatterns();
    return patterns.some(pattern => commitMessage.toLowerCase().includes(pattern.toLowerCase()));
  }

  /**
   * Update a configuration value
   */
  public async updateConfiguration(key: string, value: any): Promise<void> {
    await this.configService.updateConfiguration(key, value);
  }

  /**
   * Validate configuration values
   */
  public validateConfiguration(config: Partial<ExtensionConfig>) {
    return this.configService.validateConfiguration(config);
  }

  /**
   * Dispose resources
   */
  public dispose(): void {
    this.configService.dispose();
  }
}