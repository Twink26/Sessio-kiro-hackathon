import * as vscode from 'vscode';
import * as path from 'path';
import { SessionTracker } from './services/SessionTracker';
import { SidebarPanelProvider } from './providers/SidebarPanelProvider';
import { AISummaryService } from './services/AISummaryService';
import { TeamDashboardProvider } from './providers/TeamDashboardProvider';
import { TeamDataAggregator } from './services/TeamDataAggregator';
import { TeamDashboardService } from './services/TeamDashboardService';
import { ConfigurationService } from './services/ConfigurationService';

let sessionTracker: SessionTracker;
let sidebarProvider: SidebarPanelProvider;
let aiSummaryService: AISummaryService;
let teamDashboardProvider: TeamDashboardProvider;
let teamDataAggregator: TeamDataAggregator;
let teamDashboardService: TeamDashboardService;
let configurationService: ConfigurationService;
let outputChannel: vscode.OutputChannel;

/**
 * Extension activation function
 * Called when VS Code starts up (onStartupFinished activation event)
 */
export async function activate(context: vscode.ExtensionContext) {
    console.log('Session Recap extension is now active');

    try {
        // Create output channel for logging
        outputChannel = vscode.window.createOutputChannel('Session Recap');
        context.subscriptions.push(outputChannel);

        // Initialize configuration service
        configurationService = new ConfigurationService();
        context.subscriptions.push(configurationService);

        // Initialize the sidebar panel provider
        sidebarProvider = new SidebarPanelProvider(context.extensionUri);
        
        // Register the webview provider
        context.subscriptions.push(
            vscode.window.registerWebviewViewProvider('sessionRecap', sidebarProvider)
        );

        // Initialize team dashboard components
        teamDashboardProvider = new TeamDashboardProvider(context.extensionUri);
        teamDataAggregator = new TeamDataAggregator(context, configurationService, outputChannel);
        teamDashboardService = new TeamDashboardService(teamDataAggregator, teamDashboardProvider, outputChannel);
        
        // Register team dashboard webview provider
        context.subscriptions.push(
            vscode.window.registerWebviewViewProvider('teamDashboard', teamDashboardProvider)
        );

        // Initialize AI summary service
        aiSummaryService = new AISummaryService(outputChannel);

        // Initialize session tracker
        sessionTracker = new SessionTracker(context, sidebarProvider);

        // Set up file click handler for sidebar
        sidebarProvider.onFileClick((filePath) => {
            openFile(filePath);
        });

        // Load and display previous session data with AI summary
        loadAndDisplayPreviousSession();

        // Initialize team dashboard
        await initializeTeamDashboard();

        // Start tracking the new session
        sessionTracker.startTracking();

        // Register commands
        registerCommands(context);

        outputChannel.appendLine('Session Recap extension initialization complete');
        console.log('Session Recap extension initialization complete');
    } catch (error) {
        const errorMessage = `Failed to activate Session Recap extension: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error(errorMessage);
        vscode.window.showErrorMessage(errorMessage);
        
        if (outputChannel) {
            outputChannel.appendLine(`Activation Error: ${errorMessage}`);
        }
    }
}

/**
 * Extension deactivation function
 * Called when VS Code is shutting down
 */
export async function deactivate() {
    console.log('Session Recap extension is deactivating');
    
    try {
        if (sessionTracker) {
            // Save current session before deactivation
            try {
                const currentSession = sessionTracker.getCurrentSession();
                await sessionTracker.saveSession();
                
                // Share session data with team if enabled
                if (teamDashboardService && currentSession) {
                    await teamDashboardService.shareSessionData(currentSession);
                }
            } catch (error) {
                console.error('Failed to save session during deactivation:', error);
                if (outputChannel) {
                    outputChannel.appendLine(`Deactivation save error: ${error}`);
                }
            }
            
            // Stop tracking
            sessionTracker.stopTracking();
            
            // Dispose of session tracker if it has a dispose method
            if ('dispose' in sessionTracker) {
                (sessionTracker as any).dispose();
            }
        }

        // Dispose team dashboard service
        if (teamDashboardService) {
            teamDashboardService.dispose();
        }
        
        if (outputChannel) {
            outputChannel.appendLine('Session Recap extension deactivated');
        }
        
        console.log('Session Recap extension deactivated');
    } catch (error) {
        console.error('Error during extension deactivation:', error);
    }
}

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
                } catch (aiError) {
                    outputChannel.appendLine(`AI summary generation failed: ${aiError}`);
                    // Generate fallback summary
                    previousSession.summary = aiSummaryService.generateFallbackSummary(previousSession);
                    outputChannel.appendLine('Using fallback summary');
                }
            } else if (!previousSession.summary) {
                // Generate fallback summary if AI is not available
                previousSession.summary = aiSummaryService.generateFallbackSummary(previousSession);
                outputChannel.appendLine('Generated fallback summary (AI disabled)');
            }

            // Update sidebar with previous session data
            sidebarProvider.updateContent(previousSession);
            outputChannel.appendLine('Previous session displayed in sidebar');
            console.log('Previous session loaded and displayed');
        } else {
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
    } catch (error) {
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
        } catch (sidebarError) {
            console.error('Failed to update sidebar with error state:', sidebarError);
        }
        
        // Show user-friendly error message
        vscode.window.showWarningMessage(
            'Session Recap: Could not load previous session data. The extension will continue to work normally.',
            'View Logs'
        ).then(selection => {
            if (selection === 'View Logs') {
                outputChannel.show();
            }
        });
    }
}

/**
 * Open a file in the VS Code editor
 */
async function openFile(filePath: string) {
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
    } catch (error) {
        const errorMessage = `Failed to open file ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error(errorMessage);
        outputChannel.appendLine(`Error: ${errorMessage}`);
        vscode.window.showErrorMessage(`Could not open file: ${path.basename(filePath)}`);
    }
}

