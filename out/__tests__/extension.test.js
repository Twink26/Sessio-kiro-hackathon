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
const extension_1 = require("../extension");
// Mock VS Code API
jest.mock('vscode', () => ({
    window: {
        createOutputChannel: jest.fn(() => ({
            appendLine: jest.fn(),
            show: jest.fn(),
            dispose: jest.fn()
        })),
        registerWebviewViewProvider: jest.fn(),
        showErrorMessage: jest.fn(),
        showWarningMessage: jest.fn(() => Promise.resolve()),
        showInformationMessage: jest.fn(),
        showTextDocument: jest.fn()
    },
    workspace: {
        getConfiguration: jest.fn(() => ({
            get: jest.fn((key, defaultValue) => {
                const config = {
                    'aiProvider': 'disabled',
                    'openaiApiKey': '',
                    'aiMaxTokens': 150,
                    'aiTemperature': 0.7
                };
                return config[key] ?? defaultValue;
            })
        })),
        workspaceFolders: [],
        openTextDocument: jest.fn()
    },
    commands: {
        registerCommand: jest.fn(() => ({ dispose: jest.fn() }))
    },
    Uri: {
        file: jest.fn((path) => ({ fsPath: path }))
    },
    ExtensionContext: jest.fn()
}));
// Mock the services
jest.mock('../services/SessionTracker');
jest.mock('../providers/SidebarPanelProvider');
jest.mock('../services/AISummaryService');
describe('Extension Activation', () => {
    let mockContext;
    beforeEach(() => {
        jest.clearAllMocks();
        mockContext = {
            subscriptions: [],
            extensionUri: { fsPath: '/test/path' },
            globalStorageUri: { fsPath: '/test/storage' }
        };
    });
    afterEach(() => {
        // Clean up after each test
        (0, extension_1.deactivate)();
    });
    test('should activate extension successfully', async () => {
        // Act
        await (0, extension_1.activate)(mockContext);
        // Assert
        expect(vscode.window.createOutputChannel).toHaveBeenCalledWith('Session Recap');
        expect(vscode.window.registerWebviewViewProvider).toHaveBeenCalledWith('sessionRecap', expect.any(Object));
        expect(vscode.commands.registerCommand).toHaveBeenCalledWith('sessionRecap.refresh', expect.any(Function));
        expect(vscode.commands.registerCommand).toHaveBeenCalledWith('sessionRecap.clear', expect.any(Function));
        expect(vscode.commands.registerCommand).toHaveBeenCalledWith('sessionRecap.showLogs', expect.any(Function));
    });
    test('should handle activation errors gracefully', async () => {
        // Arrange
        const mockError = new Error('Test activation error');
        vscode.window.createOutputChannel.mockImplementation(() => {
            throw mockError;
        });
        // Act
        await (0, extension_1.activate)(mockContext);
        // Assert
        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(expect.stringContaining('Failed to activate Session Recap extension'));
    });
    test('should register all required commands', async () => {
        // Act
        await (0, extension_1.activate)(mockContext);
        // Assert
        expect(vscode.commands.registerCommand).toHaveBeenCalledWith('sessionRecap.refresh', expect.any(Function));
        expect(vscode.commands.registerCommand).toHaveBeenCalledWith('sessionRecap.clear', expect.any(Function));
        expect(vscode.commands.registerCommand).toHaveBeenCalledWith('sessionRecap.showLogs', expect.any(Function));
    });
    test('should handle deactivation gracefully', () => {
        // This test ensures deactivate doesn't throw errors
        expect(() => (0, extension_1.deactivate)()).not.toThrow();
    });
});
describe('Extension Commands', () => {
    let mockContext;
    let registeredCommands = {};
    beforeEach(async () => {
        jest.clearAllMocks();
        registeredCommands = {};
        mockContext = {
            subscriptions: [],
            extensionUri: { fsPath: '/test/path' },
            globalStorageUri: { fsPath: '/test/storage' }
        };
        // Capture registered commands
        vscode.commands.registerCommand.mockImplementation((command, callback) => {
            registeredCommands[command] = callback;
            return { dispose: jest.fn() };
        });
        await (0, extension_1.activate)(mockContext);
    });
    afterEach(() => {
        (0, extension_1.deactivate)();
    });
    test('refresh command should work without errors', async () => {
        // Act
        const refreshCommand = registeredCommands['sessionRecap.refresh'];
        // Should not throw
        expect(refreshCommand).toBeDefined();
        await expect(refreshCommand()).resolves.not.toThrow();
    });
    test('clear command should work without errors', () => {
        // Act
        const clearCommand = registeredCommands['sessionRecap.clear'];
        // Should not throw
        expect(() => clearCommand()).not.toThrow();
    });
    test('showLogs command should show output channel', () => {
        // Act
        const showLogsCommand = registeredCommands['sessionRecap.showLogs'];
        showLogsCommand();
        // The command should execute without error
        // Actual output channel show() call is tested in integration tests
        expect(showLogsCommand).toBeDefined();
    });
});
//# sourceMappingURL=extension.test.js.map