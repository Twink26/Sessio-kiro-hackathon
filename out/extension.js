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
exports.deactivate = exports.activate = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const SessionTracker_1 = require("./services/SessionTracker");
const SidebarPanelProvider_1 = require("./providers/SidebarPanelProvider");
const AISummaryService_1 = require("./services/AISummaryService");
let sessionTracker;
let sidebarProvider;
let aiSummaryService;
let outputChannel;
/**
 * Extension activation function
 * Called when VS Code starts up (onStartupFinished activation event)
 */
function activate(context) {
    console.log('Session Recap extension is now active');
    try {
        // Create output channel for logging
        outputChannel = vscode.window.createOutputChannel('Session Recap');
        context.subscriptions.push(outputChannel);
        // Initialize the sidebar panel provider
        sidebarProvider = new SidebarPanelProvider_1.SidebarPanelProvider(context.extensionUri);
        // Register the webview provider
        context.subscriptions.push(vscode.window.registerWebviewViewProvider('sessionRecap', sidebarProvider));
        // Initialize AI summary service
        aiSummaryService = new AISummaryService_1.AISummaryService(outputChannel);
        // Initialize session tracker
        sessionTracker = new SessionTracker_1.SessionTracker(context, sidebarProvider);
        // Set up file click handler for sidebar
        sidebarProvider.onFileClick((filePath) => {
            openFile(filePath);
        });
        // Load and display previous session data with AI summary
        loadAndDisplayPreviousSession();
        // Start tracking the new session
        sessionTracker.startTracking();
        // Register commands
        registerCommands(context);
        outputChannel.appendLine('Session Recap extension initialization complete');
        console.log('Session Recap extension initialization complete');
    }
    catch (error) {
        const errorMessage = `Failed to activate Session Recap extension: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error(errorMessage);
        vscode.window.showErrorMessage(errorMessage);
        if (outputChannel) {
            outputChannel.appendLine(`Activation Error: ${errorMessage}`);
        }
    }
}
exports.activate = activate;
/**
 * Extension deactivation function
 * Called when VS Code is shutting down
 */
async function deactivate() {
    console.log('Session Recap extension is deactivating');
    try {
        if (sessionTracker) {
            // Save current session before deactivation
            try {
                await sessionTracker.saveSession();
            }
            catch (error) {
                console.error('Failed to save session during deactivation:', error);
                if (outputChannel) {
                    outputChannel.appendLine(`Deactivation save error: ${error}`);
                }
            }
            // Stop tracking
            sessionTracker.stopTracking();
            // Dispose of session tracker if it has a dispose method
            if ('dispose' in sessionTracker) {
                sessionTracker.dispose();
            }
        }
        if (outputChannel) {
            outputChannel.appendLine('Session Recap extension deactivated');
        }
        console.log('Session Recap extension deactivated');
    }
    catch (error) {
        console.error('Error during extension deactivation:', error);
    }
}
exports.deactivate = deactivate;
/**
 * Load and display previous session data with AI summary
 */
async function loadAndDisplayPreviousSession() {
    try {
        outputChannel.appendLine('Loading previous session data...');
        const previousSession = await sessionTracker.ensurePreviousSessionLoaded();
        if (previousSession) {
            outputChannel.appendLine(`Previous session found: ${previousSession.sessionId}`);
            // Generate AI summary if not already present and AI is enabled
            if (!previousSession.summary && aiSummaryService.isAvailable()) {
                try {
                    outputChannel.appendLine('Generating AI summary for previous session...');
                    const aiSummary = await aiSummaryService.generateSummary(previousSession);
                    previousSession.summary = aiSummary;
                    outputChannel.appendLine('AI summary generated successfully');
                }
                catch (aiError) {
                    outputChannel.appendLine(`AI summary generation failed: ${aiError}`);
                    // Generate fallback summary
                    previousSession.summary = aiSummaryService.generateFallbackSummary(previousSession);
                    outputChannel.appendLine('Using fallback summary');
                }
            }
            else if (!previousSession.summary) {
                // Generate fallback summary if AI is not available
                previousSession.summary = aiSummaryService.generateFallbackSummary(previousSession);
                outputChannel.appendLine('Generated fallback summary (AI disabled)');
            }
            // Update sidebar with previous session data
            sidebarProvider.updateContent(previousSession);
            outputChannel.appendLine('Previous session displayed in sidebar');
            console.log('Previous session loaded and displayed');
        }
        else {
            // Show welcome message for first-time users
            const welcomeSession = {
                sessionId: 'welcome',
                startTime: new Date(),
                editedFiles: [],
                gitCommits: [],
                terminalErrors: [],
                summary: 'Welcome to Session Recap! This is your first session. Start coding and your activity will be tracked here.'
            };
            sidebarProvider.updateContent(welcomeSession);
            outputChannel.appendLine('No previous session found, showing welcome message');
            console.log('No previous session found, showing welcome message');
        }
    }
    catch (error) {
        const errorMessage = `Failed to load previous session: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error(errorMessage);
        outputChannel.appendLine(`Error: ${errorMessage}`);
        // Show error state in sidebar
        try {
            const errorSession = {
                sessionId: 'error',
                startTime: new Date(),
                editedFiles: [],
                gitCommits: [],
                terminalErrors: [],
                summary: 'Failed to load previous session data. Please check the output channel for details.'
            };
            sidebarProvider.updateContent(errorSession);
        }
        catch (sidebarError) {
            console.error('Failed to update sidebar with error state:', sidebarError);
        }
        // Show user-friendly error message
        vscode.window.showWarningMessage('Session Recap: Could not load previous session data. The extension will continue to work normally.', 'View Logs').then(selection => {
            if (selection === 'View Logs') {
                outputChannel.show();
            }
        });
    }
}
/**
 * Open a file in the VS Code editor
 */
