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
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const util_1 = require("util");
const GitActivityMonitor_1 = require("../services/GitActivityMonitor");
// Mock dependencies
jest.mock('vscode');
jest.mock('child_process');
jest.mock('fs');
jest.mock('path');
jest.mock('util');
const mockExec = jest.fn();
const mockPromisify = util_1.promisify;
mockPromisify.mockReturnValue(mockExec);
const mockFs = fs;
const mockPath = path;
const mockVscode = vscode;
describe('GitActivityMonitor', () => {
    let gitMonitor;
    const mockWorkspaceRoot = '/mock/workspace';
    beforeEach(() => {
        jest.clearAllMocks();
        // Mock workspace folders
        Object.defineProperty(mockVscode.workspace, 'workspaceFolders', {
            value: [{
                    uri: { fsPath: mockWorkspaceRoot }
                }],
            writable: true,
            configurable: true
        });
        mockPath.join.mockImplementation((...args) => args.join('/'));
        gitMonitor = new GitActivityMonitor_1.GitActivityMonitor();
    });
    describe('isGitRepository', () => {
        it('should return true when .git directory exists', () => {
            mockFs.existsSync.mockReturnValue(true);
            const result = gitMonitor.isGitRepository();
            expect(result).toBe(true);
            expect(mockPath.join).toHaveBeenCalledWith(mockWorkspaceRoot, '.git');
            expect(mockFs.existsSync).toHaveBeenCalledWith('/mock/workspace/.git');
        });
        it('should return false when .git directory does not exist', () => {
            mockFs.existsSync.mockReturnValue(false);
            const result = gitMonitor.isGitRepository();
            expect(result).toBe(false);
        });
        it('should return false when no workspace is available', () => {
            Object.defineProperty(mockVscode.workspace, 'workspaceFolders', {
                value: undefined,
                writable: true,
                configurable: true
            });
            gitMonitor = new GitActivityMonitor_1.GitActivityMonitor();
            const result = gitMonitor.isGitRepository();
            expect(result).toBe(false);
        });
        it('should return false when fs.existsSync throws an error', () => {
            mockFs.existsSync.mockImplementation(() => {
                throw new Error('File system error');
            });
            const result = gitMonitor.isGitRepository();
            expect(result).toBe(false);
        });
    });
    describe('getCurrentBranch', () => {
        beforeEach(() => {
            mockFs.existsSync.mockReturnValue(true); // Mock git repository exists
        });
        it('should return current branch name', async () => {
            const mockStdout = 'main\n';
            mockExec.mockResolvedValue({ stdout: mockStdout, stderr: '' });
            const result = await gitMonitor.getCurrentBranch();
            expect(result).toBe('main');
            expect(mockExec).toHaveBeenCalledWith('git rev-parse --abbrev-ref HEAD', { cwd: mockWorkspaceRoot, timeout: 5000 });
        });
        it('should return null when not in a git repository', async () => {
            mockFs.existsSync.mockReturnValue(false);
            const result = await gitMonitor.getCurrentBranch();
            expect(result).toBe(null);
            expect(mockExec).not.toHaveBeenCalled();
        });
        it('should return null when git command fails', async () => {
            mockExec.mockRejectedValue(new Error('Git command failed'));
            const result = await gitMonitor.getCurrentBranch();
            expect(result).toBe(null);
        });
        it('should return null when no workspace is available', async () => {
            Object.defineProperty(mockVscode.workspace, 'workspaceFolders', {
                value: undefined,
                writable: true,
                configurable: true
            });
            gitMonitor = new GitActivityMonitor_1.GitActivityMonitor();
            const result = await gitMonitor.getCurrentBranch();
            expect(result).toBe(null);
        });
    });
    describe('getCommitsSince', () => {
        const mockTimestamp = new Date('2024-01-01T10:00:00Z');
        beforeEach(() => {
            mockFs.existsSync.mockReturnValue(true); // Mock git repository exists
        });
        it('should return parsed commits when git log succeeds', async () => {
            const mockGitLogOutput = `abc123|Initial commit|John Doe|2024-01-01T12:00:00Z
src/file1.ts
src/file2.ts

def456|Fix bug|Jane Smith|2024-01-01T11:00:00Z
src/file3.ts`;
            mockExec.mockResolvedValue({ stdout: mockGitLogOutput, stderr: '' });
            const result = await gitMonitor.getCommitsSince(mockTimestamp);
            expect(result).toHaveLength(2);
            expect(result[0]).toEqual({
                hash: 'abc123',
                message: 'Initial commit',
                author: 'John Doe',
                timestamp: new Date('2024-01-01T12:00:00Z'),
                filesChanged: ['src/file1.ts', 'src/file2.ts']
            });
            expect(result[1]).toEqual({
                hash: 'def456',
                message: 'Fix bug',
                author: 'Jane Smith',
                timestamp: new Date('2024-01-01T11:00:00Z'),
                filesChanged: ['src/file3.ts']
            });
            expect(mockExec).toHaveBeenCalledWith(`git log --since="${mockTimestamp.toISOString()}" --pretty=format:"%H|%s|%an|%ai" --name-only`, { cwd: mockWorkspaceRoot, timeout: 10000 });
        });
        it('should return empty array when not in a git repository', async () => {
            mockFs.existsSync.mockReturnValue(false);
            const result = await gitMonitor.getCommitsSince(mockTimestamp);
            expect(result).toEqual([]);
            expect(mockExec).not.toHaveBeenCalled();
        });
        it('should return empty array when git command fails', async () => {
            mockExec.mockRejectedValue(new Error('Git command failed'));
            const result = await gitMonitor.getCommitsSince(mockTimestamp);
            expect(result).toEqual([]);
        });
        it('should return empty array when no commits found', async () => {
            mockExec.mockResolvedValue({ stdout: '', stderr: '' });
            const result = await gitMonitor.getCommitsSince(mockTimestamp);
            expect(result).toEqual([]);
        });
        it('should handle malformed git log output gracefully', async () => {
            const malformedOutput = `invalid-format
abc123|Valid commit|John Doe|2024-01-01T12:00:00Z
src/file1.ts

incomplete|data`;
            mockExec.mockResolvedValue({ stdout: malformedOutput, stderr: '' });
            const result = await gitMonitor.getCommitsSince(mockTimestamp);
            expect(result).toHaveLength(1);
            expect(result[0].hash).toBe('abc123');
            expect(result[0].message).toBe('Valid commit');
        });
        it('should limit results to 10 commits', async () => {
            // Generate 15 mock commits
            const commits = Array.from({ length: 15 }, (_, i) => {
                const timestamp = new Date(2024, 0, i + 1, 12, 0, 0).toISOString();
                return `hash${i}|Commit ${i}|Author ${i}|${timestamp}\nfile${i}.ts`;
            });
            const mockOutput = commits.join('\n\n');
            mockExec.mockResolvedValue({ stdout: mockOutput, stderr: '' });
            const result = await gitMonitor.getCommitsSince(mockTimestamp);
            expect(result).toHaveLength(10);
        });
        it('should sort commits by timestamp (newest first)', async () => {
            const mockGitLogOutput = `old123|Old commit|John Doe|2024-01-01T10:00:00Z
src/old.ts

new456|New commit|Jane Smith|2024-01-01T14:00:00Z
src/new.ts

mid789|Middle commit|Bob Wilson|2024-01-01T12:00:00Z
src/mid.ts`;
            mockExec.mockResolvedValue({ stdout: mockGitLogOutput, stderr: '' });
            const result = await gitMonitor.getCommitsSince(mockTimestamp);
            expect(result).toHaveLength(3);
            expect(result[0].message).toBe('New commit'); // Newest first
            expect(result[1].message).toBe('Middle commit');
            expect(result[2].message).toBe('Old commit'); // Oldest last
        });
        it('should return empty array when no workspace is available', async () => {
            Object.defineProperty(mockVscode.workspace, 'workspaceFolders', {
                value: undefined,
                writable: true,
                configurable: true
            });
            gitMonitor = new GitActivityMonitor_1.GitActivityMonitor();
            const result = await gitMonitor.getCommitsSince(mockTimestamp);
            expect(result).toEqual([]);
        });
    });
});
//# sourceMappingURL=GitActivityMonitor.test.js.map