/**
 * Initialize team dashboard
 */
async function initializeTeamDashboard() {
    try {
        if (teamDashboardService) {
            await teamDashboardService.initialize();
            outputChannel.appendLine('Team dashboard initialized');
        }
    } catch (error) {
        outputChannel.appendLine(`Failed to initialize team dashboard: ${error}`);
        // Don't throw error - team dashboard is optional functionality
    }
}

/**
 * Register extension commands
 */
function registerCommands(context: vscode.ExtensionContext) {
    // Command to manually refresh the session recap
    const refreshCommand = vscode.commands.registerCommand('sessionRecap.refresh', async () => {
        try {
            outputChannel.appendLine('Manual refresh requested');
            await loadAndDisplayPreviousSession();
            vscode.window.showInformationMessage('Session recap refreshed');
        } catch (error) {
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
        } catch (error) {
            const errorMessage = `Failed to clear session data: ${error instanceof Error ? error.message : 'Unknown error'}`;
            console.error(errorMessage);
            outputChannel.appendLine(`Clear Error: ${errorMessage}`);
            vscode.window.showErrorMessage('Failed to clear session data');
        }
    });

    // Command to refresh team dashboard
    const refreshTeamCommand = vscode.commands.registerCommand('sessionRecap.refreshTeam', async () => {
        try {
            if (teamDashboardService) {
                await teamDashboardService.refreshDashboard();
                vscode.window.showInformationMessage('Team dashboard refreshed');
            }
        } catch (error) {
            const errorMessage = `Failed to refresh team dashboard: ${error instanceof Error ? error.message : 'Unknown error'}`;
            console.error(errorMessage);
            outputChannel.appendLine(`Team Refresh Error: ${errorMessage}`);
            vscode.window.showErrorMessage('Failed to refresh team dashboard');
        }
    });

    // Command to opt in to team sharing
    const optInCommand = vscode.commands.registerCommand('sessionRecap.optInTeam', async () => {
        try {
            if (teamDashboardService) {
                await teamDashboardService.handleOptIn();
            }
        } catch (error) {
            const errorMessage = `Failed to opt in to team sharing: ${error instanceof Error ? error.message : 'Unknown error'}`;
            console.error(errorMessage);
            outputChannel.appendLine(`Opt-in Error: ${errorMessage}`);
            vscode.window.showErrorMessage('Failed to opt in to team sharing');
        }
    });

    // Command to opt out of team sharing
    const optOutCommand = vscode.commands.registerCommand('sessionRecap.optOutTeam', async () => {
        try {
            if (teamDashboardService) {
                await teamDashboardService.handleOptOut();
            }
        } catch (error) {
            const errorMessage = `Failed to opt out of team sharing: ${error instanceof Error ? error.message : 'Unknown error'}`;
            console.error(errorMessage);
            outputChannel.appendLine(`Opt-out Error: ${errorMessage}`);
            vscode.window.showErrorMessage('Failed to opt out of team sharing');
        }
    });

    // Command to show output channel
    const showLogsCommand = vscode.commands.registerCommand('sessionRecap.showLogs', () => {
        outputChannel.show();
    });

    context.subscriptions.push(refreshCommand, clearCommand, refreshTeamCommand, optInCommand, optOutCommand, showLogsCommand);
}