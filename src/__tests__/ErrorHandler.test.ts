import * as vscode from 'vscode';
import { ErrorHandler, ErrorCategory, RecoveryAction } from '../services/ErrorHandler';
import { LoggingService, LogLevel, ErrorContext } from '../services/LoggingService';

// Mock VS Code API
jest.mock('vscode', () => ({
    OutputChannel: jest.fn(),
    window: {
        showErrorMessage: jest.fn(),
        showWarningMessage: jest.fn(),
        showInformationMessage: jest.fn()
    }
}));

describe('ErrorHandler', () => {
    let errorHandler: ErrorHandler;
    let mockLoggingService: jest.Mocked<LoggingService>;
    let mockOutputChannel: jest.Mocked<vscode.OutputChannel>;

    beforeEach(() => {
        mockOutputChannel = {
            appendLine: jest.fn(),
            append: jest.fn(),
            show: jest.fn(),
            hide: jest.fn(),
            dispose: jest.fn(),
            name: 'Test Channel',
            clear: jest.fn(),
            replace: jest.fn()
        };

        mockLoggingService = {
            error: jest.fn(),
            warn: jest.fn(),
            info: jest.fn(),
            debug: jest.fn(),
            performance: jest.fn(),
            setLogLevel: jest.fn(),
            getTelemetryData: jest.fn(),
            clearTelemetryData: jest.fn(),
            getTelemetrySummary: jest.fn(),
            show: jest.fn(),
            dispose: jest.fn()
        } as any;

        errorHandler = new ErrorHandler(mockLoggingService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('Storage Error Handling', () => {
        it('should handle file not found error', () => {
            const error = new Error('ENOENT: no such file or directory');
            const context: ErrorContext = {
                component: 'SessionStorage',
                operation: 'loadSession'
            };

            const result = errorHandler.handleStorageError(error, context);

            expect(result.handled).toBe(true);
            expect(result.recoveryAction).toBe(RecoveryAction.FALLBACK);
            expect(result.userMessage).toContain('Session data file not found');
            expect(result.retryable).toBe(false);
        });

        it('should handle permission denied error', () => {
            const error = new Error('EACCES: permission denied');
            const context: ErrorContext = {
                component: 'SessionStorage',
                operation: 'saveSession'
            };

            const result = errorHandler.handleStorageError(error, context);

            expect(result.handled).toBe(true);
            expect(result.recoveryAction).toBe(RecoveryAction.USER_ACTION_REQUIRED);
            expect(result.userMessage).toContain('Permission denied');
            expect(result.retryable).toBe(false);
        });

        it('should handle disk space error', () => {
            const error = new Error('ENOSPC: no space left on device');
            const context: ErrorContext = {
                component: 'SessionStorage',
                operation: 'saveSession'
            };

            const result = errorHandler.handleStorageError(error, context);

            expect(result.handled).toBe(true);
            expect(result.recoveryAction).toBe(RecoveryAction.USER_ACTION_REQUIRED);
            expect(result.userMessage).toContain('Insufficient disk space');
            expect(result.retryable).toBe(true);
        });
    });

    describe('Git Error Handling', () => {
        it('should handle not a git repository error', () => {
            const error = new Error('not a git repository');
            const context: ErrorContext = {
                component: 'GitActivityMonitor',
                operation: 'getCommits'
            };

            const result = errorHandler.handleGitError(error, context);

            expect(result.handled).toBe(true);
            expect(result.recoveryAction).toBe(RecoveryAction.DISABLE_FEATURE);
            expect(result.userMessage).toContain('Git repository not detected');
            expect(result.fallbackData).toEqual({ gitCommits: [] });
            expect(result.retryable).toBe(false);
        });

        it('should handle git command not found error', () => {
            const error = new Error('git not found');
            const context: ErrorContext = {
                component: 'GitActivityMonitor',
                operation: 'getCommits'
            };

            const result = errorHandler.handleGitError(error, context);

            expect(result.handled).toBe(true);
            expect(result.recoveryAction).toBe(RecoveryAction.DISABLE_FEATURE);
            expect(result.userMessage).toContain('Git command not found');
            expect(result.fallbackData).toEqual({ gitCommits: [] });
        });

        it('should handle git timeout error', () => {
            const error = new Error('timeout waiting for git response');
            const context: ErrorContext = {
                component: 'GitActivityMonitor',
                operation: 'getCommits'
            };

            const result = errorHandler.handleGitError(error, context);

            expect(result.handled).toBe(true);
            expect(result.recoveryAction).toBe(RecoveryAction.RETRY);
            expect(result.userMessage).toContain('Git operation timed out');
            expect(result.retryable).toBe(true);
        });
    });

    describe('AI Service Error Handling', () => {
        it('should handle API key error', () => {
            const error = new Error('Invalid API key provided');
            const context: ErrorContext = {
                component: 'AISummaryService',
                operation: 'generateSummary'
            };

            const result = errorHandler.handleAIServiceError(error, context);

            expect(result.handled).toBe(true);
            expect(result.recoveryAction).toBe(RecoveryAction.FALLBACK);
            expect(result.userMessage).toContain('AI service authentication failed');
            expect(result.retryable).toBe(false);
        });

        it('should handle rate limit error', () => {
            const error = new Error('Rate limit exceeded');
            const context: ErrorContext = {
                component: 'AISummaryService',
                operation: 'generateSummary'
            };

            const result = errorHandler.handleAIServiceError(error, context);

            expect(result.handled).toBe(true);
            expect(result.recoveryAction).toBe(RecoveryAction.FALLBACK);
            expect(result.userMessage).toContain('AI service rate limit reached');
            expect(result.retryable).toBe(true);
        });

        it('should handle network error', () => {
            const error = new Error('Network timeout');
            const context: ErrorContext = {
                component: 'AISummaryService',
                operation: 'generateSummary'
            };

            const result = errorHandler.handleAIServiceError(error, context);

            expect(result.handled).toBe(true);
            expect(result.recoveryAction).toBe(RecoveryAction.RETRY);
            expect(result.userMessage).toContain('AI service temporarily unavailable');
            expect(result.retryable).toBe(true);
        });
    });

    describe('Terminal Error Handling', () => {
        it('should handle permission error', () => {
            const error = new Error('Terminal access denied');
            const context: ErrorContext = {
                component: 'TerminalErrorMonitor',
                operation: 'monitorTerminal'
            };

            const result = errorHandler.handleTerminalError(error, context);

            expect(result.handled).toBe(true);
            expect(result.recoveryAction).toBe(RecoveryAction.DISABLE_FEATURE);
            expect(result.userMessage).toContain('Terminal access denied');
            expect(result.fallbackData).toEqual({ terminalErrors: [] });
        });
    });

    describe('UI Error Handling', () => {
        it('should handle webview error', () => {
            const error = new Error('Webview creation failed');
            const context: ErrorContext = {
                component: 'SidebarPanelProvider',
                operation: 'createWebview'
            };

            const result = errorHandler.handleUIError(error, context);

            expect(result.handled).toBe(true);
            expect(result.recoveryAction).toBe(RecoveryAction.RETRY);
            expect(result.userMessage).toContain('UI panel failed to load');
            expect(result.retryable).toBe(true);
        });
    });

    describe('Retry Logic', () => {
        it('should allow retries up to maximum attempts', () => {
            const error = new Error('Network timeout');
            
            // First 3 attempts should be allowed
            expect(errorHandler.shouldRetry('test-operation', error)).toBe(true);
            expect(errorHandler.shouldRetry('test-operation', error)).toBe(true);
            expect(errorHandler.shouldRetry('test-operation', error)).toBe(true);
            
            // 4th attempt should be denied
            expect(errorHandler.shouldRetry('test-operation', error)).toBe(false);
        });

        it('should not retry permission errors', () => {
            const error = new Error('Permission denied');
            
            expect(errorHandler.shouldRetry('test-operation', error)).toBe(false);
        });

        it('should not retry not found errors', () => {
            const error = new Error('File not found');
            
            expect(errorHandler.shouldRetry('test-operation', error)).toBe(false);
        });

        it('should reset retry counter', () => {
            const error = new Error('Network timeout');
            
            // Use up retries
            errorHandler.shouldRetry('test-operation', error);
            errorHandler.shouldRetry('test-operation', error);
            errorHandler.shouldRetry('test-operation', error);
            expect(errorHandler.shouldRetry('test-operation', error)).toBe(false);
            
            // Reset and try again
            errorHandler.resetRetryCounter('test-operation');
            expect(errorHandler.shouldRetry('test-operation', error)).toBe(true);
        });
    });

    describe('User Messages', () => {
        it('should show error message', () => {
            errorHandler.showUserError('Test error message');
            
            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith('Test error message');
        });

        it('should show error message with actions', () => {
            const actions = ['Retry', 'Cancel'];
            errorHandler.showUserError('Test error message', actions);
            
            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                'Test error message',
                ...actions
            );
        });

        it('should show warning message', () => {
            errorHandler.showUserWarning('Test warning message');
            
            expect(vscode.window.showWarningMessage).toHaveBeenCalledWith('Test warning message');
        });

        it('should show info message', () => {
            errorHandler.showUserInfo('Test info message');
            
            expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('Test info message');
        });
    });
});