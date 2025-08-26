import { DataValidator, ValidationError } from '../services/DataValidator';
import { CURRENT_SCHEMA_VERSION } from '../models/StoredSession';

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
    version: CURRENT_SCHEMA_VERSION
  };

  describe('validateStoredSession', () => {
    it('should validate a correct stored session', () => {
      expect(() => DataValidator.validateStoredSession(validStoredSession)).not.toThrow();
      const result = DataValidator.validateStoredSession(validStoredSession);
      expect(result).toEqual(validStoredSession);
    });

    it('should throw ValidationError for null/undefined data', () => {
      expect(() => DataValidator.validateStoredSession(null)).toThrow(ValidationError);
      expect(() => DataValidator.validateStoredSession(undefined)).toThrow(ValidationError);
      expect(() => DataValidator.validateStoredSession('not an object')).toThrow(ValidationError);
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
        expect(() => DataValidator.validateStoredSession(invalidData)).toThrow(ValidationError);
      });
    });

    it('should throw ValidationError for invalid date strings', () => {
      const invalidStartTime = { ...validStoredSession, startTime: 'invalid-date' };
      expect(() => DataValidator.validateStoredSession(invalidStartTime)).toThrow(ValidationError);

      const invalidEndTime = { ...validStoredSession, endTime: 'invalid-date' };
      expect(() => DataValidator.validateStoredSession(invalidEndTime)).toThrow(ValidationError);
    });

    it('should throw ValidationError for non-array fields', () => {
      const testCases = ['editedFiles', 'gitCommits', 'terminalErrors'];
      
      testCases.forEach(field => {
        const invalidData = { ...validStoredSession, [field]: 'not an array' };
        expect(() => DataValidator.validateStoredSession(invalidData)).toThrow(ValidationError);
      });
    });

    it('should validate file edits correctly', () => {
      const invalidFileEdit = {
        ...validStoredSession,
        editedFiles: [{ filePath: 123, timestamp: 'invalid', changeType: 'invalid' }]
      };
      expect(() => DataValidator.validateStoredSession(invalidFileEdit)).toThrow(ValidationError);
    });

    it('should validate git commits correctly', () => {
      const invalidGitCommit = {
        ...validStoredSession,
        gitCommits: [{ hash: 123, message: '', author: '', timestamp: 'invalid', filesChanged: 'not array' }]
      };
      expect(() => DataValidator.validateStoredSession(invalidGitCommit)).toThrow(ValidationError);
    });

    it('should validate terminal errors correctly', () => {
      const invalidTerminalError = {
        ...validStoredSession,
        terminalErrors: [{ message: 123, timestamp: 'invalid', terminalName: '', errorType: 'invalid' }]
      };
      expect(() => DataValidator.validateStoredSession(invalidTerminalError)).toThrow(ValidationError);
    });

    it('should accept valid change types', () => {
      const validChangeTypes = ['created', 'modified', 'deleted'];
      
      validChangeTypes.forEach(changeType => {
        const data = {
          ...validStoredSession,
          editedFiles: [{ ...validStoredSession.editedFiles[0], changeType }]
        };
        expect(() => DataValidator.validateStoredSession(data)).not.toThrow();
      });
    });

    it('should accept valid error types', () => {
      const validErrorTypes = ['error', 'exception', 'failure'];
      
      validErrorTypes.forEach(errorType => {
        const data = {
          ...validStoredSession,
          terminalErrors: [{ ...validStoredSession.terminalErrors[0], errorType }]
        };
        expect(() => DataValidator.validateStoredSession(data)).not.toThrow();
      });
    });
  });

  describe('isSchemaCompatible', () => {
    it('should return true for current version', () => {
      expect(DataValidator.isSchemaCompatible(CURRENT_SCHEMA_VERSION)).toBe(true);
    });

    it('should return false for unknown versions', () => {
      expect(DataValidator.isSchemaCompatible('0.0.1')).toBe(false);
      expect(DataValidator.isSchemaCompatible('2.0.0')).toBe(false);
    });
  });

  describe('migrateToCurrentVersion', () => {
    it('should add version to legacy data', () => {
      const legacyData = { ...validStoredSession };
      delete (legacyData as any).version;
      
      const result = DataValidator.migrateToCurrentVersion(legacyData);
      expect(result.version).toBe(CURRENT_SCHEMA_VERSION);
    });

    it('should validate data after migration', () => {
      const legacyData = { ...validStoredSession };
      delete (legacyData as any).version;
      delete (legacyData as any).sessionId; // Make it invalid
      
      expect(() => DataValidator.migrateToCurrentVersion(legacyData)).toThrow(ValidationError);
    });

    it('should throw for unsupported versions', () => {
      const futureVersionData = { ...validStoredSession, version: '2.0.0' };
      expect(() => DataValidator.migrateToCurrentVersion(futureVersionData)).toThrow(ValidationError);
    });
  });
});