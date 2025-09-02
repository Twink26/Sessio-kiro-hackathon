"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const PerformanceMonitor_1 = require("../services/PerformanceMonitor");
// Mock VS Code API
const mockOutputChannel = {
    appendLine: jest.fn(),
    dispose: jest.fn()
};
jest.mock('vscode', () => ({
    window: {
        createOutputChannel: jest.fn(() => mockOutputChannel)
    }
}));
describe('PerformanceMonitor', () => {
    let performanceMonitor;
    beforeEach(() => {
        jest.clearAllMocks();
        // Reset singleton instance
        PerformanceMonitor_1.PerformanceMonitor.instance = undefined;
        performanceMonitor = PerformanceMonitor_1.PerformanceMonitor.getInstance();
    });
    afterEach(() => {
        performanceMonitor.dispose();
    });
    describe('Singleton Pattern', () => {
        it('should return the same instance', () => {
            const instance1 = PerformanceMonitor_1.PerformanceMonitor.getInstance();
            const instance2 = PerformanceMonitor_1.PerformanceMonitor.getInstance();
            expect(instance1).toBe(instance2);
        });
    });
    describe('Timer Operations', () => {
        it('should start and end timer correctly', () => {
            const timer = performanceMonitor.startTimer('test-operation');
            // Simulate some work
            const start = performance.now();
            while (performance.now() - start < 10) {
                // Wait for at least 10ms
            }
            const duration = timer.end();
            expect(duration).toBeGreaterThan(0);
            expect(typeof duration).toBe('number');
        });
        it('should record metrics for operations', () => {
            const timer = performanceMonitor.startTimer('test-operation');
            timer.end();
            const metrics = performanceMonitor.getMetrics('test-operation');
            expect(metrics).toBeDefined();
            expect(metrics.operationName).toBe('test-operation');
            expect(metrics.totalCalls).toBe(1);
            expect(metrics.totalDuration).toBeGreaterThan(0);
            expect(metrics.averageDuration).toBeGreaterThan(0);
        });
        it('should accumulate metrics for multiple calls', () => {
            // First call
            const timer1 = performanceMonitor.startTimer('test-operation');
            timer1.end();
            // Second call
            const timer2 = performanceMonitor.startTimer('test-operation');
            timer2.end();
            const metrics = performanceMonitor.getMetrics('test-operation');
            expect(metrics.totalCalls).toBe(2);
            expect(metrics.averageDuration).toBe(metrics.totalDuration / 2);
        });
        it('should track min and max durations', () => {
            // Fast operation
            const timer1 = performanceMonitor.startTimer('test-operation');
            timer1.end();
            // Slower operation
            const timer2 = performanceMonitor.startTimer('test-operation');
            const start = performance.now();
            while (performance.now() - start < 20) {
                // Wait for at least 20ms
            }
            timer2.end();
            const metrics = performanceMonitor.getMetrics('test-operation');
            expect(metrics.maxDuration).toBeGreaterThan(metrics.minDuration);
        });
    });
    describe('Memory Monitoring', () => {
        it('should get current memory usage', () => {
            const memoryUsage = performanceMonitor.getCurrentMemoryUsage();
            expect(memoryUsage).toBeDefined();
            expect(typeof memoryUsage.heapUsed).toBe('number');
            expect(typeof memoryUsage.heapTotal).toBe('number');
            expect(typeof memoryUsage.rss).toBe('number');
        });
        it('should track memory delta in operations', () => {
            const timer = performanceMonitor.startTimer('memory-test');
            // Allocate some memory
            const largeArray = new Array(1000).fill('test');
            timer.end();
            const metrics = performanceMonitor.getMetrics('memory-test');
            expect(metrics).toBeDefined();
            expect(typeof metrics.totalMemoryDelta).toBe('number');
            expect(typeof metrics.averageMemoryDelta).toBe('number');
            // Clean up
            largeArray.length = 0;
        });
    });
    describe('Metrics Management', () => {
        it('should return all metrics', () => {
            const timer1 = performanceMonitor.startTimer('operation-1');
            timer1.end();
            const timer2 = performanceMonitor.startTimer('operation-2');
            timer2.end();
            const allMetrics = performanceMonitor.getAllMetrics();
            expect(allMetrics).toHaveLength(2);
            expect(allMetrics.map(m => m.operationName)).toContain('operation-1');
            expect(allMetrics.map(m => m.operationName)).toContain('operation-2');
        });
        it('should clear all metrics', () => {
            const timer = performanceMonitor.startTimer('test-operation');
            timer.end();
            expect(performanceMonitor.getAllMetrics()).toHaveLength(1);
            performanceMonitor.clearMetrics();
            expect(performanceMonitor.getAllMetrics()).toHaveLength(0);
        });
        it('should return undefined for non-existent metrics', () => {
            const metrics = performanceMonitor.getMetrics('non-existent');
            expect(metrics).toBeUndefined();
        });
    });
    describe('Performance Summary', () => {
        it('should log performance summary', () => {
            const timer = performanceMonitor.startTimer('test-operation');
            timer.end();
            performanceMonitor.logPerformanceSummary();
            expect(mockOutputChannel.appendLine).toHaveBeenCalledWith('\n=== Performance Summary ===');
            expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(expect.stringContaining('test-operation:'));
        });
        it('should handle empty metrics gracefully', () => {
            performanceMonitor.logPerformanceSummary();
            expect(mockOutputChannel.appendLine).toHaveBeenCalledWith('No performance metrics recorded');
        });
    });
    describe('Slow Operation Detection', () => {
        it('should log slow operations', () => {
            const timer = performanceMonitor.startTimer('slow-operation');
            // Simulate slow operation (> 100ms)
            const start = performance.now();
            while (performance.now() - start < 110) {
                // Wait for at least 110ms
            }
            timer.end();
            expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(expect.stringContaining('[SLOW] slow-operation:'));
        });
    });
    describe('Resource Cleanup', () => {
        it('should dispose resources properly', () => {
            performanceMonitor.dispose();
            expect(mockOutputChannel.dispose).toHaveBeenCalled();
        });
    });
});
//# sourceMappingURL=PerformanceMonitor.test.js.map