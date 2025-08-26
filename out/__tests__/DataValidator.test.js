"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const DataValidator_1 = require("../services/DataValidator");
const StoredSession_1 = require("../models/StoredSession");
describe('DataValidator', () => {
    const validStoredSession = {
        sessionId: 'test-session-123',
        workspaceId: 'test-workspace',
        startTime: '2023-01-01T10:00:00.000Z',
        endTime: '2023-01-01T12:00:00.000Z',
        editedFiles: [
            {
                filePath: '/test/file1.ts',
                timestamp: '2023-01-01T10:30:00.000Z',
                changeType: 'modified',
                lineCount: 50
            }
        ],
        gitCommits: [
            {
                hash: 'abc123',
                message: 'Test commit',
                author: 'Test Author',
                timestamp: '2023-01-01T11:00:00.000Z',
                filesChanged: ['/test/file1.ts']
            }
        ],
        terminalErrors: [
            {
                message: 'Test error',
                timestamp: '2023-01-01T11:30:00.000Z',
                terminalName: 'Terminal 1',
                errorType: 'error'
            }
        ],
        aiSummary: 'Test session summary',
        version: StoredSession_1.CURRENT_SCHEMA_VERSION
    };
    describe('validateStoredSession', () => {
        it('should validate a correct stored session', () => {
            expect(() => DataValidator_1.DataValidator.validateStoredSession(validStoredSession)).not.toThrow();
            const result = DataValidator_1.DataValidator.validateStoredSession(validStoredSession);
            expect(result).toEqual(validStoredSession);
        });
        it('should throw ValidationError for null/undefined data', () => {
            expect(() => DataValidator_1.DataValidator.validateStoredSession(null)).toThrow(DataValidator_1.ValidationError);
            expect(() => DataValidator_1.DataValidator.validateStoredSession(undefined)).toThrow(DataValidator_1.ValidationError);
            expect(() => DataValidator_1.DataValidator.validateStoredSession('not an object')).toThrow(DataValidator_1.ValidationError);
        });
        it('should throw ValidationError for missing required fields', () => {
            const testCases = [
                { field: 'sessionId', value: undefined },
                { field: 'sessionId', value: 123 },
                { field: 'workspaceId', value: undefined },
                { field: 'workspaceId', value: 123 },
                { field: 'startTime', value: undefined },
                { field: 'startTime', value: 123 },
                { field: 'version', value: undefined },
                { field: 'version', value: 123 }
            ];
            testCases.forEach(({ field, value }) => {
                const invalidData = { ...validStoredSession, [field]: value };
                expect(() => DataValidator_1.DataValidator.validateStoredSession(invalidData)).toThrow(DataValidator_1.ValidationError);
            });
        });
        it('should throw ValidationError for invalid date strings', () => {
            const invalidStartTime = { ...validStoredSession, startTime: 'invalid-date' };
            expect(() => DataValidator_1.DataValidator.validateStoredSession(invalidStartTime)).toThrow(DataValidator_1.ValidationError);
            const invalidEndTime = { ...validStoredSession, endTime: 'invalid-date' };
            expect(() => DataValidator_1.DataValidator.validateStoredSession(invalidEndTime)).toThrow(DataValidator_1.ValidationError);
        });
        it('should throw ValidationError for non-array fields', () => {
            const testCases = ['editedFiles', 'gitCommits', 'terminalErrors'];
            testCases.forEach(field => {
                const invalidData = { ...validStoredSession, [field]: 'not an array' };
                expect(() => DataValidator_1.DataValidator.validateStoredSession(invalidData)).toThrow(DataValidator_1.ValidationError);
            });
        });
        it('should validate file edits correctly', () => {
            const invalidFileEdit = {
                ...validStoredSession,
                editedFiles: [{ filePath: 123, timestamp: 'invalid', changeType: 'invalid' }]
            };
            expect(() => DataValidator_1.DataValidator.validateStoredSession(invalidFileEdit)).toThrow(DataValidator_1.ValidationError);
        });
        it('should validate git commits correctly', () => {
            const invalidGitCommit = {
                ...validStoredSession,
                gitCommits: [{ hash: 123, message: '', author: '', timestamp: 'invalid', filesChanged: 'not array' }]
            };
            expect(() => DataValidator_1.DataValidator.validateStoredSession(invalidGitCommit)).toThrow(DataValidator_1.ValidationError);
        });
        it('should validate terminal errors correctly', () => {
            const invalidTerminalError = {
                ...validStoredSession,
                terminalErrors: [{ message: 123, timestamp: 'invalid', terminalName: '', errorType: 'invalid' }]
            };
            expect(() => DataValidator_1.DataValidator.validateStoredSession(invalidTerminalError)).toThrow(DataValidator_1.ValidationError);
        });
        it('should accept valid change types', () => {
            const validChangeTypes = ['created', 'modified', 'deleted'];
            validChangeTypes.forEach(changeType => {
                const data = {
                    ...validStoredSession,
                    editedFiles: [{ ...validStoredSession.editedFiles[0], changeType }]
                };
                expect(() => DataValidator_1.DataValidator.validateStoredSession(data)).not.toThrow();
            });
        });
        it('should accept valid error types', () => {
            const validErrorTypes = ['error', 'exception', 'failure'];
            validErrorTypes.forEach(errorType => {
                const data = {
                    ...validStoredSession,
                    terminalErrors: [{ ...validStoredSession.terminalErrors[0], errorType }]
                };
                expect(() => DataValidator_1.DataValidator.validateStoredSession(data)).not.toThrow();
            });
        });
    });
    describe('isSchemaCompatible', () => {
        it('should return true for current version', () => {
            expect(DataValidator_1.DataValidator.isSchemaCompatible(StoredSession_1.CURRENT_SCHEMA_VERSION)).toBe(true);
        });
        it('should return false for unknown versions', () => {
            expect(DataValidator_1.DataValidator.isSchemaCompatible('0.0.1')).toBe(false);
            expect(DataValidator_1.DataValidator.isSchemaCompatible('2.0.0')).toBe(false);
        });
    });
    describe('migrateToCurrentVersion', () => {
        it('should add version to legacy data', () => {
            const legacyData = { ...validStoredSession };
            delete legacyData.version;
            const result = DataValidator_1.DataValidator.migrateToCurrentVersion(legacyData);
            expect(result.version).toBe(StoredSession_1.CURRENT_SCHEMA_VERSION);
        });
        it('should validate data after migration', () => {
            const legacyData = { ...validStoredSession };
            delete legacyData.version;
            delete legacyData.sessionId; // Make it invalid
            expect(() => DataValidator_1.DataValidator.migrateToCurrentVersion(legacyData)).toThrow(DataValidator_1.ValidationError);
        });
        it('should throw for unsupported versions', () => {
            const futureVersionData = { ...validStoredSession, version: '2.0.0' };
            expect(() => DataValidator_1.DataValidator.migrateToCurrentVersion(futureVersionData)).toThrow(DataValidator_1.ValidationError);
        });
    });
});
//# sourceMappingURL=DataValidator.test.js.map