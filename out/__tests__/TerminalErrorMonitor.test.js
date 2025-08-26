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
const TerminalErrorMonitor_1 = require("../services/TerminalErrorMonitor");
// Mock VS Code API
jest.mock('vscode', () => ({
    window: {
        onDidOpenTerminal: jest.fn(),
        onDidCloseTerminal: jest.fn(),
        terminals: [],
    },
}));
describe('TerminalErrorMonitor', () => {
    let terminalErrorMonitor;
    let mockOnDidOpenTerminal;
    let mockOnDidCloseTerminal;
    let mockTerminals;
    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();
        // Mock terminal event handlers
        mockOnDidOpenTerminal = jest.fn();
        mockOnDidCloseTerminal = jest.fn();
        mockTerminals = [];
        // Mock disposable objects
        const mockDisposable = { dispose: jest.fn() };
        vscode.window.onDidOpenTerminal.mockReturnValue(mockDisposable);
        vscode.window.onDidCloseTerminal.mockReturnValue(mockDisposable);
        vscode.window.terminals = mockTerminals;
        // Create new instance
        terminalErrorMonitor = new TerminalErrorMonitor_1.TerminalErrorMonitor();
    });
    afterEach(() => {
        terminalErrorMonitor.dispose();
    });
    describe('initialization', () => {
        it('should set up terminal event listeners on initialization', () => {
            expect(vscode.window.onDidOpenTerminal).toHaveBeenCalled();
            expect(vscode.window.onDidCloseTerminal).toHaveBeenCalled();
        });
        it('should attach to existing terminals', () => {
            const mockTerminal = {
                name: 'Test Terminal',
                onDidWriteData: jest.fn().mockReturnValue({ dispose: jest.fn() }),
            };
            mockTerminals.push(mockTerminal);
            // Create new monitor to test existing terminal attachment
            const newMonitor = new TerminalErrorMonitor_1.TerminalErrorMonitor();
            // The constructor should have attempted to attach to existing terminals
            // Since we can't easily test the private method, we'll verify through behavior
            expect(mockTerminal.onDidWriteData).toHaveBeenCalled();
            newMonitor.dispose();
        });
    });
    describe('error detection patterns', () => {
        let mockTerminal;
        let dataCallback;
        beforeEach(() => {
            mockTerminal = {
                name: 'Test Terminal',
                onDidWriteData: jest.fn().mockReturnValue({ dispose: jest.fn() }),
            };
            // Simulate terminal attachment by calling the private method through public interface
            // We'll use the onDidOpenTerminal callback to trigger attachment
            const openCallback = vscode.window.onDidOpenTerminal.mock.calls[0][0];
            openCallback(mockTerminal);
            // Get the data callback that was registered
            dataCallback = mockTerminal.onDidWriteData.mock.calls[0][0];
        });
        const errorTestCases = [
            // Generic errors
            { input: 'Error: Something went wrong', expectedType: 'error' },
            { input: 'error: compilation failed', expectedType: 'failure' },
            { input: 'Exception: Invalid operation', expectedType: 'exception' },
            { input: 'Failed to build project', expectedType: 'failure' },
            // Programming language errors
            { input: 'SyntaxError: Unexpected token', expectedType: 'exception' },
            { input: 'TypeError: Cannot read property', expectedType: 'exception' },
            { input: 'ReferenceError: variable is not defined', expectedType: 'exception' },
            // Build tool errors
            { input: 'Build failed with 3 errors', expectedType: 'failure' },
            { input: 'Compilation failed', expectedType: 'failure' },
            { input: 'Test failed: assertion error', expectedType: 'failure' },
            // Package manager errors
            { input: 'npm ERR! Package not found', expectedType: 'error' },
            { input: 'yarn error: Network timeout', expectedType: 'error' },
            { input: 'pnpm ERR: Invalid package', expectedType: 'error' },
            // Git errors
            { input: 'fatal: not a git repository', expectedType: 'error' },
            { input: 'git error: merge conflict', expectedType: 'error' },
            // Command line errors
            { input: 'command not found: invalidcmd', expectedType: 'error' },
            { input: 'permission denied: /etc/hosts', expectedType: 'error' },
            { input: 'no such file or directory: missing.txt', expectedType: 'error' },
            // Exit codes
            { input: 'Process exited with code 1', expectedType: 'error' },
            { input: 'Command failed with exit code 2', expectedType: 'failure' },
        ];
        errorTestCases.forEach(({ input, expectedType }) => {
            it(`should detect "${input}" as ${expectedType}`, () => {
                const callback = jest.fn();
                terminalErrorMonitor.onTerminalError(callback);
                dataCallback(input);
                expect(callback).toHaveBeenCalledWith(expect.objectContaining({
                    message: input,
                    terminalName: 'Test Terminal',
                    errorType: expectedType,
                    timestamp: expect.any(Date),
                }));
                const lastError = terminalErrorMonitor.getLastError();
                expect(lastError).toMatchObject({
                    message: input,
                    terminalName: 'Test Terminal',
                    errorType: expectedType,
                });
            });
        });
        const nonErrorTestCases = [
            'warning: deprecated function used',
            'warn: package outdated',
            'info: starting server',
            'debug: connection established',
            'deprecated: old API usage',
            'notice: update available',
            'Installing packages...',
            'Build completed successfully',
            'All tests passed',
            '',
            '   ',
        ];
        nonErrorTestCases.forEach(input => {
            it(`should not detect "${input}" as an error`, () => {
                const callback = jest.fn();
                terminalErrorMonitor.onTerminalError(callback);
                dataCallback(input);
                expect(callback).not.toHaveBeenCalled();
                expect(terminalErrorMonitor.getLastError()).toBeNull();
            });
        });
    });
    describe('multiline output processing', () => {
        let mockTerminal;
        let dataCallback;
        beforeEach(() => {
            mockTerminal = {
                name: 'Test Terminal',
                onDidWriteData: jest.fn().mockReturnValue({ dispose: jest.fn() }),
            };
            const openCallback = vscode.window.onDidOpenTerminal.mock.calls[0][0];
            openCallback(mockTerminal);
            dataCallback = mockTerminal.onDidWriteData.mock.calls[0][0];
        });
        it('should process multiple lines and detect errors in each', () => {
            const callback = jest.fn();
            terminalErrorMonitor.onTerminalError(callback);
            const multilineOutput = 'Starting build...\nError: compilation failed\nwarning: deprecated API\nTest failed: assertion error';
            dataCallback(multilineOutput);
            // Should detect the last error (most recent)
            expect(callback).toHaveBeenCalledTimes(2); // Two errors detected
            const lastError = terminalErrorMonitor.getLastError();
            expect(lastError?.message).toBe('Test failed: assertion error');
            expect(lastError?.errorType).toBe('failure');
        });
        it('should handle different line endings', () => {
            const callback = jest.fn();
            terminalErrorMonitor.onTerminalError(callback);
            // Test with \r\n line endings
            const windowsOutput = 'Starting...\r\nError: something failed\r\nDone.';
            dataCallback(windowsOutput);
            expect(callback).toHaveBeenCalledWith(expect.objectContaining({
                message: 'Error: something failed',
            }));
        });
        it('should only keep the most recent error', () => {
            const callback = jest.fn();
            terminalErrorMonitor.onTerminalError(callback);
            // First error
            dataCallback('Error: first error');
            expect(terminalErrorMonitor.getLastError()?.message).toBe('Error: first error');
            // Second error should replace the first
            dataCallback('Error: second error');
            expect(terminalErrorMonitor.getLastError()?.message).toBe('Error: second error');
            // Callback should have been called twice
            expect(callback).toHaveBeenCalledTimes(2);
        });
    });
    describe('callback management', () => {
        let mockTerminal;
        let dataCallback;
        beforeEach(() => {
            mockTerminal = {
                name: 'Test Terminal',
                onDidWriteData: jest.fn().mockReturnValue({ dispose: jest.fn() }),
            };
            const openCallback = vscode.window.onDidOpenTerminal.mock.calls[0][0];
            openCallback(mockTerminal);
            dataCallback = mockTerminal.onDidWriteData.mock.calls[0][0];
        });
        it('should call all registered callbacks when error occurs', () => {
            const callback1 = jest.fn();
            const callback2 = jest.fn();
            const callback3 = jest.fn();
            terminalErrorMonitor.onTerminalError(callback1);
            terminalErrorMonitor.onTerminalError(callback2);
            terminalErrorMonitor.onTerminalError(callback3);
            dataCallback('Error: test error');
            expect(callback1).toHaveBeenCalled();
            expect(callback2).toHaveBeenCalled();
            expect(callback3).toHaveBeenCalled();
            // All should receive the same error object
            const expectedError = expect.objectContaining({
                message: 'Error: test error',
                terminalName: 'Test Terminal',
                errorType: 'error',
            });
            expect(callback1).toHaveBeenCalledWith(expectedError);
            expect(callback2).toHaveBeenCalledWith(expectedError);
            expect(callback3).toHaveBeenCalledWith(expectedError);
        });
        it('should handle callback errors gracefully', () => {
            const errorCallback = jest.fn(() => {
                throw new Error('Callback error');
            });
            const normalCallback = jest.fn();
            terminalErrorMonitor.onTerminalError(errorCallback);
            terminalErrorMonitor.onTerminalError(normalCallback);
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
            dataCallback('Error: test error');
            expect(consoleSpy).toHaveBeenCalledWith('Error in terminal error callback:', expect.any(Error));
            expect(normalCallback).toHaveBeenCalled();
            consoleSpy.mockRestore();
        });
    });
    describe('terminal lifecycle management', () => {
        it('should handle terminal opening', () => {
            const mockTerminal = {
                name: 'New Terminal',
                onDidWriteData: jest.fn().mockReturnValue({ dispose: jest.fn() }),
            };
            const openCallback = vscode.window.onDidOpenTerminal.mock.calls[0][0];
            openCallback(mockTerminal);
            expect(mockTerminal.onDidWriteData).toHaveBeenCalled();
        });
        it('should handle terminal closing', () => {
            const mockTerminal = {
                name: 'Closing Terminal',
                onDidWriteData: jest.fn().mockReturnValue({ dispose: jest.fn() }),
            };
            // Open terminal first
            const openCallback = vscode.window.onDidOpenTerminal.mock.calls[0][0];
            openCallback(mockTerminal);
            const mockListener = mockTerminal.onDidWriteData.mock.results[0].value;
            // Close terminal
            const closeCallback = vscode.window.onDidCloseTerminal.mock.calls[0][0];
            closeCallback(mockTerminal);
            expect(mockListener.dispose).toHaveBeenCalled();
        });
        it('should not attach duplicate listeners to the same terminal', () => {
            const mockTerminal = {
                name: 'Duplicate Terminal',
                onDidWriteData: jest.fn().mockReturnValue({ dispose: jest.fn() }),
            };
            const openCallback = vscode.window.onDidOpenTerminal.mock.calls[0][0];
            // Try to attach to the same terminal multiple times
            openCallback(mockTerminal);
            openCallback(mockTerminal);
            openCallback(mockTerminal);
            // Should only attach once
            expect(mockTerminal.onDidWriteData).toHaveBeenCalledTimes(1);
        });
    });
    describe('terminal without onDidWriteData support', () => {
        it('should handle terminals without onDidWriteData gracefully', () => {
            const mockTerminal = {
                name: 'Legacy Terminal',
                // No onDidWriteData method
            };
            const openCallback = vscode.window.onDidOpenTerminal.mock.calls[0][0];
            // Should not throw an error
            expect(() => openCallback(mockTerminal)).not.toThrow();
        });
    });
    describe('reset functionality', () => {
        it('should clear the last error when reset', () => {
            const mockTerminal = {
                name: 'Test Terminal',
                onDidWriteData: jest.fn().mockReturnValue({ dispose: jest.fn() }),
            };
            const openCallback = vscode.window.onDidOpenTerminal.mock.calls[0][0];
            openCallback(mockTerminal);
            const dataCallback = mockTerminal.onDidWriteData.mock.calls[0][0];
            // Generate an error
            dataCallback('Error: test error');
            expect(terminalErrorMonitor.getLastError()).not.toBeNull();
            // Reset should clear the error
            terminalErrorMonitor.reset();
            expect(terminalErrorMonitor.getLastError()).toBeNull();
        });
    });
    describe('getLastError', () => {
        it('should return null when no errors have occurred', () => {
            expect(terminalErrorMonitor.getLastError()).toBeNull();
        });
        it('should return the most recent error', () => {
            const mockTerminal = {
                name: 'Test Terminal',
                onDidWriteData: jest.fn().mockReturnValue({ dispose: jest.fn() }),
            };
            const openCallback = vscode.window.onDidOpenTerminal.mock.calls[0][0];
            openCallback(mockTerminal);
            const dataCallback = mockTerminal.onDidWriteData.mock.calls[0][0];
            dataCallback('Error: test error');
            const lastError = terminalErrorMonitor.getLastError();
            expect(lastError).toMatchObject({
                message: 'Error: test error',
                terminalName: 'Test Terminal',
                errorType: 'error',
                timestamp: expect.any(Date),
            });
        });
    });
    describe('disposal', () => {
        it('should dispose of all event listeners and terminal listeners', () => {
            const mockTerminal = {
                name: 'Test Terminal',
                onDidWriteData: jest.fn().mockReturnValue({ dispose: jest.fn() }),
            };
            const openCallback = vscode.window.onDidOpenTerminal.mock.calls[0][0];
            openCallback(mockTerminal);
            const mockListener = mockTerminal.onDidWriteData.mock.results[0].value;
            terminalErrorMonitor.dispose();
            expect(mockListener.dispose).toHaveBeenCalled();
        });
        it('should handle multiple dispose calls gracefully', () => {
            terminalErrorMonitor.dispose();
            // Should not throw an error
            expect(() => terminalErrorMonitor.dispose()).not.toThrow();
        });
    });
});
//# sourceMappingURL=TerminalErrorMonitor.test.js.map