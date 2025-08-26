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
const SessionTracker_1 = require("./services/SessionTracker");
const SidebarPanelProvider_1 = require("./providers/SidebarPanelProvider");
let sessionTracker;
let sidebarProvider;
/**
 * Extension activation function
 * Called when VS Code starts up (onStartupFinished activation event)
 */
function activate(context) {
    console.log('Session Recap extension is now active');
    // Initialize the sidebar panel provider
    sidebarProvider = new SidebarPanelProvider_1.SidebarPanelProvider(context.extensionUri);
    // Register the webview provider
    context.subscriptions.push(vscode.window.registerWebviewViewProvider('sessionRecap', sidebarProvider));
    // Initialize session tracker
    sessionTracker = new SessionTracker_1.SessionTracker(context, sidebarProvider);
    // Load and display previous session data
    loadPreviousSession();
    // Start tracking the new session
    sessionTracker.startTracking();
    // Register commands
    registerCommands(context);
    console.log('Session Recap extension initialization complete');
}
exports.activate = activate;
/**
 * Extension deactivation function
 * Called when VS Code is shutting down
 */
function deactivate() {
    console.log('Session Recap extension is deactivating');
    if (sessionTracker) {
        // Save current session before deactivation
        sessionTracker.saveSession().catch(error => {
            console.error('Failed to save session during deactivation:', error);
        });
        // Stop tracking
        sessionTracker.stopTracking();
    }
    console.log('Session Recap extension deactivated');
}
exports.deactivate = deactivate;
/**
 * Load and display previous session data
 */
async function loadPreviousSession() {
    try {
        const previousSession = sessionTracker.getPreviousSession();
        if (previousSession) {
            // Update sidebar with previous session data
            sidebarProvider.updateContent(previousSession);
            console.log('Previous session loaded and displayed');
        }
        else {
            // Show welcome message for first-time users
            sidebarProvider.updateContent({
                sessionId: 'welcome',
                startTime: new Date(),
                editedFiles: [],
                gitCommits: [],
                terminalErrors: [],
                summary: 'Welcome to Session Recap! This is your first session.'
            });
            console.log('No previous session found, showing welcome message');
        }
    }
    catch (error) {
        console.error('Failed to load previous session:', error);
        vscode.window.showErrorMessage('Failed to load previous session data');
    }
}
/**
 * Register extension commands
 */
function registerCommands(context) {
    // Command to manually refresh the session recap
    const refreshCommand = vscode.commands.registerCommand('sessionRecap.refresh', () => {
        const currentSession = sessionTracker.getCurrentSession();
        sidebarProvider.updateContent(currentSession);
        vscode.window.showInformationMessage('Session recap refreshed');
    });
    // Command to clear current session data
    const clearCommand = vscode.commands.registerCommand('sessionRecap.clear', () => {
        sessionTracker.reset();
        vscode.window.showInformationMessage('Session data cleared');
    });
    context.subscriptions.push(refreshCommand, clearCommand);
}
//# sourceMappingURL=extension.js.map