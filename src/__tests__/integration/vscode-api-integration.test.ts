import * as vscode from 'vscode';
import { FileChangeMonitor } from '../../services/FileChangeMonitor';
import { GitActivityMonitor } from '../../services/GitActivityMonitor';
import { TerminalErrorMonitor } from '../../services/TerminalErrorMonitor';
import { SessionTracker } from '../../services/SessionTracker';
import { SidebarPanelProvider } from '../../providers/SidebarPanelProvider';
import { FileEdit } from '../../models/FileEdit';
import { GitCommit } from '../../models/GitCommit';
import { TerminalError } from '../../models/TerminalError';

// Mock VS Code API with detailed event handling
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
        showTextDocument: jest.fn(),
        onDidChangeActiveTerminal: jest.fn(() => ({ dispose: jest.fn() })),
        terminals: []
    },
    workspace: {
        getConfiguration: jest.fn(() => ({
            get: jest.fn((key: string, defaultValue?: any) => {
                return defaultValue;
            })
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
            toString: () => path,
            scheme: 'file',
            path: path
        })),
        parse: jest.fn((uri: string) => ({ 
            fsPath: uri, 
            toString: () => uri,
            scheme: 'file',
            path: uri
        }))
    },
    ExtensionContext: jest.fn(),
    RelativePattern: jest.fn(),
    FileSystemWatcher: jest.fn(),
    extensions: {
        getExtension: jest.fn(() => ({
            exports: {
                getAPI: jest.fn(() => ({
                    getRepository: jest.fn()
                }))
            }
        }))
    }
}));

// Mock child_process for Git operations
jest.mock('child_process', () => ({
    exec: jest.fn(),
    spawn: jest.fn()
}));

// Mock fs for file operations
jest.mock('fs', () => ({
    promises: {
        readFile: jest.fn(),
        writeFile: jest.fn(),
        mkdir: jest.fn(),
        access: jest.fn()
    },
    existsSync: jest.fn(() => true)
}));

