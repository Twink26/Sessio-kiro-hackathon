"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const PerformanceOptimizer_1 = require("../services/PerformanceOptimizer");
// Mock VS Code API
const mockOutputChannel = {
    appendLine: jest.fn(),
    dispose: jest.fn()
};
const mockWorkspaceConfig = {
    get: jest.fn(),
    update: jest.fn(),
    has: jest.fn(),
    inspect: jest.fn()
};
jest.mock('vscode', () => ({
    window: {
        createOutputChannel: jest.fn(() => mockOutputChannel)
    },
    workspace: {
        getConfiguration: jest.fn(() => mockWorkspaceConfig)
    }
}));
// Mock global gc function
const mockGc = jest.fn();
global.gc = mockGc;
describe('PerformanceOptimizer', () => {
    let performanceOptimizer;
    let originalConsoleLog;
    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
        // Mock console.log to avoid test output noise
        originalConsoleLog = console.log;
        console.log = jest.fn();
        // Reset singleton instance
        PerformanceOptimizer_1.PerformanceOptimizer.instance = undefined;
        performanceOptimizer = PerformanceOptimizer_1.PerformanceOptimizer.getInstance();
    });
    afterEach(() => {
        performanceOptimizer.dispose();
        jest.useRealTimers();
        console.log = originalConsoleLog;
    });
    describe('Singleton Pattern', () => {
        it('should return the same instance', () => {
            const instance1 = PerformanceOptimizer_1.PerformanceOptimizer.getInstance();
            const instance2 = PerformanceOptimizer_1.PerformanceOptimizer.getInstance();
            expect(instance1).toBe(instance2);
        });
    });
    describe('Memory Cleanup', () => {
        it('should perform memory cleanup on interval', () => {
            // Fast-forward time to trigger cleanup
            jest.advanceTimersByTime(10 * 60 * 1000 + 1000); // 10 minutes + 1 second
            expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Memory cleanup - Heap used:'));
        });
        it('should suggest garbage collection for high memory usage', () => {
            // Mock high memory usage
            const originalMemoryUsage = process.memoryUsage;
            process.memoryUsage = jest.fn(() => ({
                rss: 200 * 1024 * 1024,
                heapTotal: 150 * 1024 * 1024,
                heapUsed: 120 * 1024 * 1024,
                external: 10 * 1024 * 1024,
                arrayBuffers: 5 * 1024 * 1024
            }));
            try {
                // Trigger cleanup
                jest.advanceTimersByTime(10 * 60 * 1000 + 1000);
                expect(mockGc).toHaveBeenCalled();
                expect(console.log).toHaveBeenCalledWith('Suggesting garbage collection due to high memory usage');
            }
            finally {
                process.memoryUsage = originalMemoryUsage;
            }
        });
        it('should respect garbage collection cooldown', () => {
            // Mock high memory usage
            const originalMemoryUsage = process.memoryUsage;
            process.memoryUsage = jest.fn(() => ({
                rss: 200 * 1024 * 1024,
                heapTotal: 150 * 1024 * 1024,
                heapUsed: 120 * 1024 * 1024,
                external: 10 * 1024 * 1024,
                arrayBuffers: 5 * 1024 * 1024
            }));
            try {
                // First cleanup - should trigger GC
                jest.advanceTimersByTime(10 * 60 * 1000);
                expect(mockGc).toHaveBeenCalledTimes(1);
                // Second cleanup within cooldown - should not trigger GC
                jest.advanceTimersByTime(10 * 60 * 1000);
                expect(mockGc).toHaveBeenCalledTimes(1); // Still 1
                // Third cleanup after cooldown - should trigger GC again
                jest.advanceTimersByTime(5 * 60 * 1000); // Complete the cooldown
                jest.advanceTimersByTime(10 * 60 * 1000);
                expect(mockGc).toHaveBeenCalledTimes(2);
            }
            finally {
                process.memoryUsage = originalMemoryUsage;
            }
        });
    });
    describe('Performance Reporting', () => {
        it('should generate performance report on interval', () => {
            // Fast-forward time to trigger report
            jest.advanceTimersByTime(30 * 60 * 1000 + 1000); // 30 minutes + 1 second
            expect(console.log).toHaveBeenCalledWith('=== Performance Optimization Report ===');
            expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Memory Usage:'));
        });
        it('should identify slow operations in report', () => {
            // Add some slow operations to the performance monitor
            const performanceMonitor = performanceOptimizer.performanceMonitor;
            // Mock metrics with slow operations
            const mockMetrics = [
                {
                    operationName: 'slow-operation',
                    totalCalls: 10,
                    averageDuration: 150,
                    averageMemoryDelta: 1024
                },
                {
                    operationName: 'fast-operation',
                    totalCalls: 100,
                    averageDuration: 10,
                    averageMemoryDelta: 512
                }
            ];
            performanceMonitor.getAllMetrics = jest.fn(() => mockMetrics);
            // Trigger report
            jest.advanceTimersByTime(30 * 60 * 1000);
            expect(console.log).toHaveBeenCalledWith('\nSlow Operations (>50ms average):');
            expect(console.log).toHaveBeenCalledWith(expect.stringContaining('slow-operation: 150.00ms avg'));
        });
        it('should identify memory-intensive operations', () => {
            const performanceMonitor = performanceOptimizer.performanceMonitor;
            // Mock metrics with memory-intensive operations
            const mockMetrics = [
                {
                    operationName: 'memory-intensive',
                    totalCalls: 5,
                    averageDuration: 50,
                    averageMemoryDelta: 2 * 1024 * 1024 // 2MB
                },
                {
                    operationName: 'memory-light',
                    totalCalls: 100,
                    averageDuration: 10,
                    averageMemoryDelta: 1024 // 1KB
                }
            ];
            performanceMonitor.getAllMetrics = jest.fn(() => mockMetrics);
            // Trigger report
            jest.advanceTimersByTime(30 * 60 * 1000);
            expect(console.log).toHaveBeenCalledWith('\nMemory-Intensive Operations (>1MB average):');
            expect(console.log).toHaveBeenCalledWith(expect.stringContaining('memory-intensive: 2.00MB avg'));
        });
    });
    describe('Optimization Recommendations', () => {
        it('should recommend memory reduction for high usage', () => {
            // Mock high memory usage
            const originalMemoryUsage = process.memoryUsage;
            process.memoryUsage = jest.fn(() => ({
                rss: 100 * 1024 * 1024,
                heapTotal: 80 * 1024 * 1024,
                heapUsed: 60 * 1024 * 1024,
                external: 5 * 1024 * 1024,
                arrayBuffers: 2 * 1024 * 1024
            }));
            const performanceMonitor = performanceOptimizer.performanceMonitor;
            performanceMonitor.getAllMetrics = jest.fn(() => []);
            try {
                jest.advanceTimersByTime(30 * 60 * 1000);
                expect(console.log).toHaveBeenCalledWith('\nOptimization Recommendations:');
                expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Consider reducing memory usage - currently above 50MB threshold'));
            }
            finally {
                process.memoryUsage = originalMemoryUsage;
            }
        });
        it('should recommend optimization for very slow operations', () => {
            const performanceMonitor = performanceOptimizer.performanceMonitor;
            const mockMetrics = [
                {
                    operationName: 'very-slow-operation',
                    totalCalls: 10,
                    averageDuration: 150,
                    averageMemoryDelta: 1024
                }
            ];
            performanceMonitor.getAllMetrics = jest.fn(() => mockMetrics);
            jest.advanceTimersByTime(30 * 60 * 1000);
            expect(console.log).toHaveBeenCalledWith(expect.stringContaining('operations are very slow (>100ms) - consider optimization'));
        });
        it('should recommend caching for frequent operations', () => {
            const performanceMonitor = performanceOptimizer.performanceMonitor;
            const mockMetrics = [
                {
                    operationName: 'frequent-operation',
                    totalCalls: 1500,
                    averageDuration: 10,
                    averageMemoryDelta: 1024
                }
            ];
            performanceMonitor.getAllMetrics = jest.fn(() => mockMetrics);
            jest.advanceTimersByTime(30 * 60 * 1000);
            expect(console.log).toHaveBeenCalledWith(expect.stringContaining('operations called very frequently (>1000 times) - consider caching'));
        });
    });
    describe('File Watching Optimization', () => {
        it('should optimize file watching configuration', () => {
            const config = performanceOptimizer.optimizeFileWatching();
            expect(config).toBeDefined();
            expect(console.log).toHaveBeenCalledWith('Applied file watching optimizations');
        });
    });
    describe('Performance Status', () => {
        it('should return current performance status', () => {
            const performanceMonitor = performanceOptimizer.performanceMonitor;
            performanceMonitor.getAllMetrics = jest.fn(() => [
                { averageDuration: 30, averageMemoryDelta: 1024 },
                { averageDuration: 80, averageMemoryDelta: 2 * 1024 * 1024 }
            ]);
            const status = performanceOptimizer.getPerformanceStatus();
            expect(status).toHaveProperty('memoryUsage');
            expect(status).toHaveProperty('operationCount', 2);
            expect(status).toHaveProperty('slowOperations', 1);
            expect(status).toHaveProperty('memoryIntensiveOperations', 1);
            expect(status).toHaveProperty('isHealthy');
        });
        it('should correctly identify healthy status', () => {
            // Mock low memory usage
            const originalMemoryUsage = process.memoryUsage;
            process.memoryUsage = jest.fn(() => ({
                rss: 30 * 1024 * 1024,
                heapTotal: 25 * 1024 * 1024,
                heapUsed: 20 * 1024 * 1024,
                external: 2 * 1024 * 1024,
                arrayBuffers: 1 * 1024 * 1024
            }));
            const performanceMonitor = performanceOptimizer.performanceMonitor;
            performanceMonitor.getAllMetrics = jest.fn(() => [
                { averageDuration: 30, averageMemoryDelta: 1024 },
                { averageDuration: 50, averageMemoryDelta: 2048 } // Moderately fast
            ]);
            try {
                const status = performanceOptimizer.getPerformanceStatus();
                expect(status.isHealthy).toBe(true);
            }
            finally {
                process.memoryUsage = originalMemoryUsage;
            }
        });
    });
    describe('Force Cleanup', () => {
        it('should force cleanup of all cached data', () => {
            const performanceMonitor = performanceOptimizer.performanceMonitor;
            performanceMonitor.clearMetrics = jest.fn();
            performanceOptimizer.forceCleanup();
            expect(console.log).toHaveBeenCalledWith('Forcing cleanup of all cached data...');
            expect(console.log).toHaveBeenCalledWith('Forced cleanup completed');
            expect(performanceMonitor.clearMetrics).toHaveBeenCalled();
        });
    });
    describe('Resource Cleanup', () => {
        it('should dispose resources properly', () => {
            performanceOptimizer.dispose();
            expect(console.log).toHaveBeenCalledWith('PerformanceOptimizer disposed');
        });
        it('should clear intervals on dispose', () => {
            const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
            performanceOptimizer.dispose();
            expect(clearIntervalSpy).toHaveBeenCalledTimes(2); // Memory cleanup + performance report intervals
        });
    });
});
//# sourceMappingURL=PerformanceOptimizer.test.js.map