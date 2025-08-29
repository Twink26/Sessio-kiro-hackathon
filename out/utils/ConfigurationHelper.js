"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigurationHelper = void 0;
const ConfigurationService_1 = require("../services/ConfigurationService");
/**
 * Helper class to provide easy access to configuration values
 * with type safety and default fallbacks
 */
class ConfigurationHelper {
    constructor() {
        this.configService = new ConfigurationService_1.ConfigurationService();
        this.currentConfig = this.configService.getConfiguration();
        // Listen for configuration changes
        this.configService.onConfigurationChanged((config) => {
            this.currentConfig = config;
        });
    }
    static getInstance() {
        if (!ConfigurationHelper.instance) {
            ConfigurationHelper.instance = new ConfigurationHelper();
        }
        return ConfigurationHelper.instance;
    }
    /**
     * Get the current configuration
     */
    getConfig() {
        return this.currentConfig;
    }
    /**
     * Check if the extension is enabled
     */
    isEnabled() {
        return this.currentConfig.enabled;
    }
    /**
     * Check if AI summary is enabled
     */
    isAISummaryEnabled() {
        return this.currentConfig.enableAISummary && this.currentConfig.aiProvider !== 'disabled';
    }
    /**
     * Check if team dashboard is enabled
     */
    isTeamDashboardEnabled() {
        return this.currentConfig.enableTeamDashboard;
    }
    /**
     * Get the maximum number of commits to show
     */
    getMaxCommitsToShow() {
        return this.currentConfig.maxCommitsToShow;
    }
    /**
     * Get the AI provider configuration
     */
    getAIProvider() {
        return this.currentConfig.aiProvider;
    }
    /**
     * Get OpenAI API key (only if provider is openai)
     */
    getOpenAIApiKey() {
        if (this.currentConfig.aiProvider === 'openai') {
            return this.currentConfig.openaiApiKey || null;
        }
        return null;
    }
    /**
     * Get AI generation parameters
     */
    getAIParameters() {
        return {
            maxTokens: this.currentConfig.aiMaxTokens,
            temperature: this.currentConfig.aiTemperature
        };
    }
    /**
     * Check if data should be shared with team
     */
    shouldShareWithTeam() {
        return this.currentConfig.privacySettings.shareWithTeam;
    }
    /**
     * Get file patterns to exclude from tracking
     */
    getExcludeFilePatterns() {
        return this.currentConfig.privacySettings.excludeFilePatterns;
    }
    /**
     * Get commit patterns to exclude from tracking
     */
    getExcludeCommitPatterns() {
        return this.currentConfig.privacySettings.excludeCommitPatterns;
    }
    /**
     * Check if a file should be excluded based on patterns
     */
    shouldExcludeFile(filePath) {
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
    shouldExcludeCommit(commitMessage) {
        const patterns = this.getExcludeCommitPatterns();
        return patterns.some(pattern => commitMessage.toLowerCase().includes(pattern.toLowerCase()));
    }
    /**
     * Update a configuration value
     */
    async updateConfiguration(key, value) {
        await this.configService.updateConfiguration(key, value);
    }
    /**
     * Validate configuration values
     */
    validateConfiguration(config) {
        return this.configService.validateConfiguration(config);
    }
    /**
     * Dispose resources
     */
    dispose() {
        this.configService.dispose();
    }
}
exports.ConfigurationHelper = ConfigurationHelper;
//# sourceMappingURL=ConfigurationHelper.js.map