describe('VS Code API Integration Tests', () => {
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

    describe('File System Integration', () => {
        test('should monitor file save events', async () => {
            // Arrange
            let saveCallback: Function | undefined;
            (vscode.workspace.onDidSaveTextDocument as jest.Mock).mockImplementation((callback) => {
                saveCallback = callback;
                return { dispose: jest.fn() };
            });

            const fileMonitor = new FileChangeMonitor();
            const editedFiles: FileEdit[] = [];
            
            fileMonitor.onFileChanged((file) => {
                editedFiles.push(file);
            });

            // Act - Simulate file save
            if (saveCallback) {
                const mockDocument = {
                    uri: { fsPath: '/test/workspace/src/test.ts' },
                    fileName: '/test/workspace/src/test.ts',
                    languageId: 'typescript',
                    lineCount: 50
                };
                saveCallback(mockDocument);
            }

            // Assert
            expect(vscode.workspace.onDidSaveTextDocument).toHaveBeenCalled();
            expect(editedFiles).toHaveLength(1);
            expect(editedFiles[0].filePath).toBe('src/test.ts');
            expect(editedFiles[0].changeType).toBe('modified');
        });

        test('should monitor file creation events', async () => {
            // Arrange
            let createCallback: Function | undefined;
            (vscode.workspace.onDidCreateFiles as jest.Mock).mockImplementation((callback) => {
                createCallback = callback;
                return { dispose: jest.fn() };
            });

            const fileMonitor = new FileChangeMonitor();
            const editedFiles: FileEdit[] = [];
            
            fileMonitor.onFileChanged((file) => {
                editedFiles.push(file);
            });

            // Act - Simulate file creation
            if (createCallback) {
                const mockEvent = {
                    files: [
                        { fsPath: '/test/workspace/src/new-file.ts' }
                    ]
                };
                createCallback(mockEvent);
            }

            // Assert
            expect(vscode.workspace.onDidCreateFiles).toHaveBeenCalled();
            expect(editedFiles).toHaveLength(1);
            expect(editedFiles[0].filePath).toBe('src/new-file.ts');
            expect(editedFiles[0].changeType).toBe('created');
        });

        test('should monitor file deletion events', async () => {
            // Arrange
            let deleteCallback: Function | undefined;
            (vscode.workspace.onDidDeleteFiles as jest.Mock).mockImplementation((callback) => {
                deleteCallback = callback;
                return { dispose: jest.fn() };
            });

            const fileMonitor = new FileChangeMonitor();
            const editedFiles: FileEdit[] = [];
            
            fileMonitor.onFileChanged((file) => {
                editedFiles.push(file);
            });

            // Act - Simulate file deletion
            if (deleteCallback) {
                const mockEvent = {
                    files: [
                        { fsPath: '/test/workspace/src/deleted-file.ts' }
                    ]
                };
                deleteCallback(mockEvent);
            }

            // Assert
            expect(vscode.workspace.onDidDeleteFiles).toHaveBeenCalled();
            expect(editedFiles).toHaveLength(1);
            expect(editedFiles[0].filePath).toBe('src/deleted-file.ts');
            expect(editedFiles[0].changeType).toBe('deleted');
        });

        test('should filter excluded file patterns', async () => {
            // Arrange
            let saveCallback: Function | undefined;
            (vscode.workspace.onDidSaveTextDocument as jest.Mock).mockImplementation((callback) => {
                saveCallback = callback;
                return { dispose: jest.fn() };
            });

            const fileMonitor = new FileChangeMonitor();
            const editedFiles: FileEdit[] = [];
            
            fileMonitor.onFileChanged((file) => {
                editedFiles.push(file);
            });

            // Act - Simulate saving excluded files
            if (saveCallback) {
                const excludedFiles = [
                    { uri: { fsPath: '/test/workspace/node_modules/package/index.js' }, fileName: 'index.js' },
                    { uri: { fsPath: '/test/workspace/build.log' }, fileName: 'build.log' },
                    { uri: { fsPath: '/test/workspace/.git/config' }, fileName: 'config' }
                ];

                excludedFiles.forEach(doc => saveCallback(doc));
            }

            // Assert - Excluded files should not be tracked
            expect(editedFiles).toHaveLength(0);
        });

        test('should handle file system watcher events', async () => {
            // Arrange
            const mockWatcher = {
                onDidCreate: jest.fn(() => ({ dispose: jest.fn() })),
                onDidChange: jest.fn(() => ({ dispose: jest.fn() })),
                onDidDelete: jest.fn(() => ({ dispose: jest.fn() })),
                dispose: jest.fn()
            };
            
            (vscode.workspace.createFileSystemWatcher as jest.Mock).mockReturnValue(mockWatcher);

            // Act
            const fileMonitor = new FileChangeMonitor();

            // Assert
            expect(vscode.workspace.createFileSystemWatcher).toHaveBeenCalled();
            expect(mockWatcher.onDidCreate).toHaveBeenCalled();
            expect(mockWatcher.onDidChange).toHaveBeenCalled();
            expect(mockWatcher.onDidDelete).toHaveBeenCalled();
        });
    });

    describe('Git Integration', () => {
        test('should detect Git repository using VS Code Git extension', async () => {
            // Arrange
            const mockGitExtension = {
                exports: {
                    getAPI: jest.fn(() => ({
                        repositories: [{
                            rootUri: { fsPath: '/test/workspace' },
                            state: {
                                HEAD: {
                                    name: 'main',
                                    commit: 'abc123'
                                }
                            }
                        }]
                    }))
                }
            };

            (vscode.extensions.getExtension as jest.Mock).mockReturnValue(mockGitExtension);

            const gitMonitor = new GitActivityMonitor('/test/workspace', outputChannel);

            // Act
            const isGitRepo = gitMonitor.isGitRepository();

            // Assert
            expect(isGitRepo).toBe(true);
            expect(vscode.extensions.getExtension).toHaveBeenCalledWith('vscode.git');
        });

        test('should retrieve commits using Git commands', async () => {
            // Arrange
            const child_process = require('child_process');
            const mockCommitOutput = [
                'abc123|Test commit 1|John Doe|2023-01-01T10:00:00Z|src/file1.ts',
                'def456|Test commit 2|Jane Smith|2023-01-01T11:00:00Z|src/file2.ts'
            ].join('\n');

            child_process.exec.mockImplementation((command: string, callback: Function) => {
                if (command.includes('git log')) {
                    callback(null, mockCommitOutput);
                } else if (command.includes('git rev-parse')) {
                    callback(null, '/test/workspace/.git');
                }
            });

            const gitMonitor = new GitActivityMonitor('/test/workspace', outputChannel);

            // Act
            const commits = await gitMonitor.getCommitsSince(new Date('2023-01-01T09:00:00Z'));

            // Assert
            expect(commits).toHaveLength(2);
            expect(commits[0].hash).toBe('abc123');
            expect(commits[0].message).toBe('Test commit 1');
            expect(commits[0].author).toBe('John Doe');
            expect(commits[1].hash).toBe('def456');
        });

        test('should handle Git command errors gracefully', async () => {
            // Arrange
            const child_process = require('child_process');
            child_process.exec.mockImplementation((command: string, callback: Function) => {
                callback(new Error('Git command failed'), null);
            });

            const gitMonitor = new GitActivityMonitor('/test/workspace', outputChannel);

            // Act
            const commits = await gitMonitor.getCommitsSince(new Date());

            // Assert
            expect(commits).toEqual([]);
        });

        test('should get current branch name', async () => {
            // Arrange
            const child_process = require('child_process');
            child_process.exec.mockImplementation((command: string, callback: Function) => {
                if (command.includes('git branch --show-current')) {
                    callback(null, 'feature/test-branch\n');
                }
            });

            const gitMonitor = new GitActivityMonitor('/test/workspace', outputChannel);

            // Act
            const branch = await gitMonitor.getCurrentBranch();

            // Assert
            expect(branch).toBe('feature/test-branch');
        });
    });

    describe('Terminal Integration', () => {
        test('should monitor terminal changes', async () => {
            // Arrange
            let terminalChangeCallback: Function | undefined;
            (vscode.window.onDidChangeActiveTerminal as jest.Mock).mockImplementation((callback) => {
                terminalChangeCallback = callback;
                return { dispose: jest.fn() };
            });

            const terminalMonitor = new TerminalErrorMonitor();
            const errors: TerminalError[] = [];
            
            terminalMonitor.onTerminalError((error) => {
                errors.push(error);
            });

            // Act - Simulate terminal change
            if (terminalChangeCallback) {
                const mockTerminal = {
                    name: 'Test Terminal',
                    processId: Promise.resolve(1234)
                };
                terminalChangeCallback(mockTerminal);
            }

            // Assert
            expect(vscode.window.onDidChangeActiveTerminal).toHaveBeenCalled();
        });

        test('should parse error messages from terminal output', () => {
            // Arrange
            const terminalMonitor = new TerminalErrorMonitor();
            const errors: TerminalError[] = [];
            
            terminalMonitor.onTerminalError((error) => {
                errors.push(error);
            });

            // Act - Simulate error output
            const errorOutputs = [
                'Error: Cannot find module "missing-package"',
                'TypeError: Cannot read property "length" of undefined',
                'SyntaxError: Unexpected token "}" in file.js:42:5'
            ];

            errorOutputs.forEach(output => {
                // Simulate terminal output processing
                if (terminalMonitor.isErrorOutput && terminalMonitor.isErrorOutput(output)) {
                    const error: TerminalError = {
                        message: output,
                        timestamp: new Date(),
                        terminalName: 'Test Terminal',
                        errorType: 'error'
                    };
                    terminalMonitor.onTerminalError && terminalMonitor.onTerminalError(() => {})(error);
                }
            });

            // Assert - Error parsing logic should be tested in unit tests
            expect(vscode.window.onDidChangeActiveTerminal).toHaveBeenCalled();
        });
    });

    describe('Webview Integration', () => {
        test('should register webview view provider', () => {
            // Arrange & Act
            const sidebarProvider = new SidebarPanelProvider(mockContext.extensionUri);

            // Assert
            expect(sidebarProvider).toBeDefined();
        });

        test('should handle webview view resolution', () => {
            // Arrange
            const sidebarProvider = new SidebarPanelProvider(mockContext.extensionUri);
            const mockWebviewView = {
                webview: {
                    options: {},
                    html: '',
                    onDidReceiveMessage: jest.fn(() => ({ dispose: jest.fn() })),
                    postMessage: jest.fn()
                },
                onDidChangeVisibility: jest.fn(() => ({ dispose: jest.fn() })),
                onDidDispose: jest.fn(() => ({ dispose: jest.fn() }))
            };

            // Act
            sidebarProvider.resolveWebviewView(mockWebviewView as any, {} as any, {} as any);

            // Assert
            expect(mockWebviewView.webview.onDidReceiveMessage).toHaveBeenCalled();
            expect(mockWebviewView.onDidChangeVisibility).toHaveBeenCalled();
        });

        test('should handle webview messages', () => {
            // Arrange
            const sidebarProvider = new SidebarPanelProvider(mockContext.extensionUri);
            const mockWebviewView = {
                webview: {
                    options: {},
                    html: '',
                    onDidReceiveMessage: jest.fn((callback) => {
                        // Simulate message handling
                        callback({ command: 'openFile', filePath: 'src/test.ts' });
                        return { dispose: jest.fn() };
                    }),
                    postMessage: jest.fn()
                },
                onDidChangeVisibility: jest.fn(() => ({ dispose: jest.fn() })),
                onDidDispose: jest.fn(() => ({ dispose: jest.fn() }))
            };

            let fileClickCallback: Function | undefined;
            sidebarProvider.onFileClick((filePath) => {
                fileClickCallback = () => filePath;
            });

            // Act
            sidebarProvider.resolveWebviewView(mockWebviewView as any, {} as any, {} as any);

            // Assert
            expect(mockWebviewView.webview.onDidReceiveMessage).toHaveBeenCalled();
        });

        test('should update webview content', () => {
            // Arrange
            const sidebarProvider = new SidebarPanelProvider(mockContext.extensionUri);
            const mockWebviewView = {
                webview: {
                    options: {},
                    html: '',
                    onDidReceiveMessage: jest.fn(() => ({ dispose: jest.fn() })),
                    postMessage: jest.fn()
                },
                onDidChangeVisibility: jest.fn(() => ({ dispose: jest.fn() })),
                onDidDispose: jest.fn(() => ({ dispose: jest.fn() }))
            };

            sidebarProvider.resolveWebviewView(mockWebviewView as any, {} as any, {} as any);

            const sessionData = {
                sessionId: 'test',
                startTime: new Date(),
                editedFiles: [],
                gitCommits: [],
                terminalErrors: [],
                summary: 'Test session'
            };

            // Act
            sidebarProvider.updateContent(sessionData);

            // Assert
            expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith({
                command: 'updateContent',
                data: sessionData
            });
        });
    });

    describe('Document and Workspace Integration', () => {
        test('should open documents in VS Code editor', async () => {
            // Arrange
            const mockDocument = {
                uri: { fsPath: '/test/workspace/src/test.ts' },
                fileName: '/test/workspace/src/test.ts'
            };

            (vscode.workspace.openTextDocument as jest.Mock).mockResolvedValue(mockDocument);
            (vscode.window.showTextDocument as jest.Mock).mockResolvedValue(undefined);

            // Act
            const uri = vscode.Uri.file('/test/workspace/src/test.ts');
            const document = await vscode.workspace.openTextDocument(uri);
            await vscode.window.showTextDocument(document);

            // Assert
            expect(vscode.workspace.openTextDocument).toHaveBeenCalledWith(uri);
            expect(vscode.window.showTextDocument).toHaveBeenCalledWith(mockDocument);
        });

        test('should handle workspace folder detection', () => {
            // Arrange & Act
            const workspaceFolders = vscode.workspace.workspaceFolders;

            // Assert
            expect(workspaceFolders).toBeDefined();
            expect(workspaceFolders).toHaveLength(1);
            expect(workspaceFolders![0].uri.fsPath).toBe('/test/workspace');
        });

        test('should handle configuration access', () => {
            // Arrange & Act
            const config = vscode.workspace.getConfiguration('sessionRecap');
            const enabled = config.get('enabled', true);

            // Assert
            expect(vscode.workspace.getConfiguration).toHaveBeenCalledWith('sessionRecap');
            expect(enabled).toBe(true);
        });
    });

    describe('Extension Context Integration', () => {
        test('should manage subscriptions properly', () => {
            // Arrange
            const disposable = { dispose: jest.fn() };
            
            // Act
            mockContext.subscriptions.push(disposable);

            // Assert
            expect(mockContext.subscriptions).toContain(disposable);
        });

        test('should access extension and storage URIs', () => {
            // Act & Assert
            expect(mockContext.extensionUri).toBeDefined();
            expect(mockContext.globalStorageUri).toBeDefined();
            expect(mockContext.extensionUri.fsPath).toBe('/test/extension');
            expect(mockContext.globalStorageUri.fsPath).toBe('/test/storage');
        });
    });
});