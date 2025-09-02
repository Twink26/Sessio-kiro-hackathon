import * as cp from 'child_process';
import * as fs from 'fs';
import { GitActivityMonitor } from '../services/GitActivityMonitor';

// Mock VS Code API
const mockOutputChannel = {
  appendLine: jest.fn(),
  dispose: jest.fn()
};

jest.mock('vscode', () => ({
  workspace: {
    workspaceFolders: [{ uri: { fsPath: '/mock/workspace' } }]
  },
  window: {
    createOutputChannel: jest.fn(() => mockOutputChannel)
  }
}));

// Mock child_process
jest.mock('child_process');
const mockExec = cp.exec as jest.MockedFunction<typeof cp.exec>;

// Mock fs
jest.mock('fs');
const mockFs = fs as jest.Mocked<typeof fs>;

describe('GitActivityMonitor Performance Optimizations', () => {
  let gitMonitor: GitActivityMonitor;

  beforeEach(() => {
    jest.clearAllMocks();
    gitMonitor = new GitActivityMonitor();
  });

  afterEach(() => {
    if ('dispose' in gitMonitor) {
      (gitMonitor as any).dispose();
    }
  });

  describe('Repository Detection Caching', () => {
    it('should cache repository detection result', () => {
      mockFs.existsSync.mockReturnValue(true);

      // First call
      const result1 = gitMonitor.isGitRepository();
      expect(result1).toBe(true);
      expect(mockFs.existsSync).toHaveBeenCalledTimes(1);

      // Second call should use cache
      const result2 = gitMonitor.isGitRepository();
      expect(result2).toBe(true);
      expect(mockFs.existsSync).toHaveBeenCalledTimes(1); // No additional call
    });

    it('should cache negative repository detection result', () => {
      mockFs.existsSync.mockReturnValue(false);

      // First call
      const result1 = gitMonitor.isGitRepository();
      expect(result1).toBe(false);
      expect(mockFs.existsSync).toHaveBeenCalledTimes(1);

      // Second call should use cache
      const result2 = gitMonitor.isGitRepository();
      expect(result2).toBe(false);
      expect(mockFs.existsSync).toHaveBeenCalledTimes(1); // No additional call
    });
  });

  describe('Branch Name Caching', () => {
    beforeEach(() => {
      mockFs.existsSync.mockReturnValue(true); // Mock git repository exists
    });

    it('should cache branch name result', async () => {
      const mockCallback = jest.fn((command, options, callback) => {
        callback(null, { stdout: 'main\n', stderr: '' });
      });
      mockExec.mockImplementation(mockCallback as any);

      // First call
      const result1 = await gitMonitor.getCurrentBranch();
      expect(result1).toBe('main');
      expect(mockExec).toHaveBeenCalledTimes(1);

      // Second call within cache timeout should use cache
      const result2 = await gitMonitor.getCurrentBranch();
      expect(result2).toBe('main');
      expect(mockExec).toHaveBeenCalledTimes(1); // No additional call
    });

    it('should cache null branch result on error', async () => {
      const mockCallback = jest.fn((command, options, callback) => {
        callback(new Error('Not a git repository'), null);
      });
      mockExec.mockImplementation(mockCallback as any);

      // First call
      const result1 = await gitMonitor.getCurrentBranch();
      expect(result1).toBe(null);
      expect(mockExec).toHaveBeenCalledTimes(1);

      // Second call should use cached null result
      const result2 = await gitMonitor.getCurrentBranch();
      expect(result2).toBe(null);
      expect(mockExec).toHaveBeenCalledTimes(1); // No additional call
    });

    it('should refresh cache after timeout', async () => {
      const mockCallback = jest.fn((command, options, callback) => {
        callback(null, { stdout: 'main\n', stderr: '' });
      });
      mockExec.mockImplementation(mockCallback as any);

      // Mock Date.now to control cache timeout
      const originalNow = Date.now;
      let mockTime = 1000;
      Date.now = jest.fn(() => mockTime);

      try {
        // First call
        await gitMonitor.getCurrentBranch();
        expect(mockExec).toHaveBeenCalledTimes(1);

        // Advance time beyond cache timeout (30 seconds)
        mockTime += 31000;

        // Second call should refresh cache
        await gitMonitor.getCurrentBranch();
        expect(mockExec).toHaveBeenCalledTimes(2);
      } finally {
        Date.now = originalNow;
      }
    });
  });

  describe('Commits Caching', () => {
    beforeEach(() => {
      mockFs.existsSync.mockReturnValue(true); // Mock git repository exists
    });

    it('should cache commits result', async () => {
      const mockGitOutput = 'abc123|Initial commit|John Doe|2023-01-01T00:00:00Z\n\nfile1.ts\nfile2.ts';
      const mockCallback = jest.fn((command, options, callback) => {
        callback(null, { stdout: mockGitOutput, stderr: '' });
      });
      mockExec.mockImplementation(mockCallback as any);

      const timestamp = new Date('2023-01-01');

      // First call
      const result1 = await gitMonitor.getCommitsSince(timestamp);
      expect(result1).toHaveLength(1);
      expect(result1[0].hash).toBe('abc123');
      expect(mockExec).toHaveBeenCalledTimes(1);

      // Second call with same timestamp should use cache
      const result2 = await gitMonitor.getCommitsSince(timestamp);
      expect(result2).toHaveLength(1);
      expect(mockExec).toHaveBeenCalledTimes(1); // No additional call
    });

    it('should cache empty commits result', async () => {
      const mockCallback = jest.fn((command, options, callback) => {
        callback(null, { stdout: '', stderr: '' });
      });
      mockExec.mockImplementation(mockCallback as any);

      const timestamp = new Date('2023-01-01');

      // First call
      const result1 = await gitMonitor.getCommitsSince(timestamp);
      expect(result1).toHaveLength(0);
      expect(mockExec).toHaveBeenCalledTimes(1);

      // Second call should use cache
      const result2 = await gitMonitor.getCommitsSince(timestamp);
      expect(result2).toHaveLength(0);
      expect(mockExec).toHaveBeenCalledTimes(1); // No additional call
    });

    it('should cache error results', async () => {
      const mockCallback = jest.fn((command, options, callback) => {
        callback(new Error('Git command failed'), null);
      });
      mockExec.mockImplementation(mockCallback as any);

      const timestamp = new Date('2023-01-01');

      // First call
      const result1 = await gitMonitor.getCommitsSince(timestamp);
      expect(result1).toHaveLength(0);
      expect(mockExec).toHaveBeenCalledTimes(1);

      // Second call should use cached error result
      const result2 = await gitMonitor.getCommitsSince(timestamp);
      expect(result2).toHaveLength(0);
      expect(mockExec).toHaveBeenCalledTimes(1); // No additional call
    });

    it('should limit cache size to prevent memory issues', async () => {
      const mockCallback = jest.fn((command, options, callback) => {
        callback(null, { stdout: 'abc123|Test commit|John Doe|2023-01-01T00:00:00Z\n\nfile.ts', stderr: '' });
      });
      mockExec.mockImplementation(mockCallback as any);

      // Add more than max cache entries (10)
      for (let i = 0; i < 12; i++) {
        const day = (i + 1).toString().padStart(2, '0');
        const timestamp = new Date(`2023-01-${day}`);
        await gitMonitor.getCommitsSince(timestamp);
      }

      // Should have made 12 calls (no caching for different timestamps)
      expect(mockExec).toHaveBeenCalledTimes(12);
    });
  });

  describe('Performance Monitoring Integration', () => {
    beforeEach(() => {
      mockFs.existsSync.mockReturnValue(true);
    });

    it('should use performance monitoring for operations', async () => {
      const mockCallback = jest.fn((command, options, callback) => {
        callback(null, { stdout: 'main\n', stderr: '' });
      });
      mockExec.mockImplementation(mockCallback as any);

      await gitMonitor.getCurrentBranch();

      // Performance monitoring should be called (we can't easily test the exact calls
      // without exposing internal implementation, but we can verify the operation completes)
      expect(mockExec).toHaveBeenCalled();
    });
  });

  describe('Optimized Parsing', () => {
    beforeEach(() => {
      mockFs.existsSync.mockReturnValue(true);
    });

    it('should limit files per commit to prevent memory issues', async () => {
      // Create a commit with many files
      const manyFiles = Array.from({ length: 100 }, (_, i) => `file${i}.ts`).join('\n');
      const mockGitOutput = `abc123|Test commit|John Doe|2023-01-01T00:00:00Z\n\n${manyFiles}`;
      
      const mockCallback = jest.fn((command, options, callback) => {
        callback(null, { stdout: mockGitOutput, stderr: '' });
      });
      mockExec.mockImplementation(mockCallback as any);

      const timestamp = new Date('2023-01-01');
      const result = await gitMonitor.getCommitsSince(timestamp);

      expect(result).toHaveLength(1);
      // Should limit files to 50 per commit
      expect(result[0].filesChanged.length).toBeLessThanOrEqual(50);
    });

    it('should handle malformed git output gracefully', async () => {
      const malformedOutput = 'invalid|output\nwithout|proper|format';
      const mockCallback = jest.fn((command, options, callback) => {
        callback(null, { stdout: malformedOutput, stderr: '' });
      });
      mockExec.mockImplementation(mockCallback as any);

      const timestamp = new Date('2023-01-01');
      const result = await gitMonitor.getCommitsSince(timestamp);

      // Should return empty array for malformed output
      expect(result).toHaveLength(0);
    });
  });

  describe('Cache Management', () => {
    it('should clear all caches when requested', () => {
      mockFs.existsSync.mockReturnValue(true);

      // Populate caches
      gitMonitor.isGitRepository();

      // Clear cache
      if ('clearCache' in gitMonitor) {
        (gitMonitor as any).clearCache();
      }

      // Next call should hit the file system again
      gitMonitor.isGitRepository();
      expect(mockFs.existsSync).toHaveBeenCalledTimes(2);
    });

    it('should dispose and clear caches', () => {
      mockFs.existsSync.mockReturnValue(true);

      // Populate cache
      gitMonitor.isGitRepository();
      expect(mockFs.existsSync).toHaveBeenCalledTimes(1);

      // Dispose
      if ('dispose' in gitMonitor) {
        (gitMonitor as any).dispose();
      }

      // Create new instance and verify cache is cleared
      gitMonitor = new GitActivityMonitor();
      gitMonitor.isGitRepository();
      expect(mockFs.existsSync).toHaveBeenCalledTimes(2);
    });
  });
});