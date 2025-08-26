import * as vscode from 'vscode';
import { SessionTracker } from './services/SessionTracker';
import { SidebarPanelProvider } from './providers/SidebarPanelProvider';

let sessionTracker: SessionTracker;
let sidebarProvider: SidebarPanelProvider;

/**
 * Extension activation function
 * Called when VS Code starts up (onStartupFinished activation event)
 */
export function activate(context: vscode.ExtensionContext) {
    console.log('Session Recap extension is now active');

    // Initialize the sidebar panel provider
    sidebarProvider = new SidebarPanelProvider(context.extensionUri);
    
    // Register the webview provider
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('sessionRecap', sidebarProvider)
    );

    // Initialize session tracker
    sessionTracker = new SessionTracker(context, sidebarProvider);

    // Load and display previous session data
    loadPreviousSession();

    // Start tracking the new session
    sessionTracker.startTracking();

    // Register commands
    registerCommands(context);

    console.log('Session Recap extension initialization complete');
}

/**
 * Extension deactivation function
 * Called when VS Code is shutting down
 */
export function deactivate() {
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
        } else {
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
    } catch (error) {
        console.error('Failed to load previous session:', error);
        vscode.window.showErrorMessage('Failed to load previous session data');
    }
}

/**
 * Register extension commands
 */
function registerCommands(context: vscode.ExtensionContext) {
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