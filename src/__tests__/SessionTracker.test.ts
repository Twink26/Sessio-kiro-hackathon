import * as vscode from 'vscode';
import { SessionTracker } from '../services/SessionTracker';
import { FileChangeMonitor } from '../services/FileChangeMonitor';
import { GitActivityMonitor } from '../services/GitActivityMonitor';
import { TerminalErrorMonitor } from '../services/TerminalErrorMonitor';
import { SessionStorage } from '../services/SessionStorage';
import { SessionData } from '../models/SessionData';
import { FileEdit } from '../models/FileEdit';
import { GitCommit } from '../models/GitCommit';
import { TerminalError } from '../models/TerminalError';

// Mock VS Code API
const mockContext = {
  globalStorageUri: { fsPath: '/mock/storage' },
  subscriptions: []
} as unknown as vscode.ExtensionContext;

const mockSidebarProvider = {
  updateContent: jest.fn(),
  show: jest.fn(),
  hide: jest.fn(),
  onFileClick: jest.fn()
};

// Mock the monitoring services
jest.mock('../services/FileChangeMonitor');
jest.mock('../services/GitActivityMonitor');
jest.mock('../services/TerminalErrorMonitor');
jest.mock('../services/SessionStorage');

const MockedFileChangeMonitor = FileChangeMonitor as jest.MockedClass<typeof FileChangeMonitor>;
const MockedGitActivityMonitor = GitActivityMonitor as jest.MockedClass<typeof GitActivityMonitor>;
const MockedTerminalErrorMonitor = TerminalErrorMonitor as jest.MockedClass<typeof TerminalErrorMonitor>;
const MockedSessionStorage = SessionStorage as jest.MockedClass<typeof SessionStorage>;

