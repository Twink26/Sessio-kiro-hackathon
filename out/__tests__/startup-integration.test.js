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
const SessionTracker_1 = require("../services/SessionTracker");
const SidebarPanelProvider_1 = require("../providers/SidebarPanelProvider");
const AISummaryService_1 = require("../services/AISummaryService");
// Mock VS Code API
jest.mock('vscode', () => ({
    window: {
        createOutputChannel: jest.fn(() => ({
            appendLine: jest.fn(),
            show: jest.fn(),
            dispose: jest.fn()
        })),
        registerWebviewViewProvider: jest.fn(),
        showErrorMessage: jest.fn(),
        showWarningMessage: jest.fn(() => Promise.resolve()),
        showInformationMessage: jest.fn(),
        showTextDocument: jest.fn()
    },
    workspace: {
        getConfiguration: jest.fn(() => ({
            get: jest.fn((key, defaultValue) => {
                const config = {
                    'aiProvider': 'disabled',
                    'openaiApiKey': '',
                    'aiMaxTokens': 150,
                    'aiTemperature': 0.7
                };
                return config[key] ?? defaultValue;
            })
        })),
        workspaceFolders: [],
        openTextDocument: jest.fn()
    },
    commands: {
        registerCommand: jest.fn(() => ({ dispose: jest.fn() }))
    },
    Uri: {
        file: jest.fn((path) => ({ fsPath: path }))
    }
}));
describe('Session Startup Integration', () => {
    let mockContext;
    let sessionTracker;
    let sidebarProvider;
    let aiSummaryService;
    let outputChannel;
    beforeEach(() => {
        jest.clearAllMocks();
        mockContext = {
            subscriptions: [],
            extensionUri: { fsPath: '/test/path' },
            globalStorageUri: { fsPath: '/test/storage' }
        };
        outputChannel = vscode.window.createOutputChannel('Session Recap');
        sidebarProvider = new SidebarPanelProvider_1.SidebarPanelProvider(mockContext.extensionUri);
        aiSummaryService = new AISummaryService_1.AISummaryService(outputChannel);
        sessionTracker = new SessionTracker_1.SessionTracker(mockContext, sidebarProvider);
    });
    afterEach(() => {
        if (sessionTracker && 'dispose' in sessionTracker) {
            sessionTracker.dispose();
        }
    });
    test('should handle first-time startup with no previous session', async () => {
        // Arrange
        const updateContentSpy = jest.spyOn(sidebarProvider, 'updateContent');
        // Act
        const previousSession = await sessionTracker.ensurePreviousSessionLoaded();
        // Assert
        expect(previousSession).toBeNull();
    });
    test('should handle startup with existing previous session', async () => {
        // Arrange
        const mockPreviousSession = {
            sessionId: 'test-session',
            startTime: new Date('2023-01-01T10:00:00Z'),
            endTime: new Date('2023-01-01T11:00:00Z'),
            editedFiles: [
                {
                    filePath: 'test.ts',
                    timestamp: new Date('2023-01-01T10:30:00Z'),
                    changeType: 'modified'
                }
            ],
            gitCommits: [
                {
                    hash: 'abc123',
                    message: 'Test commit',
                    author: 'Test User',
                    timestamp: new Date('2023-01-01T10:45:00Z'),
                    filesChanged: ['test.ts']
                }
            ],
            terminalErrors: [],
            summary: 'Test session summary'
        };
        // Mock the session storage to return a previous session
        const mockLoadLastSession = jest.fn().mockResolvedValue(mockPreviousSession);
        sessionTracker.sessionStorage.loadLastSession = mockLoadLastSession;
        // Act
        const previousSession = await sessionTracker.ensurePreviousSessionLoaded();
        // Assert
        expect(previousSession).toEqual(mockPreviousSession);
        expect(mockLoadLastSession).toHaveBeenCalled();
    });
    test('should generate AI summary for session without summary', async () => {
        // Arrange
        const mockSession = {
            sessionId: 'test-session',
            startTime: new Date(),
            editedFiles: [
                {
                    filePath: 'test.ts',
                    timestamp: new Date(),
                    changeType: 'modified'
                }
            ],
            gitCommits: [],
            terminalErrors: []
        };
        // Act
        const fallbackSummary = aiSummaryService.generateFallbackSummary(mockSession);
        // Assert
        expect(fallbackSummary).toContain('Modified 1 file');
    });
    test('should handle corrupted session data gracefully', async () => {
        // Arrange
        const mockLoadLastSession = jest.fn().mockRejectedValue(new Error('Corrupted data'));
        sessionTracker.sessionStorage.loadLastSession = mockLoadLastSession;
        // Act
        const previousSession = await sessionTracker.ensurePreviousSessionLoaded();
        // Assert
        expect(previousSession).toBeNull();
        expect(mockLoadLastSession).toHaveBeenCalled();
    });
    test('should start tracking new session after loading previous session', () => {
        // Act
        sessionTracker.startTracking();
        const currentSession = sessionTracker.getCurrentSession();
        // Assert
        expect(currentSession).toBeDefined();
        expect(currentSession.sessionId).toBeDefined();
        expect(currentSession.startTime).toBeInstanceOf(Date);
        expect(currentSession.editedFiles).toEqual([]);
        expect(currentSession.gitCommits).toEqual([]);
        expect(currentSession.terminalErrors).toEqual([]);
    });
    test('should handle file click events from sidebar', () => {
        // Arrange
        const mockCallback = jest.fn();
        // Act
        sidebarProvider.onFileClick(mockCallback);
        // Simulate file click (this would normally come from webview)
        const testFilePath = '/test/file.ts';
        if (sidebarProvider._fileClickCallback) {
            sidebarProvider._fileClickCallback(testFilePath);
        }
        // Assert
        expect(mockCallback).toHaveBeenCalledWith(testFilePath);
    });
});
//# sourceMappingURL=startup-integration.test.js.map