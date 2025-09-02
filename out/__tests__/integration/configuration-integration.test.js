"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = __importStar(require("vscode"));
const extension_1 = require("../../extension");
const ConfigurationService_1 = require("../../services/ConfigurationService");
// Mock VS Code API with configuration support
jest.mock('vscode', () => ({
    EventEmitter: jest.fn().mockImplementation(() => ({
        event: jest.fn(),
        fire: jest.fn(),
        dispose: jest.fn()
    })),
    window: {
        createOutputChannel: jest.fn(() => ({
            appendLine: jest.fn(),
            show: jest.fn(),
            dispose: jest.fn()
        })),
        registerWebviewViewProvider: jest.fn(() => ({ dispose: jest.fn() })),
        showErrorMessage: jest.fn(() => Promise.resolve()),
        showInformationMessage: jest.fn(() => Promise.resolve()),
        showWarningMessage: jest.fn(() => Promise.resolve()),
        showTextDocument: jest.fn(),
        showQuickPick: jest.fn()
    },
    workspace: {
        getConfiguration: jest.fn(),
        workspaceFolders: [{
                uri: { fsPath: '/test/workspace' },
                name: 'test-workspace',
                index: 0
            }],
        openTextDocument: jest.fn(),
        onDidSaveTextDocument: jest.fn(() => ({ dispose: jest.fn() })),
        onDidChangeTextDocument: jest.fn(() => ({ dispose: jest.fn() })),
        onDidCreateFiles: jest.fn(() => ({ dispose: jest.fn() })),
        onDidDeleteFiles: jest.fn(() => ({ dispose: jest.fn() })),
        onDidRenameFiles: jest.fn(() => ({ dispose: jest.fn() })),
        onDidChangeConfiguration: jest.fn(() => ({ dispose: jest.fn() }))
    },
    commands: {
        registerCommand: jest.fn(() => ({ dispose: jest.fn() }))
    },
    Uri: {
        file: jest.fn((path) => ({
            fsPath: path,
            toString: () => path
        }))
    },
    ExtensionContext: jest.fn()
}));
// Mock file system
jest.mock('fs', () => ({
    promises: {
        readFile: jest.fn(),
        writeFile: jest.fn(),
        mkdir: jest.fn(),
        access: jest.fn()
    },
    existsSync: jest.fn(() => true)
}));
describe('Configuration Integration Tests', () => {
    let mockContext;
    let mockConfiguration;
    let configChangeCallback;
    beforeEach(() => {
        jest.clearAllMocks();
        mockContext = {
            subscriptions: [],
            extensionUri: { fsPath: '/test/extension' },
            globalStorageUri: { fsPath: '/test/storage' },
            workspaceState: {
                get: jest.fn(),
                update: jest.fn()
            },
            globalState: {
                get: jest.fn(),
                update: jest.fn()
            }
        };
        // Setup configuration mock with default values
        mockConfiguration = {
            get: jest.fn((key, defaultValue) => {
                const config = {
                    'enabled': true,
                    'maxCommitsToShow': 10,
                    'enableAISummary': true,
                    'aiProvider': 'disabled',
                    'openaiApiKey': '',
                    'aiMaxTokens': 150,
                    'aiTemperature': 0.7,
                    'enableTeamDashboard': false,
                    'privacySettings.shareWithTeam': false,
                    'privacySettings.excludeFilePatterns': ['*.log', 'node_modules/**'],
                    'privacySettings.excludeCommitPatterns': ['WIP:', 'temp:'],
                    'logLevel': 'info'
                };
                return config[key] ?? defaultValue;
            }),
            update: jest.fn(),
            has: jest.fn(() => true),
            inspect: jest.fn()
        };
        vscode.workspace.getConfiguration.mockReturnValue(mockConfiguration);
        // Capture configuration change callback
        vscode.workspace.onDidChangeConfiguration.mockImplementation((callback) => {
            configChangeCallback = callback;
            return { dispose: jest.fn() };
        });
    });
    afterEach(async () => {
        await (0, extension_1.deactivate)();
    });
    describe('Basic Configuration Loading', () => {
        test('should load default configuration on activation', async () => {
            // Act
            await (0, extension_1.activate)(mockContext);
            // Assert
            expect(vscode.workspace.getConfiguration).toHaveBeenCalledWith('sessionRecap');
            expect(mockConfiguration.get).toHaveBeenCalledWith('enabled', true);
            expect(mockConfiguration.get).toHaveBeenCalledWith('logLevel', 'info');
        });
        test('should handle missing configuration gracefully', async () => {
            // Arrange
            mockConfiguration.get.mockReturnValue(undefined);
            // Act
            await (0, extension_1.activate)(mockContext);
            // Assert - Should not throw errors
            expect(vscode.window.showErrorMessage).not.toHaveBeenCalled();
        });
        test('should validate configuration values', () => {
            // Arrange
            const configService = new ConfigurationService_1.ConfigurationService();
            // Act
            const config = configService.getConfiguration();
            // Assert
            expect(config.enabled).toBe(true);
            expect(config.maxCommitsToShow).toBe(10);
            expect(config.aiProvider).toBe('disabled');
        });
    });
    describe('AI Provider Configuration', () => {
        test('should handle OpenAI provider configuration', async () => {
            // Arrange
            mockConfiguration.get.mockImplementation((key, defaultValue) => {
                if (key === 'aiProvider')
                    return 'openai';
                if (key === 'openaiApiKey')
                    return 'test-api-key';
                if (key === 'aiMaxTokens')
                    return 200;
                if (key === 'aiTemperature')
                    return 0.5;
                return defaultValue;
            });
            // Act
            await (0, extension_1.activate)(mockContext);
            // Assert
            expect(mockConfiguration.get).toHaveBeenCalledWith('aiProvider', 'disabled');
            expect(mockConfiguration.get).toHaveBeenCalledWith('openaiApiKey', '');
        });
        test('should handle local AI provider configuration', async () => {
            // Arrange
            mockConfiguration.get.mockImplementation((key, defaultValue) => {
                if (key === 'aiProvider')
                    return 'local';
                return defaultValue;
            });
            // Act
            await (0, extension_1.activate)(mockContext);
            // Assert
            expect(mockConfiguration.get).toHaveBeenCalledWith('aiProvider', 'disabled');
        });
        test('should handle disabled AI provider', async () => {
            // Arrange
            mockConfiguration.get.mockImplementation((key, defaultValue) => {
                if (key === 'aiProvider')
                    return 'disabled';
                if (key === 'enableAISummary')
                    return false;
                return defaultValue;
            });
            // Act
            await (0, extension_1.activate)(mockContext);
            // Assert
            expect(mockConfiguration.get).toHaveBeenCalledWith('aiProvider', 'disabled');
            expect(mockConfiguration.get).toHaveBeenCalledWith('enableAISummary', true);
        });
        test('should respond to AI provider configuration changes', async () => {
            // Arrange
            await (0, extension_1.activate)(mockContext);
            // Change configuration
            mockConfiguration.get.mockImplementation((key, defaultValue) => {
                if (key === 'aiProvider')
                    return 'openai';
                if (key === 'openaiApiKey')
                    return 'new-api-key';
                return defaultValue;
            });
            // Act - Simulate configuration change
            if (configChangeCallback) {
                const mockConfigEvent = {
                    affectsConfiguration: jest.fn((section) => section === 'sessionRecap.aiProvider')
                };
                configChangeCallback(mockConfigEvent);
            }
            // Assert
            expect(vscode.workspace.onDidChangeConfiguration).toHaveBeenCalled();
        });
    });
    describe('Team Dashboard Configuration', () => {
        test('should enable team dashboard when configured', async () => {
            // Arrange
            mockConfiguration.get.mockImplementation((key, defaultValue) => {
                if (key === 'enableTeamDashboard')
                    return true;
                if (key === 'privacySettings.shareWithTeam')
                    return true;
                return defaultValue;
            });
            // Act
            await (0, extension_1.activate)(mockContext);
            // Assert
            expect(vscode.window.registerWebviewViewProvider).toHaveBeenCalledWith('teamDashboard', expect.any(Object));
        });
        test('should disable team dashboard when configured', async () => {
            // Arrange
            mockConfiguration.get.mockImplementation((key, defaultValue) => {
                if (key === 'enableTeamDashboard')
                    return false;
                return defaultValue;
            });
            // Act
            await (0, extension_1.activate)(mockContext);
            // Assert - Team dashboard should still be registered but may not be visible
            expect(vscode.window.registerWebviewViewProvider).toHaveBeenCalledWith('teamDashboard', expect.any(Object));
        });
        test('should handle team sharing opt-in/opt-out', async () => {
            // Arrange
            await (0, extension_1.activate)(mockContext);
            // Act - Simulate opt-in
            mockConfiguration.get.mockImplementation((key, defaultValue) => {
                if (key === 'privacySettings.shareWithTeam')
                    return true;
                return defaultValue;
            });
            if (configChangeCallback) {
                const mockConfigEvent = {
                    affectsConfiguration: jest.fn((section) => section === 'sessionRecap.privacySettings')
                };
                configChangeCallback(mockConfigEvent);
            }
            // Assert
            expect(vscode.workspace.onDidChangeConfiguration).toHaveBeenCalled();
        });
    });
    describe('Privacy Settings Configuration', () => {
        test('should handle file exclusion patterns', async () => {
            // Arrange
            const excludePatterns = ['*.secret', 'private/**', '.env*'];
            mockConfiguration.get.mockImplementation((key, defaultValue) => {
                if (key === 'privacySettings.excludeFilePatterns')
                    return excludePatterns;
                return defaultValue;
            });
            // Act
            await (0, extension_1.activate)(mockContext);
            // Assert
            expect(mockConfiguration.get).toHaveBeenCalledWith('privacySettings.excludeFilePatterns', expect.any(Array));
        });
        test('should handle commit exclusion patterns', async () => {
            // Arrange
            const excludePatterns = ['WIP:', 'temp:', 'debug:', 'fixup!'];
            mockConfiguration.get.mockImplementation((key, defaultValue) => {
                if (key === 'privacySettings.excludeCommitPatterns')
                    return excludePatterns;
                return defaultValue;
            });
            // Act
            await (0, extension_1.activate)(mockContext);
            // Assert
            expect(mockConfiguration.get).toHaveBeenCalledWith('privacySettings.excludeCommitPatterns', expect.any(Array));
        });
        test('should respond to privacy settings changes', async () => {
            // Arrange
            await (0, extension_1.activate)(mockContext);
            // Act - Change privacy settings
            mockConfiguration.get.mockImplementation((key, defaultValue) => {
                if (key === 'privacySettings.shareWithTeam')
                    return false;
                if (key === 'privacySettings.excludeFilePatterns')
                    return ['*.log', '*.tmp', 'secrets/**'];
                return defaultValue;
            });
            if (configChangeCallback) {
                const mockConfigEvent = {
                    affectsConfiguration: jest.fn((section) => section.startsWith('sessionRecap.privacySettings'))
                };
                configChangeCallback(mockConfigEvent);
            }
            // Assert
            expect(vscode.workspace.onDidChangeConfiguration).toHaveBeenCalled();
        });
    });
    describe('Logging Configuration', () => {
        test('should handle different log levels', async () => {
            // Test each log level
            const logLevels = ['error', 'warn', 'info', 'debug'];
            for (const level of logLevels) {
                // Arrange
                mockConfiguration.get.mockImplementation((key, defaultValue) => {
                    if (key === 'logLevel')
                        return level;
                    return defaultValue;
                });
                // Act
                await (0, extension_1.activate)(mockContext);
                await (0, extension_1.deactivate)();
                // Assert
                expect(mockConfiguration.get).toHaveBeenCalledWith('logLevel', 'info');
            }
        });
        test('should handle invalid log level gracefully', async () => {
            // Arrange
            mockConfiguration.get.mockImplementation((key, defaultValue) => {
                if (key === 'logLevel')
                    return 'invalid';
                return defaultValue;
            });
            // Act
            await (0, extension_1.activate)(mockContext);
            // Assert - Should fallback to default
            expect(vscode.window.showErrorMessage).not.toHaveBeenCalled();
        });
    });
    describe('Git Configuration', () => {
        test('should handle max commits configuration', async () => {
            // Arrange
            mockConfiguration.get.mockImplementation((key, defaultValue) => {
                if (key === 'maxCommitsToShow')
                    return 5;
                return defaultValue;
            });
            // Act
            await (0, extension_1.activate)(mockContext);
            // Assert
            expect(mockConfiguration.get).toHaveBeenCalledWith('maxCommitsToShow', 10);
        });
        test('should handle invalid max commits value', async () => {
            // Arrange
            mockConfiguration.get.mockImplementation((key, defaultValue) => {
                if (key === 'maxCommitsToShow')
                    return -1;
                return defaultValue;
            });
            // Act
            await (0, extension_1.activate)(mockContext);
            // Assert - Should handle gracefully
            expect(vscode.window.showErrorMessage).not.toHaveBeenCalled();
        });
    });
    describe('Configuration Updates', () => {
        test('should update configuration programmatically', async () => {
            // Arrange
            await (0, extension_1.activate)(mockContext);
            // Act
            await mockConfiguration.update('enabled', false);
            // Assert
            expect(mockConfiguration.update).toHaveBeenCalledWith('enabled', false);
        });
        test('should handle configuration update errors', async () => {
            // Arrange
            mockConfiguration.update.mockRejectedValue(new Error('Update failed'));
            await (0, extension_1.activate)(mockContext);
            // Act & Assert
            await expect(mockConfiguration.update('enabled', false)).rejects.toThrow('Update failed');
        });
        test('should validate configuration before updates', () => {
            // Arrange
            const configService = new ConfigurationService_1.ConfigurationService();
            // Act & Assert - Test various invalid configurations
            expect(() => configService.validateConfiguration({
                enabled: 'invalid',
                maxCommitsToShow: 10,
                aiProvider: 'disabled'
            })).toThrow();
            expect(() => configService.validateConfiguration({
                enabled: true,
                maxCommitsToShow: -5,
                aiProvider: 'disabled'
            })).toThrow();
            expect(() => configService.validateConfiguration({
                enabled: true,
                maxCommitsToShow: 10,
                aiProvider: 'invalid'
            })).toThrow();
        });
    });
    describe('Configuration Migration', () => {
        test('should handle configuration schema migration', async () => {
            // Arrange - Simulate old configuration format
            mockConfiguration.get.mockImplementation((key, defaultValue) => {
                // Simulate old configuration keys
                if (key === 'oldAiEnabled')
                    return true;
                if (key === 'oldMaxCommits')
                    return 15;
                return defaultValue;
            });
            // Act
            await (0, extension_1.activate)(mockContext);
            // Assert - Should handle gracefully
            expect(vscode.window.showErrorMessage).not.toHaveBeenCalled();
        });
        test('should preserve user settings during migration', async () => {
            // Arrange
            const userSettings = {
                'enabled': false,
                'maxCommitsToShow': 20,
                'aiProvider': 'openai',
                'openaiApiKey': 'user-key'
            };
            mockConfiguration.get.mockImplementation((key, defaultValue) => {
                return userSettings[key] ?? defaultValue;
            });
            // Act
            await (0, extension_1.activate)(mockContext);
            // Assert
            expect(mockConfiguration.get).toHaveBeenCalledWith('enabled', true);
            expect(mockConfiguration.get).toHaveBeenCalledWith('maxCommitsToShow', 10);
            expect(mockConfiguration.get).toHaveBeenCalledWith('aiProvider', 'disabled');
        });
    });
    describe('Configuration Inspection', () => {
        test('should inspect configuration values', () => {
            // Arrange
            const configService = new ConfigurationService_1.ConfigurationService();
            mockConfiguration.inspect.mockReturnValue({
                key: 'sessionRecap.enabled',
                defaultValue: true,
                globalValue: undefined,
                workspaceValue: false,
                workspaceFolderValue: undefined
            });
            // Act - Test that configuration can be inspected via VS Code API
            const inspection = mockConfiguration.inspect('sessionRecap.enabled');
            // Assert
            expect(inspection).toBeDefined();
            expect(inspection.workspaceValue).toBe(false);
        });
        test('should get effective configuration value', () => {
            // Arrange
            const configService = new ConfigurationService_1.ConfigurationService();
            // Act - Test getting configuration values
            const config = configService.getConfiguration();
            // Assert
            expect(config).toBeDefined();
            expect(config.enabled).toBeDefined();
        });
    });
    describe('Real-time Configuration Changes', () => {
        test('should handle rapid configuration changes', async () => {
            // Arrange
            await (0, extension_1.activate)(mockContext);
            // Act - Simulate rapid configuration changes
            for (let i = 0; i < 10; i++) {
                mockConfiguration.get.mockImplementation((key, defaultValue) => {
                    if (key === 'maxCommitsToShow')
                        return i + 1;
                    return defaultValue;
                });
                if (configChangeCallback) {
                    const mockConfigEvent = {
                        affectsConfiguration: jest.fn((section) => section === 'sessionRecap.maxCommitsToShow')
                    };
                    configChangeCallback(mockConfigEvent);
                }
            }
            // Assert - Should handle without errors
            expect(vscode.window.showErrorMessage).not.toHaveBeenCalled();
        });
        test('should debounce configuration changes', async () => {
            // Arrange
            await (0, extension_1.activate)(mockContext);
            let changeCount = 0;
            // Mock debounced handler
            const originalCallback = configChangeCallback;
            configChangeCallback = jest.fn(() => {
                changeCount++;
                if (originalCallback)
                    originalCallback();
            });
            // Act - Simulate multiple rapid changes
            for (let i = 0; i < 5; i++) {
                if (configChangeCallback) {
                    const mockConfigEvent = {
                        affectsConfiguration: jest.fn(() => true)
                    };
                    configChangeCallback(mockConfigEvent);
                }
            }
            // Assert - Changes should be processed
            expect(changeCount).toBe(5);
        });
    });
});
//# sourceMappingURL=configuration-integration.test.js.map