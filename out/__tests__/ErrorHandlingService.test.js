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
const ErrorHandlingService_1 = require("../services/ErrorHandlingService");
const LoggingService_1 = require("../services/LoggingService");
const ErrorHandler_1 = require("../services/ErrorHandler");
// Mock VS Code API
jest.mock('vscode', () => ({
    OutputChannel: jest.fn(),
    window: {
        showErrorMessage: jest.fn(),
        showWarningMessage: jest.fn(),
        showInformationMessage: jest.fn()
    }
}));
describe('ErrorHandlingService', () => {
    let errorHandlingService;
    let mockOutputChannel;
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
        errorHandlingService = new ErrorHandlingService_1.ErrorHandlingService(mockOutputChannel, LoggingService_1.LogLevel.DEBUG);
    });
    afterEach(() => {
        jest.clearAllMocks();
    });
    describe('Service Initialization', () => {
        it('should initialize with logging and error handler services', () => {
            expect(errorHandlingService.getLoggingService()).toBeDefined();
            expect(errorHandlingService.getErrorHandler()).toBeDefined();
        });
    });
    describe('Error Handling', () => {
        it('should handle errors with automatic categorization', async () => {
            const error = new Error('ENOENT: file not found');
            const context = {
                component: 'SessionStorage',
                operation: 'loadSession'
            };
            const result = await errorHandlingService.handleError(error, context);
            expect(result.handled).toBe(true);
            expect(result.userMessage).toContain('Session data file not found');
        });
        it('should handle errors with explicit category', async () => {
            const error = new Error('Test git error');
            const context = {
                component: 'TestComponent',
                operation: 'testOperation'
            };
            const result = await errorHandlingService.handleError(error, context, ErrorHandler_1.ErrorCategory.GIT);
            expect(result.handled).toBe(true);
        });
    });
    describe('Execute with Error Handling', () => {
        it('should execute operation successfully', async () => {
            const mockOperation = jest.fn().mockResolvedValue('success');
            const context = {
                component: 'TestComponent',
                operation: 'testOperation'
            };
            const result = await errorHandlingService.executeWithErrorHandling(mockOperation, context);
            expect(result).toBe('success');
            expect(mockOperation).toHaveBeenCalledTimes(1);
        });
        it('should handle operation failure with fallback', async () => {
            const mockOperation = jest.fn().mockRejectedValue(new Error('Operation failed'));
            const context = {
                component: 'TestComponent',
                operation: 'testOperation'
            };
            const fallbackValue = 'fallback';
            const result = await errorHandlingService.executeWithErrorHandling(mockOperation, context, fallbackValue);
            expect(result).toBe(fallbackValue);
            expect(mockOperation).toHaveBeenCalledTimes(1);
        });
        it('should retry failed operations', async () => {
            const mockOperation = jest.fn()
                .mockRejectedValueOnce(new Error('Network timeout'))
                .mockRejectedValueOnce(new Error('Network timeout'))
                .mockResolvedValue('success');
            const context = {
                component: 'TestComponent',
                operation: 'testOperation'
            };
            const result = await errorHandlingService.executeWithErrorHandling(mockOperation, context, undefined, ErrorHandler_1.ErrorCategory.NETWORK);
            expect(result).toBe('success');
            expect(mockOperation).toHaveBeenCalledTimes(3);
        });
        it('should use fallback data from error handler', async () => {
            const mockOperation = jest.fn().mockRejectedValue(new Error('not a git repository'));
            const context = {
                component: 'GitActivityMonitor',
                operation: 'getCommits'
            };
            const result = await errorHandlingService.executeWithErrorHandling(mockOperation, context);
            expect(result).toEqual({ gitCommits: [] });
        });
        it('should throw error when no fallback available', async () => {
            const mockOperation = jest.fn().mockRejectedValue(new Error('Unrecoverable error'));
            const context = {
                component: 'TestComponent',
                operation: 'testOperation'
            };
            await expect(errorHandlingService.executeWithErrorHandling(mockOperation, context)).rejects.toThrow('Unrecoverable error');
        });
    });
    describe('Execute with Timeout', () => {
        it('should execute operation within timeout', async () => {
            const mockOperation = jest.fn().mockResolvedValue('success');
            const context = {
                component: 'TestComponent',
                operation: 'testOperation'
            };
            const result = await errorHandlingService.executeWithTimeout(mockOperation, 1000, context);
            expect(result).toBe('success');
        });
        it('should handle timeout with fallback', async () => {
            const mockOperation = jest.fn().mockImplementation(() => new Promise(resolve => setTimeout(() => resolve('success'), 2000)));
            const context = {
                component: 'TestComponent',
                operation: 'testOperation'
            };
            const fallbackValue = 'timeout fallback';
            const result = await errorHandlingService.executeWithTimeout(mockOperation, 100, context, fallbackValue);
            expect(result).toBe(fallbackValue);
        });
    });
    describe('Logging Methods', () => {
        it('should handle warnings', () => {
            const context = {
                component: 'TestComponent',
                operation: 'testOperation'
            };
            errorHandlingService.handleWarning('TestComponent', 'Test warning', context);
            expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(expect.stringContaining('[WARN]'));
        });
        it('should log info with user notification', () => {
            errorHandlingService.logInfo('TestComponent', 'Test info', true);
            expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(expect.stringContaining('[INFO]'));
            expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('Test info');
        });
        it('should log debug information', () => {
            const testData = { key: 'value' };
            errorHandlingService.logDebug('TestComponent', 'Debug message', testData);
            expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(expect.stringContaining('[DEBUG]'));
        });
    });
    describe('Configuration', () => {
        it('should set log level', () => {
            errorHandlingService.setLogLevel(LoggingService_1.LogLevel.ERROR);
            expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(expect.stringContaining('Log level set to ERROR'));
        });
        it('should get telemetry summary', () => {
            // Generate some telemetry data
            errorHandlingService.logInfo('TestComponent', 'Test message');
            const summary = errorHandlingService.getTelemetrySummary();
            expect(summary).toHaveProperty('totalEvents');
            expect(summary).toHaveProperty('errorCount');
            expect(summary).toHaveProperty('componentBreakdown');
        });
        it('should show logs', () => {
            errorHandlingService.showLogs();
            expect(mockOutputChannel.show).toHaveBeenCalled();
        });
        it('should dispose properly', () => {
            errorHandlingService.dispose();
            // Should not throw any errors
        });
    });
    describe('Error Categorization', () => {
        it('should categorize storage errors by component', async () => {
            const error = new Error('Test error');
            const context = {
                component: 'SessionStorage',
                operation: 'testOperation'
            };
            const result = await errorHandlingService.handleError(error, context);
            expect(result.handled).toBe(true);
        });
        it('should categorize git errors by component', async () => {
            const error = new Error('Test error');
            const context = {
                component: 'GitActivityMonitor',
                operation: 'testOperation'
            };
            const result = await errorHandlingService.handleError(error, context);
            expect(result.handled).toBe(true);
        });
        it('should categorize errors by message content', async () => {
            const error = new Error('webview creation failed');
            const context = {
                component: 'TestComponent',
                operation: 'testOperation'
            };
            const result = await errorHandlingService.handleError(error, context);
            expect(result.handled).toBe(true);
        });
        it('should default to unknown category', async () => {
            const error = new Error('Unknown error type');
            const context = {
                component: 'UnknownComponent',
                operation: 'testOperation'
            };
            const result = await errorHandlingService.handleError(error, context);
            expect(result.handled).toBe(true);
        });
    });
});
//# sourceMappingURL=ErrorHandlingService.test.js.map