async function openFile(filePath) {
    try {
        // Convert relative path to absolute if needed
        let absolutePath = filePath;
        if (!path.isAbsolute(filePath)) {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (workspaceFolder) {
                absolutePath = path.join(workspaceFolder.uri.fsPath, filePath);
            }
        }
        const uri = vscode.Uri.file(absolutePath);
        const document = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(document);
        outputChannel.appendLine(`Opened file: ${filePath}`);
    }
    catch (error) {
        const errorMessage = `Failed to open file ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error(errorMessage);
        outputChannel.appendLine(`Error: ${errorMessage}`);
        vscode.window.showErrorMessage(`Could not open file: ${path.basename(filePath)}`);
    }
}
/**
 * Register extension commands
 */
function registerCommands(context) {
    // Command to manually refresh the session recap
    const refreshCommand = vscode.commands.registerCommand('sessionRecap.refresh', async () => {
        try {
            outputChannel.appendLine('Manual refresh requested');
            await loadAndDisplayPreviousSession();
            vscode.window.showInformationMessage('Session recap refreshed');
        }
        catch (error) {
            const errorMessage = `Failed to refresh session recap: ${error instanceof Error ? error.message : 'Unknown error'}`;
            console.error(errorMessage);
            outputChannel.appendLine(`Refresh Error: ${errorMessage}`);
            vscode.window.showErrorMessage('Failed to refresh session recap');
        }
    });
    // Command to clear current session data
    const clearCommand = vscode.commands.registerCommand('sessionRecap.clear', () => {
        try {
            sessionTracker.reset();
            outputChannel.appendLine('Session data cleared');
            vscode.window.showInformationMessage('Session data cleared');
        }
        catch (error) {
            const errorMessage = `Failed to clear session data: ${error instanceof Error ? error.message : 'Unknown error'}`;
            console.error(errorMessage);
            outputChannel.appendLine(`Clear Error: ${errorMessage}`);
            vscode.window.showErrorMessage('Failed to clear session data');
        }
    });
    // Command to show output channel
    const showLogsCommand = vscode.commands.registerCommand('sessionRecap.showLogs', () => {
        outputChannel.show();
    });
    context.subscriptions.push(refreshCommand, clearCommand, showLogsCommand);
}
//# sourceMappingURL=extension.js.map