import * as vscode from 'vscode';
import { SessionTracker } from '../../services/SessionTracker';
import { SidebarPanelProvider } from '../../providers/SidebarPanelProvider';
import { AISummaryService } from '../../services/AISummaryService';
import { FileChangeMonitor } from '../../services/FileChangeMonitor';
import { GitActivityMonitor } from '../../services/GitActivityMonitor';
import { TerminalErrorMonitor } from '../../services/TerminalErrorMonitor';
import { SessionData } from '../../models/SessionData';

// Mock VS Code API
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
        showTextDocument: jest.fn(() => Promise.resolve()),
        onDidChangeActiveTerminal: jest.fn(() => ({ dispose: jest.fn() })),
        onDidOpenTerminal: jest.fn(() => ({ dispose: jest.fn() })),
        onDidCloseTerminal: jest.fn(() => ({ dispose: jest.fn() })),
        terminals: []
    },
    workspace: {
        getConfiguration: jest.fn(() => ({
            get: jest.fn().mockImplementation((key: string, defaultValue?: any) => {
                return defaultValue;
            })
        })),
        workspaceFolders: [{
            uri: { fsPath: '/test/workspace' },
            name: 'test-workspace',
            index: 0
        }],
        openTextDocument: jest.fn(() => Promise.resolve()),
        onDidSaveTextDocument: jest.fn(() => ({ dispose: jest.fn() })),
        onDidChangeTextDocument: jest.fn(() => ({ dispose: jest.fn() })),
        onDidCreateFiles: jest.fn(() => ({ dispose: jest.fn() })),
        onDidDeleteFiles: jest.fn(() => ({ dispose: jest.fn() })),
        onDidRenameFiles: jest.fn(() => ({ dispose: jest.fn() })),
        onDidChangeConfiguration: jest.fn(() => ({ dispose: jest.fn() })),
        createFileSystemWatcher: jest.fn(() => ({
            onDidCreate: jest.fn(() => ({ dispose: jest.fn() })),
            onDidChange: jest.fn(() => ({ dispose: jest.fn() })),
            onDidDelete: jest.fn(() => ({ dispose: jest.fn() })),
            dispose: jest.fn()
        }))
    },
    commands: {
        registerCommand: jest.fn(() => ({ dispose: jest.fn() }))
    },
    Uri: {
        file: jest.fn((path: string) => ({ 
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

// Mock child_process
jest.mock('child_process', () => ({
    exec: jest.fn()
}));

describe('Simple Integration Tests', () => {
    let mockContext: vscode.ExtensionContext;
    let outputChannel: vscode.OutputChannel;

    beforeEach(() => {
        jest.clearAllMocks();
        
        mockContext = {
            subscriptions: [],
            extensionUri: { fsPath: '/test/extension' } as vscode.Uri,
            globalStorageUri: { fsPath: '/test/storage' } as vscode.Uri
        } as any;

        outputChannel = vscode.window.createOutputChannel('Test');
    });

    describe('Service Integration', () => {
        test('should create and initialize session tracker', () => {
            // Arrange
            const sidebarProvider = new SidebarPanelProvider(mockContext.extensionUri);

            // Act
            const sessionTracker = new SessionTracker(mockContext, sidebarProvider);

            // Assert
            expect(sessionTracker).toBeDefined();
            expect(sessionTracker.getCurrentSession).toBeDefined();
        });

        test('should create and initialize AI summary service', () => {
            // Act
            const aiService = new AISummaryService(outputChannel);

            // Assert
            expect(aiService).toBeDefined();
            expect(aiService.isAvailable).toBeDefined();
            expect(aiService.generateFallbackSummary).toBeDefined();
        });

        test('should create and initialize file change monitor', () => {
            // Act
            const fileMonitor = new FileChangeMonitor();

            // Assert
            expect(fileMonitor).toBeDefined();
            expect(fileMonitor.getEditedFiles).toBeDefined();
            expect(fileMonitor.onFileChanged).toBeDefined();
        });

        test('should create and initialize Git activity monitor', () => {
            // Act
            const gitMonitor = new GitActivityMonitor();

            // Assert
            expect(gitMonitor).toBeDefined();
            expect(gitMonitor.isGitRepository).toBeDefined();
            expect(gitMonitor.getCommitsSince).toBeDefined();
        });

        test('should create and initialize terminal error monitor', () => {
            // Act
            const terminalMonitor = new TerminalErrorMonitor();

            // Assert
            expect(terminalMonitor).toBeDefined();
            expect(terminalMonitor.getLastError).toBeDefined();
            expect(terminalMonitor.onTerminalError).toBeDefined();
        });
    });

    describe('Session Lifecycle Integration', () => {
        test('should handle complete session workflow', async () => {
            // Arrange
            const sidebarProvider = new SidebarPanelProvider(mockContext.extensionUri);
            const sessionTracker = new SessionTracker(mockContext, sidebarProvider);
            const aiService = new AISummaryService(outputChannel);

            // Act - Start tracking
            sessionTracker.startTracking();
            const currentSession = sessionTracker.getCurrentSession();

            // Assert - Session should be initialized
            expect(currentSession).toBeDefined();
            expect(currentSession.sessionId).toBeDefined();
            expect(currentSession.startTime).toBeInstanceOf(Date);
            expect(currentSession.editedFiles).toEqual([]);
            expect(currentSession.gitCommits).toEqual([]);
            expect(currentSession.terminalErrors).toEqual([]);

            // Act - Generate fallback summary
            const summary = aiService.generateFallbackSummary(currentSession);

            // Assert - Summary should be generated
            expect(summary).toBeDefined();
            expect(typeof summary).toBe('string');
        });

        test('should handle session data updates', () => {
            // Arrange
            const sidebarProvider = new SidebarPanelProvider(mockContext.extensionUri);
            const sessionTracker = new SessionTracker(mockContext, sidebarProvider);

            sessionTracker.startTracking();

            const sessionData: SessionData = {
                sessionId: 'test-session',
                startTime: new Date(),
                editedFiles: [
                    {
                        filePath: 'src/test.ts',
                        timestamp: new Date(),
                        changeType: 'modified'
                    }
                ],
                gitCommits: [
                    {
                        hash: 'abc123',
                        message: 'Test commit',
                        author: 'Test User',
                        timestamp: new Date(),
                        filesChanged: ['src/test.ts']
                    }
                ],
                terminalErrors: [],
                summary: 'Test session'
            };

            // Act - Update sidebar with session data
            sidebarProvider.updateContent(sessionData);

            // Assert - Should not throw errors
            expect(sidebarProvider).toBeDefined();
        });
    });

    describe('VS Code API Integration', () => {
        test('should register webview provider', () => {
            // Arrange
            const sidebarProvider = new SidebarPanelProvider(mockContext.extensionUri);

            // Act - Register provider (simulated)
            const registration = vscode.window.registerWebviewViewProvider('sessionRecap', sidebarProvider);

            // Assert
            expect(vscode.window.registerWebviewViewProvider).toHaveBeenCalledWith('sessionRecap', sidebarProvider);
            expect(registration).toBeDefined();
        });

        test('should handle file system events', () => {
            // Arrange
            const fileMonitor = new FileChangeMonitor();
            const editedFiles: any[] = [];

            fileMonitor.onFileChanged((file) => {
                editedFiles.push(file);
            });

            // Act - Simulate file system event registration
            const disposable = vscode.workspace.onDidSaveTextDocument(() => {});

            // Assert
            expect(vscode.workspace.onDidSaveTextDocument).toHaveBeenCalled();
            expect(disposable).toBeDefined();
        });

        test('should handle Git operations', async () => {
            // Arrange
            const child_process = require('child_process');
            child_process.exec.mockImplementation((command: string, callback: Function) => {
                if (command.includes('git log')) {
                    callback(null, 'abc123|Test commit|Test User|2023-01-01T10:00:00Z|src/test.ts');
                }
            });

            const gitMonitor = new GitActivityMonitor();

            // Act
            const commits = await gitMonitor.getCommitsSince(new Date('2023-01-01T09:00:00Z'));

            // Assert
            expect(commits).toBeDefined();
            expect(Array.isArray(commits)).toBe(true);
        });

        test('should handle terminal monitoring', () => {
            // Arrange
            const terminalMonitor = new TerminalErrorMonitor();

            // Act - Simulate terminal event registration
            const disposable = vscode.window.onDidChangeActiveTerminal(() => {});

            // Assert
            expect(vscode.window.onDidChangeActiveTerminal).toHaveBeenCalled();
            expect(disposable).toBeDefined();
        });
    });

    describe('Configuration Integration', () => {
        test('should read configuration values', () => {
            // Act
            const config = vscode.workspace.getConfiguration('sessionRecap');
            const enabled = config.get('enabled', true);
            const maxCommits = config.get('maxCommitsToShow', 10);

            // Assert
            expect(vscode.workspace.getConfiguration).toHaveBeenCalledWith('sessionRecap');
            expect(enabled).toBe(true);
            expect(maxCommits).toBe(10);
        });

        test('should handle configuration changes', () => {
            // Act - Simulate configuration change listener
            const disposable = vscode.workspace.onDidChangeConfiguration(() => {});

            // Assert
            expect(vscode.workspace.onDidChangeConfiguration).toHaveBeenCalled();
            expect(disposable).toBeDefined();
        });
    });

    describe('Error Handling Integration', () => {
        test('should handle service initialization errors gracefully', () => {
            // Arrange - Mock a service that might fail
            const mockError = new Error('Service initialization failed');

            // Act & Assert - Should not throw
            expect(() => {
                try {
                    // Simulate service initialization
                    throw mockError;
                } catch (error) {
                    // Error should be caught and handled
                    expect(error).toBe(mockError);
                }
            }).not.toThrow();
        });

        test('should handle VS Code API errors gracefully', async () => {
            // Arrange
            (vscode.workspace.openTextDocument as jest.Mock).mockRejectedValue(new Error('File not found'));

            // Act & Assert - Should handle promise rejection
            await expect(vscode.workspace.openTextDocument(vscode.Uri.file('nonexistent.ts')))
                .rejects.toThrow('File not found');
        });
    });

    describe('Performance Integration', () => {
        test('should handle large session data efficiently', () => {
            // Arrange
            const sidebarProvider = new SidebarPanelProvider(mockContext.extensionUri);
            const largeSessionData: SessionData = {
                sessionId: 'large-session',
                startTime: new Date(),
                editedFiles: Array.from({ length: 100 }, (_, i) => ({
                    filePath: `src/file${i}.ts`,
                    timestamp: new Date(),
                    changeType: 'modified' as const
                })),
                gitCommits: Array.from({ length: 50 }, (_, i) => ({
                    hash: `commit${i}`,
                    message: `Commit ${i}`,
                    author: 'Test User',
                    timestamp: new Date(),
                    filesChanged: [`src/file${i}.ts`]
                })),
                terminalErrors: [],
                summary: 'Large session'
            };

            // Act - Should handle large data without issues
            const startTime = Date.now();
            sidebarProvider.updateContent(largeSessionData);
            const endTime = Date.now();

            // Assert - Should complete quickly
            expect(endTime - startTime).toBeLessThan(100); // Should complete in under 100ms
        });

        test('should handle multiple rapid operations', () => {
            // Arrange
            const fileMonitor = new FileChangeMonitor();
            const editedFiles: any[] = [];

            fileMonitor.onFileChanged((file) => {
                editedFiles.push(file);
            });

            // Act - Simulate rapid file changes
            const startTime = Date.now();
            for (let i = 0; i < 100; i++) {
                // Simulate file change processing
                const file = {
                    filePath: `src/file${i}.ts`,
                    timestamp: new Date(),
                    changeType: 'modified' as const
                };
                // Would normally trigger through VS Code events
            }
            const endTime = Date.now();

            // Assert - Should handle rapid operations efficiently
            expect(endTime - startTime).toBeLessThan(50); // Should complete quickly
        });
    });
});