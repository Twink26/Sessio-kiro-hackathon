import * as vscode from 'vscode';
import { LoggingService, LogLevel, TelemetryData, ErrorContext } from '../services/LoggingService';

// Mock VS Code API
jest.mock('vscode', () => ({
    OutputChannel: jest.fn()
}));

describe('LoggingService', () => {
    let loggingService: LoggingService;
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

        loggingService = new LoggingService(mockOutputChannel, LogLevel.DEBUG);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('Log Level Management', () => {
        it('should set log level correctly', () => {
            loggingService.setLogLevel(LogLevel.ERROR);
            
            // Should log the level change
            expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
                expect.stringContaining('Log level set to ERROR')
            );
        });

        it('should respect log level filtering', () => {
            loggingService.setLogLevel(LogLevel.ERROR);
            
            // Clear previous calls
            mockOutputChannel.appendLine.mockClear();
            
            // These should not log
            loggingService.warn('Test', 'Warning message');
            loggingService.info('Test', 'Info message');
            loggingService.debug('Test', 'Debug message');
            
            expect(mockOutputChannel.appendLine).not.toHaveBeenCalled();
            
            // This should log
            loggingService.error('Test', 'Error message');
            expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
                expect.stringContaining('[ERROR]')
            );
        });
    });

    describe('Error Logging', () => {
        it('should log error with context', () => {
            const error = new Error('Test error');
            const context: ErrorContext = {
                component: 'TestComponent',
                operation: 'testOperation',
                sessionId: 'test-session'
            };

            loggingService.error('TestService', 'Operation failed', error, context);

            expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
                expect.stringMatching(/\[ERROR\].*\[TestService\].*Operation failed: Test error/)
            );
        });

        it('should log error without Error object', () => {
            loggingService.error('TestService', 'Simple error message');

            expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
                expect.stringMatching(/\[ERROR\].*\[TestService\].*Simple error message/)
            );
        });

        it('should collect telemetry for errors', () => {
            const error = new Error('Test error');
            loggingService.error('TestService', 'Operation failed', error);

            const telemetry = loggingService.getTelemetryData();
            expect(telemetry).toHaveLength(1);
            expect(telemetry[0].event).toBe('error');
            expect(telemetry[0].properties?.component).toBe('TestService');
        });
    });

    describe('Warning Logging', () => {
        it('should log warning message', () => {
            loggingService.warn('TestService', 'Warning message');

            expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
                expect.stringMatching(/\[WARN\].*\[TestService\].*Warning message/)
            );
        });

        it('should collect telemetry for warnings', () => {
            loggingService.warn('TestService', 'Warning message');

            const telemetry = loggingService.getTelemetryData();
            expect(telemetry).toHaveLength(1);
            expect(telemetry[0].event).toBe('warning');
        });
    });

    describe('Info Logging', () => {
        it('should log info message', () => {
            loggingService.info('TestService', 'Info message');

            expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
                expect.stringMatching(/\[INFO\].*\[TestService\].*Info message/)
            );
        });
    });

    describe('Debug Logging', () => {
        it('should log debug message with data', () => {
            const testData = { key: 'value', number: 42 };
            loggingService.debug('TestService', 'Debug message', testData);

            expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
                expect.stringMatching(/\[DEBUG\].*\[TestService\].*Debug message/)
            );
            expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
                expect.stringContaining(JSON.stringify(testData, null, 2))
            );
        });
    });

    describe('Performance Logging', () => {
        it('should log performance metrics', () => {
            loggingService.performance('TestService', 'testOperation', 150);

            expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
                expect.stringMatching(/\[INFO\].*\[TestService\].*testOperation completed in 150ms/)
            );
        });

        it('should collect performance telemetry', () => {
            loggingService.performance('TestService', 'testOperation', 150);

            const telemetry = loggingService.getTelemetryData();
            expect(telemetry).toHaveLength(1);
            expect(telemetry[0].event).toBe('performance');
            expect(telemetry[0].measurements?.duration).toBe(150);
        });
    });

    describe('Telemetry Management', () => {
        it('should collect and retrieve telemetry data', () => {
            loggingService.error('Service1', 'Error 1');
            loggingService.warn('Service2', 'Warning 1');
            loggingService.performance('Service3', 'operation1', 100);

            const telemetry = loggingService.getTelemetryData();
            expect(telemetry).toHaveLength(3);
        });

        it('should limit telemetry data size', () => {
            // Add more than the limit (1000 entries)
            for (let i = 0; i < 1100; i++) {
                loggingService.error('TestService', `Error ${i}`);
            }

            const telemetry = loggingService.getTelemetryData();
            expect(telemetry.length).toBeLessThanOrEqual(1000);
        });

        it('should clear telemetry data', () => {
            loggingService.error('TestService', 'Error message');
            expect(loggingService.getTelemetryData()).toHaveLength(1);

            loggingService.clearTelemetryData();
            expect(loggingService.getTelemetryData()).toHaveLength(0);
        });

        it('should generate telemetry summary', () => {
            loggingService.error('Service1', 'Error 1');
            loggingService.error('Service1', 'Error 2');
            loggingService.warn('Service2', 'Warning 1');
            loggingService.performance('Service1', 'operation1', 100);
            loggingService.performance('Service1', 'operation1', 200);

            const summary = loggingService.getTelemetrySummary();
            
            expect(summary.totalEvents).toBe(5);
            expect(summary.errorCount).toBe(2);
            expect(summary.warningCount).toBe(1);
            expect(summary.performanceEvents).toBe(2);
            expect(summary.componentBreakdown['Service1']).toBe(4);
            expect(summary.componentBreakdown['Service2']).toBe(1);
            expect(summary.averagePerformance['operation1']).toBe(150);
        });
    });

    describe('Service Management', () => {
        it('should show output channel', () => {
            loggingService.show();
            expect(mockOutputChannel.show).toHaveBeenCalled();
        });

        it('should dispose properly', () => {
            loggingService.error('TestService', 'Error before dispose');
            expect(loggingService.getTelemetryData()).toHaveLength(1);

            loggingService.dispose();
            expect(loggingService.getTelemetryData()).toHaveLength(0);
        });
    });
});