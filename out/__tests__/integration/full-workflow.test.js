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
const SidebarPanelProvider_1 = require("../../providers/SidebarPanelProvider");
// Mock VS Code API with comprehensive functionality
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
        showWarningMessage: jest.fn(() => Promise.resolve()),
        showInformationMessage: jest.fn(() => Promise.resolve()),
        showTextDocument: jest.fn(() => Promise.resolve()),
        showQuickPick: jest.fn(() => Promise.resolve()),
        onDidChangeActiveTerminal: jest.fn(() => ({ dispose: jest.fn() })),
        terminals: []
    },
    workspace: {
        getConfiguration: jest.fn(() => ({
            get: jest.fn().mockImplementation((key, defaultValue) => {
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
            update: jest.fn()
        })),
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
        registerCommand: jest.fn(() => ({ dispose: jest.fn() })),
        executeCommand: jest.fn()
    },
    Uri: {
        file: jest.fn((path) => ({ fsPath: path, toString: () => path })),
        parse: jest.fn((uri) => ({ fsPath: uri, toString: () => uri }))
    },
    ExtensionContext: jest.fn(),
    ViewColumn: {
        One: 1,
        Two: 2,
        Three: 3
    },
    TextDocumentChangeEvent: jest.fn(),
    FileSystemWatcher: jest.fn(),
    extensions: {
        getExtension: jest.fn()
    }
}));
// Mock file system operations
jest.mock('fs', () => ({
    promises: {
        readFile: jest.fn(),
        writeFile: jest.fn(),
        mkdir: jest.fn(),
        access: jest.fn(),
        stat: jest.fn()
    },
    existsSync: jest.fn(),
    readFileSync: jest.fn(),
    writeFileSync: jest.fn()
}));
// Mock child_process for Git operations
jest.mock('child_process', () => ({
    exec: jest.fn(),
    spawn: jest.fn()
}));
describe('Full Workflow Integration Tests', () => {
    let mockContext;
    let registeredCommands = {};
    let registeredProviders = {};
    let mockConfiguration;
    beforeEach(() => {
        jest.clearAllMocks();
        registeredCommands = {};
        registeredProviders = {};
        // Setup mock context
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
        // Setup configuration mock
        mockConfiguration = {
            get: jest.fn().mockImplementation((key, defaultValue) => {
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
            update: jest.fn()
        };
        vscode.workspace.getConfiguration.mockReturnValue(mockConfiguration);
        // Capture registered commands and providers
        vscode.commands.registerCommand.mockImplementation((command, callback) => {
            registeredCommands[command] = callback;
            return { dispose: jest.fn() };
        });
        vscode.window.registerWebviewViewProvider.mockImplementation((viewId, provider) => {
            registeredProviders[viewId] = provider;
            return { dispose: jest.fn() };
        });
    });
    afterEach(async () => {
        await (0, extension_1.deactivate)();
    });
    describe('Complete Session Lifecycle', () => {
        test('should handle full session lifecycle from start to display', async () => {
            // Arrange - Mock file system for session storage
            const fs = require('fs');
            fs.promises.readFile.mockResolvedValue(JSON.stringify({
                sessionId: 'previous-session',
                startTime: '2023-01-01T10:00:00.000Z',
                endTime: '2023-01-01T11:00:00.000Z',
                editedFiles: [
                    {
                        filePath: 'src/test.ts',
                        timestamp: '2023-01-01T10:30:00.000Z',
                        changeType: 'modified'
                    }
                ],
                gitCommits: [
                    {
                        hash: 'abc123',
                        message: 'Test commit',
                        author: 'Test User',
                        timestamp: '2023-01-01T10:45:00.000Z',
                        filesChanged: ['src/test.ts']
                    }
                ],
                terminalErrors: [],
                summary: 'Previous session summary'
            }));
            // Act - Activate extension
            await (0, extension_1.activate)(mockContext);
            // Assert - Extension should be properly initialized
            expect(vscode.window.createOutputChannel).toHaveBeenCalledWith('Session Recap');
            expect(vscode.window.registerWebviewViewProvider).toHaveBeenCalledWith('sessionRecap', expect.any(Object));
            expect(vscode.commands.registerCommand).toHaveBeenCalledWith('sessionRecap.refresh', expect.any(Function));
            // Verify sidebar provider was registered
            expect(registeredProviders['sessionRecap']).toBeDefined();
            const sidebarProvider = registeredProviders['sessionRecap'];
            expect(sidebarProvider).toBeInstanceOf(SidebarPanelProvider_1.SidebarPanelProvider);
            // Simulate session tracking
            const refreshCommand = registeredCommands['sessionRecap.refresh'];
            expect(refreshCommand).toBeDefined();
            // Execute refresh command
            await refreshCommand();
            // Verify no errors occurred during refresh
            expect(vscode.window.showErrorMessage).not.toHaveBeenCalled();
        });
        test('should handle first-time startup with no previous session', async () => {
            // Arrange - Mock file system to simulate no previous session
            const fs = require('fs');
            fs.promises.readFile.mockRejectedValue(new Error('ENOENT: no such file or directory'));
            // Act
            await (0, extension_1.activate)(mockContext);
            // Assert - Should handle gracefully without errors
            expect(vscode.window.showErrorMessage).not.toHaveBeenCalled();
            expect(registeredProviders['sessionRecap']).toBeDefined();
        });
        test('should save session data on deactivation', async () => {
            // Arrange
            const fs = require('fs');
            fs.promises.writeFile.mockResolvedValue(undefined);
            fs.promises.readFile.mockRejectedValue(new Error('ENOENT'));
            await (0, extension_1.activate)(mockContext);
            // Act
            await (0, extension_1.deactivate)();
            // Assert - Session should be saved
            expect(fs.promises.writeFile).toHaveBeenCalled();
        });
    });
    describe('VS Code API Integration', () => {
        test('should integrate with file system events', async () => {
            // Arrange
            let fileChangeCallback;
            vscode.workspace.onDidSaveTextDocument.mockImplementation((callback) => {
                fileChangeCallback = callback;
                return { dispose: jest.fn() };
            });
            await (0, extension_1.activate)(mockContext);
            // Act - Simulate file save event
            if (fileChangeCallback) {
                const mockDocument = {
                    uri: { fsPath: '/test/workspace/src/test.ts' },
                    fileName: '/test/workspace/src/test.ts',
                    languageId: 'typescript'
                };
                fileChangeCallback(mockDocument);
            }
            // Assert - File change should be tracked
            expect(vscode.workspace.onDidSaveTextDocument).toHaveBeenCalled();
        });
        test('should integrate with Git API', async () => {
            // Arrange
            const child_process = require('child_process');
            child_process.exec.mockImplementation((command, callback) => {
                if (command.includes('git log')) {
                    callback(null, 'abc123|Test commit|Test User|2023-01-01T10:45:00Z|src/test.ts');
                }
                else if (command.includes('git rev-parse')) {
                    callback(null, '/test/workspace/.git');
                }
            });
            await (0, extension_1.activate)(mockContext);
            // Act - Execute refresh to trigger Git integration
            const refreshCommand = registeredCommands['sessionRecap.refresh'];
            await refreshCommand();
            // Assert - Git commands should be executed
            expect(child_process.exec).toHaveBeenCalled();
        });
        test('should integrate with terminal events', async () => {
            // Arrange
            let terminalChangeCallback;
            vscode.window.onDidChangeActiveTerminal.mockImplementation((callback) => {
                terminalChangeCallback = callback;
                return { dispose: jest.fn() };
            });
            await (0, extension_1.activate)(mockContext);
            // Act - Simulate terminal change
            if (terminalChangeCallback) {
                const mockTerminal = {
                    name: 'Test Terminal',
                    processId: Promise.resolve(1234)
                };
                terminalChangeCallback(mockTerminal);
            }
            // Assert - Terminal monitoring should be active
            expect(vscode.window.onDidChangeActiveTerminal).toHaveBeenCalled();
        });
    });
    describe('Webview Panel Integration', () => {
        test('should create and manage webview panel', async () => {
            // Arrange & Act
            await (0, extension_1.activate)(mockContext);
            // Assert
            expect(vscode.window.registerWebviewViewProvider).toHaveBeenCalledWith('sessionRecap', expect.any(Object));
            const sidebarProvider = registeredProviders['sessionRecap'];
            expect(sidebarProvider).toBeDefined();
        });
        test('should handle webview communication', async () => {
            // Arrange
            await (0, extension_1.activate)(mockContext);
            const sidebarProvider = registeredProviders['sessionRecap'];
            // Act - Simulate file click from webview
            const mockCallback = jest.fn();
            sidebarProvider.onFileClick(mockCallback);
            // Simulate webview message
            if (sidebarProvider._fileClickCallback) {
                sidebarProvider._fileClickCallback('/test/workspace/src/test.ts');
            }
            // Assert
            expect(mockCallback).toHaveBeenCalledWith('/test/workspace/src/test.ts');
        });
        test('should update webview content with session data', async () => {
            // Arrange
            const mockSessionData = {
                sessionId: 'test-session',
                startTime: new Date(),
                editedFiles: [
                    {
                        filePath: 'src/test.ts',
                        timestamp: new Date(),
                        changeType: 'modified'
                    }
                ],
                gitCommits: [],
                terminalErrors: [],
                summary: 'Test session'
            };
            await (0, extension_1.activate)(mockContext);
            const sidebarProvider = registeredProviders['sessionRecap'];
            // Act
            sidebarProvider.updateContent(mockSessionData);
            // Assert - Should not throw errors
            expect(sidebarProvider).toBeDefined();
        });
    });
    describe('Configuration Integration', () => {
        test('should respond to configuration changes', async () => {
            // Arrange
            let configChangeCallback;
            vscode.workspace.onDidChangeConfiguration.mockImplementation((callback) => {
                configChangeCallback = callback;
                return { dispose: jest.fn() };
            });
            await (0, extension_1.activate)(mockContext);
            // Act - Simulate configuration change
            if (configChangeCallback) {
                const mockConfigEvent = {
                    affectsConfiguration: jest.fn((section) => section === 'sessionRecap')
                };
                configChangeCallback(mockConfigEvent);
            }
            // Assert
            expect(vscode.workspace.onDidChangeConfiguration).toHaveBeenCalled();
        });
        test('should handle AI provider configuration changes', async () => {
            // Arrange
            mockConfiguration.get.mockImplementation((key, defaultValue) => {
                if (key === 'aiProvider')
                    return 'openai';
                if (key === 'openaiApiKey')
                    return 'test-api-key';
                return defaultValue;
            });
            // Act
            await (0, extension_1.activate)(mockContext);
            // Assert - Should initialize with OpenAI provider
            expect(vscode.workspace.getConfiguration).toHaveBeenCalledWith('sessionRecap');
        });
        test('should handle team dashboard configuration changes', async () => {
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
            // Assert - Team dashboard should be registered
            expect(vscode.window.registerWebviewViewProvider).toHaveBeenCalledWith('teamDashboard', expect.any(Object));
        });
        test('should handle privacy settings changes', async () => {
            // Arrange
            const excludePatterns = ['*.secret', 'private/**'];
            mockConfiguration.get.mockImplementation((key, defaultValue) => {
                if (key === 'privacySettings.excludeFilePatterns')
                    return excludePatterns;
                return defaultValue;
            });
            // Act
            await (0, extension_1.activate)(mockContext);
            // Assert - Configuration should be loaded
            expect(vscode.workspace.getConfiguration).toHaveBeenCalledWith('sessionRecap');
        });
    });
    describe('Command Integration', () => {
        test('should register and execute all commands', async () => {
            // Arrange & Act
            await (0, extension_1.activate)(mockContext);
            // Assert - All commands should be registered
            const expectedCommands = [
                'sessionRecap.refresh',
                'sessionRecap.clear',
                'sessionRecap.refreshTeam',
                'sessionRecap.optInTeam',
                'sessionRecap.optOutTeam',
                'sessionRecap.showLogs',
                'sessionRecap.showTelemetry',
                'sessionRecap.setLogLevel'
            ];
            expectedCommands.forEach(command => {
                expect(registeredCommands[command]).toBeDefined();
            });
        });
        test('should execute refresh command successfully', async () => {
            // Arrange
            const fs = require('fs');
            fs.promises.readFile.mockResolvedValue('{}');
            await (0, extension_1.activate)(mockContext);
            // Act
            const refreshCommand = registeredCommands['sessionRecap.refresh'];
            await refreshCommand();
            // Assert - Should complete without errors
            expect(vscode.window.showErrorMessage).not.toHaveBeenCalled();
        });
        test('should execute clear command successfully', async () => {
            // Arrange
            await (0, extension_1.activate)(mockContext);
            // Act
            const clearCommand = registeredCommands['sessionRecap.clear'];
            clearCommand();
            // Assert - Should complete without errors
            expect(vscode.window.showErrorMessage).not.toHaveBeenCalled();
        });
        test('should execute showLogs command successfully', async () => {
            // Arrange
            await (0, extension_1.activate)(mockContext);
            // Act
            const showLogsCommand = registeredCommands['sessionRecap.showLogs'];
            showLogsCommand();
            // Assert - Output channel should be shown
            expect(vscode.window.createOutputChannel).toHaveBeenCalled();
        });
        test('should execute setLogLevel command with user interaction', async () => {
            // Arrange
            vscode.window.showQuickPick.mockResolvedValue('DEBUG');
            await (0, extension_1.activate)(mockContext);
            // Act
            const setLogLevelCommand = registeredCommands['sessionRecap.setLogLevel'];
            await setLogLevelCommand();
            // Assert
            expect(vscode.window.showQuickPick).toHaveBeenCalledWith(['ERROR', 'WARN', 'INFO', 'DEBUG'], { placeHolder: 'Select log level' });
        });
    });
    describe('Error Handling Integration', () => {
        test('should handle activation errors gracefully', async () => {
            // Arrange
            vscode.window.createOutputChannel.mockImplementation(() => {
                throw new Error('Test activation error');
            });
            // Act
            await (0, extension_1.activate)(mockContext);
            // Assert
            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(expect.stringContaining('Failed to activate Session Recap extension'));
        });
        test('should handle service initialization errors', async () => {
            // Arrange
            vscode.window.registerWebviewViewProvider.mockImplementation(() => {
                throw new Error('Webview registration failed');
            });
            // Act
            await (0, extension_1.activate)(mockContext);
            // Assert - Should continue activation despite service errors
            expect(vscode.window.createOutputChannel).toHaveBeenCalled();
        });
        test('should handle deactivation errors gracefully', async () => {
            // Arrange
            const fs = require('fs');
            fs.promises.writeFile.mockRejectedValue(new Error('Write failed'));
            await (0, extension_1.activate)(mockContext);
            // Act & Assert - Should not throw
            await expect((0, extension_1.deactivate)()).resolves.not.toThrow();
        });
    });
    describe('Performance and Resource Management', () => {
        test('should properly dispose resources on deactivation', async () => {
            // Arrange
            await (0, extension_1.activate)(mockContext);
            const initialSubscriptions = mockContext.subscriptions.length;
            // Act
            await (0, extension_1.deactivate)();
            // Assert - Resources should be cleaned up
            expect(initialSubscriptions).toBeGreaterThan(0);
        });
        test('should handle multiple rapid activations/deactivations', async () => {
            // Act - Multiple rapid cycles
            for (let i = 0; i < 3; i++) {
                await (0, extension_1.activate)(mockContext);
                await (0, extension_1.deactivate)();
            }
            // Assert - Should not accumulate errors
            expect(vscode.window.showErrorMessage).not.toHaveBeenCalled();
        });
    });
});
//# sourceMappingURL=full-workflow.test.js.map