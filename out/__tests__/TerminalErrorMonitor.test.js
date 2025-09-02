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
const mockOutputChannel = {
    appendLine: jest.fn(),
    dispose: jest.fn()
};
jest.mock('vscode', () => ({
    window: {
        onDidOpenTerminal: jest.fn(),
        onDidCloseTerminal: jest.fn(),
        terminals: [],
        createOutputChannel: jest.fn(() => mockOutputChannel)
    },
}));
describe('TerminalErrorMonitor', () => {
    let terminalErrorMonitor;
    let mockTerminals;
    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();
        jest.useFakeTimers();
        // Mock terminal event handlers
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
        jest.useRealTimers();
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
    describe('Performance Optimizations', () => {
        let mockTerminal;
        let dataCallback;
        beforeEach(() => {
            mockTerminal = {
                name: 'Performance Test Terminal',
                onDidWriteData: jest.fn().mockReturnValue({ dispose: jest.fn() }),
            };
            const openCallback = vscode.window.onDidOpenTerminal.mock.calls[0][0];
            openCallback(mockTerminal);
            dataCallback = mockTerminal.onDidWriteData.mock.calls[0][0];
        });
        describe('Debouncing', () => {
            it('should debounce rapid terminal output', () => {
                const callback = jest.fn();
                terminalErrorMonitor.onTerminalError(callback);
                // Send rapid output
                dataCallback('Error: first error');
                dataCallback('Error: second error');
                dataCallback('Error: third error');
                // Should not process immediately due to debouncing
                expect(callback).not.toHaveBeenCalled();
                // Fast-forward past debounce delay
                jest.advanceTimersByTime(300);
                // Should process the most recent error
                expect(callback).toHaveBeenCalledTimes(1);
                expect(terminalErrorMonitor.getLastError()?.message).toBe('Error: third error');
            });
            it('should reset debounce timer on new input', () => {
                const callback = jest.fn();
                terminalErrorMonitor.onTerminalError(callback);
                // Send first error
                dataCallback('Error: first error');
                // Advance time partially
                jest.advanceTimersByTime(200);
                // Send second error (should reset timer)
                dataCallback('Error: second error');
                // Advance time partially again
                jest.advanceTimersByTime(200);
                // Should not have processed yet
                expect(callback).not.toHaveBeenCalled();
                // Complete the debounce delay
                jest.advanceTimersByTime(100);
                // Should process the second error
                expect(callback).toHaveBeenCalledTimes(1);
                expect(terminalErrorMonitor.getLastError()?.message).toBe('Error: second error');
            });
        });
        describe('Memory Management', () => {
            it('should limit buffer size to prevent memory issues', () => {
                const callback = jest.fn();
                terminalErrorMonitor.onTerminalError(callback);
                // Send many lines to exceed buffer limit
                const manyLines = Array.from({ length: 150 }, (_, i) => `Line ${i}: some output`).join('\n');
                dataCallback(manyLines);
                // Add an error at the end
                dataCallback('Error: final error');
                jest.advanceTimersByTime(300);
                // Should still detect the error despite buffer management
                expect(callback).toHaveBeenCalled();
                expect(terminalErrorMonitor.getLastError()?.message).toBe('Error: final error');
            });
            it('should truncate very long lines', () => {
                const callback = jest.fn();
                terminalErrorMonitor.onTerminalError(callback);
                // Create a very long line
                const longLine = 'Error: ' + 'x'.repeat(2000);
                dataCallback(longLine);
                jest.advanceTimersByTime(300);
                // Should not process lines that are too long
                expect(callback).not.toHaveBeenCalled();
            });
            it('should truncate very long data chunks', () => {
                const callback = jest.fn();
                terminalErrorMonitor.onTerminalError(callback);
                // Create very long data (>10KB)
                const longData = 'x'.repeat(15000) + '\nError: test error';
                dataCallback(longData);
                jest.advanceTimersByTime(300);
                // Should still work but with truncated data
                expect(callback).toHaveBeenCalled();
            });
        });
        describe('Cleanup Operations', () => {
            it('should perform periodic cleanup', () => {
                const callback = jest.fn();
                terminalErrorMonitor.onTerminalError(callback);
                // Add some data to buffers
                dataCallback('Some output\nError: test error');
                jest.advanceTimersByTime(300);
                // Fast-forward to trigger cleanup interval (2 minutes)
                jest.advanceTimersByTime(2 * 60 * 1000);
                // Cleanup should have occurred (buffers cleared)
                // We can't directly test internal state, but we can verify it doesn't crash
                expect(() => {
                    dataCallback('Error: after cleanup');
                    jest.advanceTimersByTime(300);
                }).not.toThrow();
            });
            it('should clean up stale debounce timers for non-existent terminals', () => {
                // Mock terminals array to simulate terminal removal
                vscode.window.terminals = [];
                // Add some data to create debounce timers
                dataCallback('Error: test error');
                // Fast-forward to trigger cleanup
                jest.advanceTimersByTime(2 * 60 * 1000);
                // Should not throw errors during cleanup
                expect(() => {
                    jest.advanceTimersByTime(300);
                }).not.toThrow();
            });
        });
        describe('Optimized Pattern Matching', () => {
            it('should use fast path for common error patterns', () => {
                const callback = jest.fn();
                terminalErrorMonitor.onTerminalError(callback);
                // Test common error keywords that should use fast path
                const commonErrors = [
                    'error: something failed',
                    'exception occurred',
                    'failed to execute',
                    'fatal: git error'
                ];
                commonErrors.forEach(errorText => {
                    dataCallback(errorText);
                    jest.advanceTimersByTime(300);
                });
                expect(callback).toHaveBeenCalledTimes(commonErrors.length);
            });
            it('should use fast path for common exclusion patterns', () => {
                const callback = jest.fn();
                terminalErrorMonitor.onTerminalError(callback);
                // Test common warning/info keywords that should be excluded via fast path
                const nonErrors = [
                    'warning: deprecated function',
                    'warn: package outdated',
                    'info: starting process',
                    'debug: connection established'
                ];
                nonErrors.forEach(text => {
                    dataCallback(text);
                    jest.advanceTimersByTime(300);
                });
                expect(callback).not.toHaveBeenCalled();
            });
        });
        describe('Performance Monitoring Integration', () => {
            it('should use performance monitoring for operations', () => {
                const callback = jest.fn();
                terminalErrorMonitor.onTerminalError(callback);
                // Process some terminal output
                dataCallback('Error: test error');
                jest.advanceTimersByTime(300);
                // Performance monitoring should be integrated (we can't easily test the exact calls
                // without exposing internal implementation, but we can verify the operation completes)
                expect(callback).toHaveBeenCalled();
            });
        });
        describe('Resource Cleanup on Dispose', () => {
            it('should clear all timers and buffers on dispose', () => {
                const callback = jest.fn();
                terminalErrorMonitor.onTerminalError(callback);
                // Create some pending operations
                dataCallback('Error: test error');
                // Dispose before debounce completes
                terminalErrorMonitor.dispose();
                // Fast-forward time - should not process anything after dispose
                jest.advanceTimersByTime(500);
                expect(callback).not.toHaveBeenCalled();
            });
            it('should clear cleanup interval on dispose', () => {
                const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
                terminalErrorMonitor.dispose();
                expect(clearIntervalSpy).toHaveBeenCalled();
            });
        });
    });
});
//# sourceMappingURL=TerminalErrorMonitor.test.js.map