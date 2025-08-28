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
const AISummaryService_1 = require("../services/AISummaryService");
// Mock VS Code API
jest.mock('vscode', () => ({
    workspace: {
        getConfiguration: jest.fn()
    },
    OutputChannel: jest.fn()
}));
// Mock fetch for OpenAI API calls
global.fetch = jest.fn();
describe('AISummaryService', () => {
    let service;
    let mockOutputChannel;
    let mockConfig;
    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();
        // Mock output channel
        mockOutputChannel = {
            appendLine: jest.fn(),
            append: jest.fn(),
            replace: jest.fn(),
            clear: jest.fn(),
            show: jest.fn(),
            hide: jest.fn(),
            dispose: jest.fn(),
            name: 'test'
        };
        // Mock configuration
        mockConfig = jest.fn();
        vscode.workspace.getConfiguration.mockReturnValue({
            get: mockConfig
        });
        // Default configuration
        mockConfig.mockImplementation((key, defaultValue) => {
            const config = {
                'aiProvider': 'disabled',
                'openaiApiKey': '',
                'aiMaxTokens': 150,
                'aiTemperature': 0.7
            };
            return config[key] ?? defaultValue;
        });
        service = new AISummaryService_1.AISummaryService(mockOutputChannel);
    });
    describe('constructor', () => {
        it('should initialize with configuration from VS Code settings', () => {
            expect(vscode.workspace.getConfiguration).toHaveBeenCalledWith('sessionRecap');
            expect(service.getCurrentProvider()).toBe('disabled');
        });
    });
    describe('isAvailable', () => {
        it('should return false when provider is disabled', () => {
            expect(service.isAvailable()).toBe(false);
        });
        it('should return false when OpenAI provider has no API key', () => {
            service.updateConfig({ provider: 'openai' });
            expect(service.isAvailable()).toBe(false);
        });
        it('should return true when OpenAI provider has API key', () => {
            service.updateConfig({ provider: 'openai', apiKey: 'test-key' });
            expect(service.isAvailable()).toBe(true);
        });
        it('should return true when local provider is selected', () => {
            service.updateConfig({ provider: 'local' });
            expect(service.isAvailable()).toBe(true);
        });
    });
    describe('updateConfig', () => {
        it('should update configuration', () => {
            service.updateConfig({ provider: 'openai', apiKey: 'new-key' });
            expect(service.getCurrentProvider()).toBe('openai');
        });
        it('should merge with existing configuration', () => {
            service.updateConfig({ provider: 'openai' });
            service.updateConfig({ provider: 'openai', apiKey: 'test-key' });
            expect(service.getCurrentProvider()).toBe('openai');
            expect(service.isAvailable()).toBe(true);
        });
    });
    describe('generateSummary', () => {
        const mockSessionData = {
            sessionId: 'test-session',
            startTime: new Date('2023-01-01T10:00:00Z'),
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
                    message: 'Add new feature',
                    author: 'Test User',
                    timestamp: new Date('2023-01-01T11:00:00Z'),
                    filesChanged: ['/test/file1.ts']
                }
            ],
            terminalErrors: [
                {
                    message: 'TypeError: Cannot read property',
                    timestamp: new Date('2023-01-01T10:45:00Z'),
                    terminalName: 'Terminal 1',
                    errorType: 'error'
                }
            ]
        };
        it('should throw error when service is not available', async () => {
            await expect(service.generateSummary(mockSessionData))
                .rejects.toThrow('AI summary service is not available or disabled');
        });
        it('should generate OpenAI summary successfully', async () => {
            service.updateConfig({ provider: 'openai', apiKey: 'test-key' });
            const mockResponse = {
                ok: true,
                json: jest.fn().mockResolvedValue({
                    choices: [
                        {
                            message: {
                                content: 'You modified 1 file, made 1 commit, and encountered a TypeError.'
                            }
                        }
                    ]
                })
            };
            global.fetch.mockResolvedValue(mockResponse);
            const result = await service.generateSummary(mockSessionData);
            expect(result).toBe('You modified 1 file, made 1 commit, and encountered a TypeError.');
            expect(global.fetch).toHaveBeenCalledWith('https://api.openai.com/v1/chat/completions', expect.objectContaining({
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer test-key'
                }
            }));
        });
        it('should handle OpenAI API errors', async () => {
            service.updateConfig({ provider: 'openai', apiKey: 'test-key' });
            const mockResponse = {
                ok: false,
                status: 401,
                statusText: 'Unauthorized'
            };
            global.fetch.mockResolvedValue(mockResponse);
            await expect(service.generateSummary(mockSessionData))
                .rejects.toThrow('Failed to generate OpenAI summary');
            expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(expect.stringContaining('OpenAI API Error'));
        });
        it('should handle OpenAI API network errors', async () => {
            service.updateConfig({ provider: 'openai', apiKey: 'test-key' });
            global.fetch.mockRejectedValue(new Error('Network error'));
            await expect(service.generateSummary(mockSessionData))
                .rejects.toThrow('Failed to generate OpenAI summary');
        });
        it('should handle empty OpenAI response', async () => {
            service.updateConfig({ provider: 'openai', apiKey: 'test-key' });
            const mockResponse = {
                ok: true,
                json: jest.fn().mockResolvedValue({
                    choices: []
                })
            };
            global.fetch.mockResolvedValue(mockResponse);
            await expect(service.generateSummary(mockSessionData))
                .rejects.toThrow('Failed to generate OpenAI summary');
        });
        it('should generate local AI summary', async () => {
            service.updateConfig({ provider: 'local' });
            const result = await service.generateSummary(mockSessionData);
            expect(result).toContain('[Local AI]');
            expect(result).toContain('Modified 1 file');
        });
        it('should log errors to output channel', async () => {
            service.updateConfig({ provider: 'openai', apiKey: 'test-key' });
            global.fetch.mockRejectedValue(new Error('Test error'));
            await expect(service.generateSummary(mockSessionData))
                .rejects.toThrow();
            expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(expect.stringContaining('AI Summary Error'));
        });
    });
    describe('generateFallbackSummary', () => {
        it('should generate summary with files only', () => {
            const sessionData = {
                sessionId: 'test',
                startTime: new Date(),
                editedFiles: [
                    { filePath: '/test.ts', timestamp: new Date(), changeType: 'modified' }
                ],
                gitCommits: [],
                terminalErrors: []
            };
            const result = service.generateFallbackSummary(sessionData);
            expect(result).toBe('In your last session, you Modified 1 file.');
        });
        it('should generate summary with multiple files', () => {
            const sessionData = {
                sessionId: 'test',
                startTime: new Date(),
                editedFiles: [
                    { filePath: '/test1.ts', timestamp: new Date(), changeType: 'modified' },
                    { filePath: '/test2.ts', timestamp: new Date(), changeType: 'created' }
                ],
                gitCommits: [],
                terminalErrors: []
            };
            const result = service.generateFallbackSummary(sessionData);
            expect(result).toBe('In your last session, you Modified 2 files.');
        });
        it('should generate summary with commits only', () => {
            const sessionData = {
                sessionId: 'test',
                startTime: new Date(),
                editedFiles: [],
                gitCommits: [
                    { hash: 'abc', message: 'test', author: 'user', timestamp: new Date(), filesChanged: [] }
                ],
                terminalErrors: []
            };
            const result = service.generateFallbackSummary(sessionData);
            expect(result).toBe('In your last session, you made 1 commit.');
        });
        it('should generate summary with multiple commits', () => {
            const sessionData = {
                sessionId: 'test',
                startTime: new Date(),
                editedFiles: [],
                gitCommits: [
                    { hash: 'abc', message: 'test1', author: 'user', timestamp: new Date(), filesChanged: [] },
                    { hash: 'def', message: 'test2', author: 'user', timestamp: new Date(), filesChanged: [] }
                ],
                terminalErrors: []
            };
            const result = service.generateFallbackSummary(sessionData);
            expect(result).toBe('In your last session, you made 2 commits.');
        });
        it('should generate summary with all activity types', () => {
            const sessionData = {
                sessionId: 'test',
                startTime: new Date(),
                editedFiles: [
                    { filePath: '/test.ts', timestamp: new Date(), changeType: 'modified' }
                ],
                gitCommits: [
                    { hash: 'abc', message: 'test', author: 'user', timestamp: new Date(), filesChanged: [] }
                ],
                terminalErrors: [
                    { message: 'error', timestamp: new Date(), terminalName: 'term', errorType: 'error' }
                ]
            };
            const result = service.generateFallbackSummary(sessionData);
            expect(result).toBe('In your last session, you Modified 1 file, made 1 commit, encountered terminal errors.');
        });
        it('should handle empty session data', () => {
            const sessionData = {
                sessionId: 'test',
                startTime: new Date(),
                editedFiles: [],
                gitCommits: [],
                terminalErrors: []
            };
            const result = service.generateFallbackSummary(sessionData);
            expect(result).toBe('No significant activity detected in the last session.');
        });
    });
});
//# sourceMappingURL=AISummaryService.test.js.map