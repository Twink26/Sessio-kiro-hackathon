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
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const SessionStorage_1 = require("../services/SessionStorage");
const DataConverter_1 = require("../services/DataConverter");
// Mock fs module
jest.mock('fs/promises');
const mockFs = fs;
// Mock readdir to return string array instead of Dirent array
mockFs.readdir.mockImplementation(() => Promise.resolve([]));
// Mock vscode module
const mockContext = {
    globalStorageUri: {
        fsPath: '/test/storage'
    }
};
// Mock workspace
jest.mock('vscode', () => ({
    workspace: {
        workspaceFolders: [
            {
                uri: {
                    fsPath: '/test/workspace'
                }
            }
        ]
    }
}), { virtual: true });
describe('SessionStorage', () => {
    let sessionStorage;
    let mockSessionData;
    beforeEach(() => {
        jest.clearAllMocks();
        sessionStorage = new SessionStorage_1.SessionStorage(mockContext);
        mockSessionData = DataConverter_1.DataConverter.createNewSession();
        mockSessionData.sessionId = 'test-session-123';
    });
    describe('saveSession', () => {
        it('should save session data to file', async () => {
            mockFs.access.mockRejectedValueOnce(new Error('Directory not found'));
            mockFs.mkdir.mockResolvedValueOnce(undefined);
            mockFs.writeFile.mockResolvedValueOnce();
            await sessionStorage.saveSession(mockSessionData);
            expect(mockFs.mkdir).toHaveBeenCalledWith(path.join('/test/storage', 'sessions'), { recursive: true });
            expect(mockFs.writeFile).toHaveBeenCalledWith(path.join('/test/storage', 'sessions', 'test-session-123.session.json'), expect.stringContaining('"sessionId": "test-session-123"'), 'utf8');
        });
        it('should handle file write errors', async () => {
            mockFs.access.mockResolvedValueOnce();
            mockFs.writeFile.mockRejectedValueOnce(new Error('Write failed'));
            await expect(sessionStorage.saveSession(mockSessionData)).rejects.toThrow('Failed to save session');
        });
    });
    describe('loadLastSession', () => {
        it('should return null when no sessions exist', async () => {
            mockFs.access.mockResolvedValueOnce();
            mockFs.readdir.mockResolvedValueOnce([]);
            const result = await sessionStorage.loadLastSession();
            expect(result).toBeNull();
        });
        it('should load the most recent session for current workspace', async () => {
            const sessionData = DataConverter_1.DataConverter.toStoredSession(mockSessionData, 'L3Rlc3Qvd29ya3NwYWNl'); // base64 of '/test/workspace'
            mockFs.access.mockResolvedValueOnce();
            mockFs.readdir.mockResolvedValueOnce(['test-session-123.session.json']);
            mockFs.readFile.mockResolvedValueOnce(JSON.stringify(sessionData));
            const result = await sessionStorage.loadLastSession();
            expect(result).not.toBeNull();
            expect(result?.sessionId).toBe('test-session-123');
        });
        it('should skip sessions from different workspaces', async () => {
            const sessionData = DataConverter_1.DataConverter.toStoredSession(mockSessionData, 'different-workspace');
            mockFs.access.mockResolvedValueOnce();
            mockFs.readdir.mockResolvedValueOnce(['test-session-123.session.json']);
            mockFs.readFile.mockResolvedValueOnce(JSON.stringify(sessionData));
            const result = await sessionStorage.loadLastSession();
            expect(result).toBeNull();
        });
        it('should handle corrupted session files gracefully', async () => {
            mockFs.access.mockResolvedValueOnce();
            mockFs.readdir.mockResolvedValueOnce(['corrupted.session.json']);
            mockFs.readFile.mockResolvedValueOnce('invalid json');
            const result = await sessionStorage.loadLastSession();
            expect(result).toBeNull();
        });
    });
    describe('loadSession', () => {
        it('should load specific session by ID', async () => {
            const sessionData = DataConverter_1.DataConverter.toStoredSession(mockSessionData, 'test-workspace');
            mockFs.readFile.mockResolvedValueOnce(JSON.stringify(sessionData));
            const result = await sessionStorage.loadSession('test-session-123');
            expect(result).not.toBeNull();
            expect(result?.sessionId).toBe('test-session-123');
        });
        it('should return null for non-existent session', async () => {
            const error = new Error('File not found');
            error.code = 'ENOENT';
            mockFs.readFile.mockRejectedValueOnce(error);
            const result = await sessionStorage.loadSession('non-existent');
            expect(result).toBeNull();
        });
        it('should throw for other file read errors', async () => {
            mockFs.readFile.mockRejectedValueOnce(new Error('Permission denied'));
            await expect(sessionStorage.loadSession('test-session-123')).rejects.toThrow('Failed to load session');
        });
    });
    describe('getAllSessionIds', () => {
        it('should return list of session IDs', async () => {
            mockFs.access.mockResolvedValueOnce();
            mockFs.readdir.mockResolvedValueOnce([
                'session1.session.json',
                'session2.session.json',
                'other-file.txt'
            ]);
            const result = await sessionStorage.getAllSessionIds();
            expect(result).toEqual(['session1', 'session2']);
        });
        it('should create directory if it does not exist', async () => {
            mockFs.access.mockRejectedValueOnce(new Error('Directory not found'));
            mockFs.mkdir.mockResolvedValueOnce(undefined);
            mockFs.readdir.mockResolvedValueOnce([]);
            await sessionStorage.getAllSessionIds();
            expect(mockFs.mkdir).toHaveBeenCalledWith(path.join('/test/storage', 'sessions'), { recursive: true });
        });
    });
    describe('deleteSession', () => {
        it('should delete session file', async () => {
            mockFs.unlink.mockResolvedValueOnce();
            await sessionStorage.deleteSession('test-session-123');
            expect(mockFs.unlink).toHaveBeenCalledWith(path.join('/test/storage', 'sessions', 'test-session-123.session.json'));
        });
        it('should not throw if file does not exist', async () => {
            const error = new Error('File not found');
            error.code = 'ENOENT';
            mockFs.unlink.mockRejectedValueOnce(error);
            await expect(sessionStorage.deleteSession('non-existent')).resolves.not.toThrow();
        });
        it('should throw for other deletion errors', async () => {
            mockFs.unlink.mockRejectedValueOnce(new Error('Permission denied'));
            await expect(sessionStorage.deleteSession('test-session-123')).rejects.toThrow('Failed to delete session');
        });
    });
    describe('clearAllSessions', () => {
        it('should delete all session files', async () => {
            mockFs.access.mockResolvedValueOnce();
            mockFs.readdir.mockResolvedValueOnce(['session1.session.json', 'session2.session.json']);
            mockFs.unlink.mockResolvedValue();
            await sessionStorage.clearAllSessions();
            expect(mockFs.unlink).toHaveBeenCalledTimes(2);
        });
    });
    describe('isAvailable', () => {
        it('should return true when storage is writable', async () => {
            mockFs.access.mockResolvedValueOnce();
            mockFs.writeFile.mockResolvedValueOnce();
            mockFs.unlink.mockResolvedValueOnce();
            const result = await sessionStorage.isAvailable();
            expect(result).toBe(true);
        });
        it('should return false when storage is not writable', async () => {
            mockFs.access.mockRejectedValueOnce(new Error('Access denied'));
            mockFs.mkdir.mockRejectedValueOnce(new Error('Cannot create directory'));
            const result = await sessionStorage.isAvailable();
            expect(result).toBe(false);
        });
        it('should return false when test write fails', async () => {
            mockFs.access.mockResolvedValueOnce();
            mockFs.mkdir.mockResolvedValueOnce(undefined);
            mockFs.writeFile.mockRejectedValueOnce(new Error('Write failed'));
            const result = await sessionStorage.isAvailable();
            expect(result).toBe(false);
        });
    });
});
//# sourceMappingURL=SessionStorage.test.js.map