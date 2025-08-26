"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const DataConverter_1 = require("../services/DataConverter");
const StoredSession_1 = require("../models/StoredSession");
describe('DataConverter', () => {
    const mockSessionData = {
        sessionId: 'test-session-123',
        startTime: new Date('2023-01-01T10:00:00Z'),
        endTime: new Date('2023-01-01T12:00:00Z'),
        editedFiles: [
            {
                filePath: '/test/file1.ts',
                timestamp: new Date('2023-01-01T10:30:00Z'),
                changeType: 'modified',
                lineCount: 50
            }
        ],
        gitCommits: [
            {
                hash: 'abc123',
                message: 'Test commit',
                author: 'Test Author',
                timestamp: new Date('2023-01-01T11:00:00Z'),
                filesChanged: ['/test/file1.ts']
            }
        ],
        terminalErrors: [
            {
                message: 'Test error',
                timestamp: new Date('2023-01-01T11:30:00Z'),
                terminalName: 'Terminal 1',
                errorType: 'error'
            }
        ],
        summary: 'Test session summary'
    };
    describe('toStoredSession', () => {
        it('should convert SessionData to StoredSession correctly', () => {
            const workspaceId = 'test-workspace';
            const result = DataConverter_1.DataConverter.toStoredSession(mockSessionData, workspaceId);
            expect(result.sessionId).toBe(mockSessionData.sessionId);
            expect(result.workspaceId).toBe(workspaceId);
            expect(result.startTime).toBe('2023-01-01T10:00:00.000Z');
            expect(result.endTime).toBe('2023-01-01T12:00:00.000Z');
            expect(result.version).toBe(StoredSession_1.CURRENT_SCHEMA_VERSION);
            expect(result.aiSummary).toBe(mockSessionData.summary);
            // Check file edit conversion
            expect(result.editedFiles).toHaveLength(1);
            expect(result.editedFiles[0].filePath).toBe('/test/file1.ts');
            expect(result.editedFiles[0].timestamp).toBe('2023-01-01T10:30:00.000Z');
            expect(result.editedFiles[0].changeType).toBe('modified');
            expect(result.editedFiles[0].lineCount).toBe(50);
            // Check git commit conversion
            expect(result.gitCommits).toHaveLength(1);
            expect(result.gitCommits[0].hash).toBe('abc123');
            expect(result.gitCommits[0].message).toBe('Test commit');
            expect(result.gitCommits[0].timestamp).toBe('2023-01-01T11:00:00.000Z');
            // Check terminal error conversion
            expect(result.terminalErrors).toHaveLength(1);
            expect(result.terminalErrors[0].message).toBe('Test error');
            expect(result.terminalErrors[0].timestamp).toBe('2023-01-01T11:30:00.000Z');
            expect(result.terminalErrors[0].errorType).toBe('error');
        });
        it('should handle undefined endTime', () => {
            const sessionWithoutEndTime = { ...mockSessionData, endTime: undefined };
            const result = DataConverter_1.DataConverter.toStoredSession(sessionWithoutEndTime, 'test-workspace');
            expect(result.endTime).toBeUndefined();
        });
    });
    describe('fromStoredSession', () => {
        it('should convert StoredSession to SessionData correctly', () => {
            const storedSession = DataConverter_1.DataConverter.toStoredSession(mockSessionData, 'test-workspace');
            const result = DataConverter_1.DataConverter.fromStoredSession(storedSession);
            expect(result.sessionId).toBe(mockSessionData.sessionId);
            expect(result.startTime).toEqual(mockSessionData.startTime);
            expect(result.endTime).toEqual(mockSessionData.endTime);
            expect(result.summary).toBe(mockSessionData.summary);
            // Check arrays are properly converted
            expect(result.editedFiles).toHaveLength(1);
            expect(result.gitCommits).toHaveLength(1);
            expect(result.terminalErrors).toHaveLength(1);
            // Check date objects are properly restored
            expect(result.editedFiles[0].timestamp).toBeInstanceOf(Date);
            expect(result.gitCommits[0].timestamp).toBeInstanceOf(Date);
            expect(result.terminalErrors[0].timestamp).toBeInstanceOf(Date);
        });
    });
    describe('createNewSession', () => {
        it('should create a new session with generated ID and current timestamp', () => {
            const result = DataConverter_1.DataConverter.createNewSession();
            expect(result.sessionId).toBeDefined();
            expect(result.sessionId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
            expect(result.startTime).toBeInstanceOf(Date);
            expect(result.editedFiles).toEqual([]);
            expect(result.gitCommits).toEqual([]);
            expect(result.terminalErrors).toEqual([]);
            expect(result.endTime).toBeUndefined();
            expect(result.summary).toBeUndefined();
        });
        it('should create unique session IDs', () => {
            const session1 = DataConverter_1.DataConverter.createNewSession();
            const session2 = DataConverter_1.DataConverter.createNewSession();
            expect(session1.sessionId).not.toBe(session2.sessionId);
        });
    });
});
//# sourceMappingURL=DataConverter.test.js.map