describe('SessionTracker Integration Tests', () => {
  let sessionTracker: SessionTracker;
  let mockFileMonitor: jest.Mocked<FileChangeMonitor>;
  let mockGitMonitor: jest.Mocked<GitActivityMonitor>;
  let mockTerminalMonitor: jest.Mocked<TerminalErrorMonitor>;
  let mockStorage: jest.Mocked<SessionStorage>;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock instances
    mockFileMonitor = {
      onFileChanged: jest.fn(),
      getEditedFiles: jest.fn().mockReturnValue([]),
      reset: jest.fn(),
      dispose: jest.fn()
    } as any;

    mockGitMonitor = {
      getCommitsSince: jest.fn().mockResolvedValue([]),
      isGitRepository: jest.fn().mockReturnValue(true),
      getCurrentBranch: jest.fn().mockResolvedValue('main')
    } as any;

    mockTerminalMonitor = {
      onTerminalError: jest.fn(),
      getLastError: jest.fn().mockReturnValue(null),
      reset: jest.fn(),
      dispose: jest.fn()
    } as any;

    mockStorage = {
      saveSession: jest.fn().mockResolvedValue(undefined),
      loadLastSession: jest.fn().mockResolvedValue(null),
      loadSession: jest.fn().mockResolvedValue(null),
      getAllSessionIds: jest.fn().mockResolvedValue([]),
      deleteSession: jest.fn().mockResolvedValue(undefined),
      clearAllSessions: jest.fn().mockResolvedValue(undefined),
      isAvailable: jest.fn().mockResolvedValue(true)
    } as any;

    // Configure mocked constructors
    MockedFileChangeMonitor.mockImplementation(() => mockFileMonitor);
    MockedGitActivityMonitor.mockImplementation(() => mockGitMonitor);
    MockedTerminalErrorMonitor.mockImplementation(() => mockTerminalMonitor);
    MockedSessionStorage.mockImplementation(() => mockStorage);

    // Create SessionTracker instance
    sessionTracker = new SessionTracker(mockContext, mockSidebarProvider as any);
  });

  afterEach(() => {
    if (sessionTracker) {
      sessionTracker.dispose();
    }
  });

  describe('Session Lifecycle Management', () => {
    test('should create new session on initialization', () => {
      const currentSession = sessionTracker.getCurrentSession();
      
      expect(currentSession.sessionId).toBeDefined();
      expect(currentSession.startTime).toBeInstanceOf(Date);
      expect(currentSession.editedFiles).toEqual([]);
      expect(currentSession.gitCommits).toEqual([]);
      expect(currentSession.terminalErrors).toEqual([]);
      expect(currentSession.endTime).toBeUndefined();
    });

    test('should start tracking and initialize monitors', () => {
      sessionTracker.startTracking();

      expect(mockFileMonitor.onFileChanged).toHaveBeenCalledWith(expect.any(Function));
      expect(mockTerminalMonitor.onTerminalError).toHaveBeenCalledWith(expect.any(Function));
    });

    test('should stop tracking and set end time', async () => {
      sessionTracker.startTracking();
      
      const beforeStop = new Date();
      sessionTracker.stopTracking();
      const afterStop = new Date();

      const currentSession = sessionTracker.getCurrentSession();
      expect(currentSession.endTime).toBeDefined();
      expect(currentSession.endTime!.getTime()).toBeGreaterThanOrEqual(beforeStop.getTime());
      expect(currentSession.endTime!.getTime()).toBeLessThanOrEqual(afterStop.getTime());
    });

    test('should save session on stop tracking', async () => {
      sessionTracker.startTracking();
      sessionTracker.stopTracking();

      // Wait for async save operation
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockStorage.saveSession).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: expect.any(String),
          startTime: expect.any(Date),
          endTime: expect.any(Date)
        })
      );
    });
  });

  describe('Monitor Integration', () => {
    test('should handle file changes from FileChangeMonitor', () => {
      sessionTracker.startTracking();

      // Simulate file change callback
      const fileChangeCallback = mockFileMonitor.onFileChanged.mock.calls[0][0];
      const mockFileEdit: FileEdit = {
        filePath: 'test.ts',
        timestamp: new Date(),
        changeType: 'modified',
        lineCount: 100
      };

      fileChangeCallback(mockFileEdit);

      const currentSession = sessionTracker.getCurrentSession();
      expect(currentSession.editedFiles).toContain(mockFileEdit);
      expect(mockSidebarProvider.updateContent).toHaveBeenCalledWith(currentSession);
    });

    test('should handle terminal errors from TerminalErrorMonitor', () => {
      sessionTracker.startTracking();

      // Simulate terminal error callback
      const terminalErrorCallback = mockTerminalMonitor.onTerminalError.mock.calls[0][0];
      const mockTerminalError: TerminalError = {
        message: 'Error: Test failed',
        timestamp: new Date(),
        terminalName: 'Terminal 1',
        errorType: 'error'
      };

      terminalErrorCallback(mockTerminalError);

      const currentSession = sessionTracker.getCurrentSession();
      expect(currentSession.terminalErrors).toEqual([mockTerminalError]);
      expect(mockSidebarProvider.updateContent).toHaveBeenCalledWith(currentSession);
    });

    test('should only keep most recent terminal error', () => {
      sessionTracker.startTracking();

      const terminalErrorCallback = mockTerminalMonitor.onTerminalError.mock.calls[0][0];
      
      const firstError: TerminalError = {
        message: 'First error',
        timestamp: new Date(),
        terminalName: 'Terminal 1',
        errorType: 'error'
      };

      const secondError: TerminalError = {
        message: 'Second error',
        timestamp: new Date(),
        terminalName: 'Terminal 1',
        errorType: 'failure'
      };

      terminalErrorCallback(firstError);
      terminalErrorCallback(secondError);

      const currentSession = sessionTracker.getCurrentSession();
      expect(currentSession.terminalErrors).toEqual([secondError]);
      expect(currentSession.terminalErrors).toHaveLength(1);
    });

    test('should update Git commits periodically when tracking', async () => {
      const mockCommits: GitCommit[] = [
        {
          hash: 'abc123',
          message: 'Test commit',
          author: 'Test Author',
          timestamp: new Date(),
          filesChanged: ['test.ts']
        }
      ];

      mockGitMonitor.getCommitsSince.mockResolvedValue(mockCommits);
      
      sessionTracker.startTracking();

      // Wait for initial Git update
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockGitMonitor.getCommitsSince).toHaveBeenCalledWith(
        expect.any(Date)
      );

      const currentSession = sessionTracker.getCurrentSession();
      expect(currentSession.gitCommits).toEqual(mockCommits);
    });

    test('should handle Git repository not available', async () => {
      mockGitMonitor.isGitRepository.mockReturnValue(false);
      
      sessionTracker.startTracking();

      // Wait for initial Git update attempt
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockGitMonitor.getCommitsSince).not.toHaveBeenCalled();
      
      const currentSession = sessionTracker.getCurrentSession();
      expect(currentSession.gitCommits).toEqual([]);
    });
  });

  describe('Session Storage Integration', () => {
    test('should save session with current monitor data', async () => {
      const mockFileEdits: FileEdit[] = [
        {
          filePath: 'test.ts',
          timestamp: new Date(),
          changeType: 'modified'
        }
      ];

      const mockTerminalError: TerminalError = {
        message: 'Test error',
        timestamp: new Date(),
        terminalName: 'Terminal 1',
        errorType: 'error'
      };

      mockFileMonitor.getEditedFiles.mockReturnValue(mockFileEdits);
      mockTerminalMonitor.getLastError.mockReturnValue(mockTerminalError);

      await sessionTracker.saveSession();

      expect(mockStorage.saveSession).toHaveBeenCalledWith(
        expect.objectContaining({
          editedFiles: mockFileEdits,
          terminalErrors: [mockTerminalError]
        })
      );
    });

    test('should load previous session on initialization', async () => {
      const mockPreviousSession: SessionData = {
        sessionId: 'previous-session',
        startTime: new Date(Date.now() - 3600000), // 1 hour ago
        endTime: new Date(Date.now() - 1800000), // 30 minutes ago
        editedFiles: [],
        gitCommits: [],
        terminalErrors: []
      };

      mockStorage.loadLastSession.mockResolvedValue(mockPreviousSession);

      // Create new tracker to test initialization
      const newTracker = new SessionTracker(mockContext, mockSidebarProvider as any);

      // Wait for async loading
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(newTracker.getPreviousSession()).toEqual(mockPreviousSession);
      
      newTracker.dispose();
    });

    test('should handle storage errors gracefully', async () => {
      mockStorage.saveSession.mockRejectedValue(new Error('Storage error'));

      await expect(sessionTracker.saveSession()).rejects.toThrow('Storage error');
    });
  });

  describe('Session Reset', () => {
    test('should reset all monitors and create new session', () => {
      const originalSessionId = sessionTracker.getCurrentSession().sessionId;
      
      sessionTracker.startTracking();
      sessionTracker.reset();

      expect(mockFileMonitor.reset).toHaveBeenCalled();
      expect(mockTerminalMonitor.reset).toHaveBeenCalled();

      const newSession = sessionTracker.getCurrentSession();
      expect(newSession.sessionId).not.toBe(originalSessionId);
      expect(newSession.editedFiles).toEqual([]);
      expect(newSession.gitCommits).toEqual([]);
      expect(newSession.terminalErrors).toEqual([]);
      expect(mockSidebarProvider.updateContent).toHaveBeenCalledWith(newSession);
    });
  });

  describe('Error Handling', () => {
    test('should handle Git monitoring errors gracefully', async () => {
      mockGitMonitor.getCommitsSince.mockRejectedValue(new Error('Git error'));
      
      sessionTracker.startTracking();

      // Wait for Git update attempt
      await new Promise(resolve => setTimeout(resolve, 10));

      // Should not throw and session should still be valid
      const currentSession = sessionTracker.getCurrentSession();
      expect(currentSession.gitCommits).toEqual([]);
    });

    test('should handle sidebar update errors gracefully', () => {
      mockSidebarProvider.updateContent.mockImplementation(() => {
        throw new Error('Sidebar error');
      });

      sessionTracker.startTracking();

      // Simulate file change that would trigger sidebar update
      const fileChangeCallback = mockFileMonitor.onFileChanged.mock.calls[0][0];
      const mockFileEdit: FileEdit = {
        filePath: 'test.ts',
        timestamp: new Date(),
        changeType: 'modified'
      };

      // Should not throw
      expect(() => fileChangeCallback(mockFileEdit)).not.toThrow();
    });
  });

  describe('Resource Cleanup', () => {
    test('should dispose of all resources', () => {
      sessionTracker.startTracking();
      sessionTracker.dispose();

      expect(mockFileMonitor.dispose).toHaveBeenCalled();
      expect(mockTerminalMonitor.dispose).toHaveBeenCalled();
    });

    test('should stop tracking on dispose', () => {
      sessionTracker.startTracking();
      
      const beforeDispose = sessionTracker.getCurrentSession().endTime;
      expect(beforeDispose).toBeUndefined();

      sessionTracker.dispose();

      const afterDispose = sessionTracker.getCurrentSession().endTime;
      expect(afterDispose).toBeDefined();
    });
  });

  describe('Data Immutability', () => {
    test('should return copies of session data to prevent external modification', () => {
      const session1 = sessionTracker.getCurrentSession();
      const session2 = sessionTracker.getCurrentSession();

      expect(session1).not.toBe(session2); // Different object references
      expect(session1).toEqual(session2); // Same content

      // Modifying returned session should not affect internal state
      session1.editedFiles.push({
        filePath: 'external-modification.ts',
        timestamp: new Date(),
        changeType: 'created'
      });

      const session3 = sessionTracker.getCurrentSession();
      expect(session3.editedFiles).toEqual([]);
    });

    test('should return copy of previous session data', async () => {
      const mockPreviousSession: SessionData = {
        sessionId: 'previous-session',
        startTime: new Date(),
        editedFiles: [],
        gitCommits: [],
        terminalErrors: []
      };

      mockStorage.loadLastSession.mockResolvedValue(mockPreviousSession);

      const newTracker = new SessionTracker(mockContext, mockSidebarProvider as any);
      await new Promise(resolve => setTimeout(resolve, 10));

      const previous1 = newTracker.getPreviousSession();
      const previous2 = newTracker.getPreviousSession();

      if (previous1 && previous2) {
        expect(previous1).not.toBe(previous2);
        expect(previous1).toEqual(previous2);
      }

      newTracker.dispose();
    });
  });
});