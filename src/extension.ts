import * as vscode from 'vscode';
import * as path from 'path';
import { SessionTracker } from './services/SessionTracker';
import { SidebarPanelProvider } from './providers/SidebarPanelProvider';
import { AISummaryService } from './services/AISummaryService';
import { TeamDashboardProvider } from './providers/TeamDashboardProvider';
import { TeamDataAggregator } from './services/TeamDataAggregator';
import { TeamDashboardService } from './services/TeamDashboardService';
import { ConfigurationService } from './services/ConfigurationService';
import { ErrorHandlingService } from './services/ErrorHandlingService';
import { LogLevel } from './services/LoggingService';

let sessionTracker: SessionTracker;
let sidebarProvider: SidebarPanelProvider;
let aiSummaryService: AISummaryService;
let teamDashboardProvider: TeamDashboardProvider;
let teamDataAggregator: TeamDataAggregator;
let teamDashboardService: TeamDashboardService;
let configurationService: ConfigurationService;
let errorHandlingService: ErrorHandlingService;
let outputChannel: vscode.OutputChannel;

/**
 * Extension activation function
 * Called when VS Code starts up (onStartupFinished activation event)
 */
export async function activate(context: vscode.ExtensionContext) {
    try {
        // Create output channel for logging
        outputChannel = vscode.window.createOutputChannel('Session Recap');
        context.subscriptions.push(outputChannel);

        // Initialize error handling service with appropriate log level
        const config = vscode.workspace.getConfiguration('sessionRecap');
        const logLevel = config.get<string>('logLevel', 'info');
        const logLevelEnum = LogLevel[logLevel.toUpperCase() as keyof typeof LogLevel] || LogLevel.INFO;
        
        errorHandlingService = new ErrorHandlingService(outputChannel, logLevelEnum);
        context.subscriptions.push(errorHandlingService);

        errorHandlingService.logInfo('Extension', 'Session Recap extension is now active', true);

        // Initialize configuration service with error handling
        await errorHandlingService.executeWithErrorHandling(
            async () => {
                configurationService = new ConfigurationService();
                context.subscriptions.push(configurationService);
            },
            { component: 'Extension', operation: 'initializeConfiguration' }
        );

        // Initialize the sidebar panel provider with error handling
        await errorHandlingService.executeWithErrorHandling(
            async () => {
                sidebarProvider = new SidebarPanelProvider(context.extensionUri);
                context.subscriptions.push(
                    vscode.window.registerWebviewViewProvider('sessionRecap', sidebarProvider)
                );
            },
            { component: 'Extension', operation: 'initializeSidebar' }
        );

        // Initialize team dashboard components with error handling
        await errorHandlingService.executeWithErrorHandling(
            async () => {
                teamDashboardProvider = new TeamDashboardProvider(context.extensionUri);
                teamDataAggregator = new TeamDataAggregator(context, configurationService, outputChannel);
                teamDashboardService = new TeamDashboardService(teamDataAggregator, teamDashboardProvider, outputChannel);
                
                context.subscriptions.push(
                    vscode.window.registerWebviewViewProvider('teamDashboard', teamDashboardProvider)
                );
            },
            { component: 'Extension', operation: 'initializeTeamDashboard' }
        );

        // Initialize AI summary service with error handling
        await errorHandlingService.executeWithErrorHandling(
            async () => {
                aiSummaryService = new AISummaryService(outputChannel);
            },
            { component: 'Extension', operation: 'initializeAIService' }
        );

        // Initialize session tracker with error handling
        await errorHandlingService.executeWithErrorHandling(
            async () => {
                sessionTracker = new SessionTracker(context, sidebarProvider);
            },
            { component: 'Extension', operation: 'initializeSessionTracker' }
        );

        // Set up file click handler for sidebar
        if (sidebarProvider) {
            sidebarProvider.onFileClick((filePath) => {
                openFile(filePath);
            });
        }

        // Load and display previous session data with AI summary
        await errorHandlingService.executeWithErrorHandling(
            async () => {
                await loadAndDisplayPreviousSession();
            },
            { component: 'Extension', operation: 'loadPreviousSession' }
        );

        // Initialize team dashboard
        await errorHandlingService.executeWithErrorHandling(
            async () => {
                await initializeTeamDashboard();
            },
            { component: 'Extension', operation: 'initializeTeamDashboard' }
        );

        // Start tracking the new session
        if (sessionTracker) {
            await errorHandlingService.executeWithErrorHandling(
                async () => {
                    sessionTracker.startTracking();
                },
                { component: 'Extension', operation: 'startTracking' }
            );
        }

        // Register commands
        registerCommands(context);

        errorHandlingService.logInfo('Extension', 'Session Recap extension initialization complete', true);
    } catch (error) {
        const errorMessage = `Failed to activate Session Recap extension: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error(errorMessage);
        vscode.window.showErrorMessage(errorMessage);
        
        if (outputChannel) {
            outputChannel.appendLine(`Activation Error: ${errorMessage}`);
        }
        
        if (errorHandlingService) {
            errorHandlingService.getErrorHandler().showUserError(
                'Session Recap extension failed to start. Some features may not work correctly.',
                ['Show Logs', 'Retry']
            );
        }
    }
}

/**
 * Extension deactivation function
 * Called when VS Code is shutting down
 */
export async function deactivate() {
    if (errorHandlingService) {
        errorHandlingService.logInfo('Extension', 'Session Recap extension is deactivating');
    }
    
    try {
        if (sessionTracker && errorHandlingService) {
            // Save current session before deactivation with error handling
            await errorHandlingService.executeWithErrorHandling(
                async () => {
                    const currentSession = sessionTracker.getCurrentSession();
                    await sessionTracker.saveSession();
                    
                    // Share session data with team if enabled
                    if (teamDashboardService && currentSession) {
                        await teamDashboardService.shareSessionData(currentSession);
                    }
                },
                { component: 'Extension', operation: 'saveSessionOnDeactivate' },
                undefined // no fallback value needed
            );
            
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
        
        // Dispose error handling service last
        if (errorHandlingService) {
            errorHandlingService.logInfo('Extension', 'Session Recap extension deactivated');
            errorHandlingService.dispose();
        }
        
        if (outputChannel) {
            outputChannel.appendLine('Session Recap extension deactivated');
        }
    } catch (error) {
        console.error('Error during extension deactivation:', error);
        if (errorHandlingService) {
            errorHandlingService.getLoggingService().error('Extension', 'Deactivation error', error as Error, {
                component: 'Extension',
                operation: 'deactivate'
            });
        }
    }
}

/**
 * Load and display previous session data with AI summary
 */
async function loadAndDisplayPreviousSession() {
    if (!errorHandlingService) {
        console.error('Error handling service not initialized');
        return;
    }

    await errorHandlingService.executeWithErrorHandling(
        async () => {
            errorHandlingService.logInfo('Extension', 'Loading previous session data...');
            
            const previousSession = await sessionTracker.ensurePreviousSessionLoaded();
            
            if (previousSession) {
                errorHandlingService.logInfo('Extension', `Previous session found: ${previousSession.sessionId}`);
                
                // Generate AI summary if not already present and AI is enabled
                if (!previousSession.summary && aiSummaryService.isAvailable()) {
                    await errorHandlingService.executeWithErrorHandling(
                        async () => {
                            errorHandlingService.logInfo('Extension', 'Generating AI summary for previous session...');
                            const aiSummary = await aiSummaryService.generateSummary(previousSession);
                            previousSession.summary = aiSummary;
                            errorHandlingService.logInfo('Extension', 'AI summary generated successfully');
                        },
                        { component: 'Extension', operation: 'generateAISummary' },
                        undefined // Will use fallback from error handler
                    );
                    
                    // If AI summary failed, generate fallback
                    if (!previousSession.summary) {
                        previousSession.summary = aiSummaryService.generateFallbackSummary(previousSession);
                        errorHandlingService.logInfo('Extension', 'Using fallback summary after AI failure');
                    }
                } else if (!previousSession.summary) {
                    // Generate fallback summary if AI is not available
                    previousSession.summary = aiSummaryService.generateFallbackSummary(previousSession);
                    errorHandlingService.logInfo('Extension', 'Generated fallback summary (AI disabled)');
                }

                // Update sidebar with previous session data
                sidebarProvider.updateContent(previousSession);
                errorHandlingService.logInfo('Extension', 'Previous session displayed in sidebar');
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
                errorHandlingService.logInfo('Extension', 'No previous session found, showing welcome message');
            }
        },
        { component: 'Extension', operation: 'loadPreviousSession' }
    );
}

/**
 * Open a file in the VS Code editor
 */
async function openFile(filePath: string) {
    if (!errorHandlingService) {
        console.error('Error handling service not initialized');
        return;
    }

    await errorHandlingService.executeWithErrorHandling(
        async () => {
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
            
            errorHandlingService.logInfo('Extension', `Opened file: ${filePath}`);
        },
        { 
            component: 'Extension', 
            operation: 'openFile',
            additionalData: { filePath }
        }
    );
}

/**
 * Initialize team dashboard
 */
async function initializeTeamDashboard() {
    if (!errorHandlingService) {
        console.error('Error handling service not initialized');
        return;
    }

    await errorHandlingService.executeWithErrorHandling(
        async () => {
            if (teamDashboardService) {
                await teamDashboardService.initialize();
                errorHandlingService.logInfo('Extension', 'Team dashboard initialized');
            }
        },
        { component: 'Extension', operation: 'initializeTeamDashboard' },
        undefined // No fallback needed - team dashboard is optional
    );
}

/**
 * Register extension commands
 */
function registerCommands(context: vscode.ExtensionContext) {
    // Command to manually refresh the session recap
    const refreshCommand = vscode.commands.registerCommand('sessionRecap.refresh', async () => {
        if (errorHandlingService) {
            await errorHandlingService.executeWithErrorHandling(
                async () => {
                    errorHandlingService.logInfo('Extension', 'Manual refresh requested');
                    await loadAndDisplayPreviousSession();
                    errorHandlingService.getErrorHandler().showUserInfo('Session recap refreshed');
                },
                { component: 'Extension', operation: 'manualRefresh' }
            );
        }
    });

    // Command to clear current session data
    const clearCommand = vscode.commands.registerCommand('sessionRecap.clear', async () => {
        if (errorHandlingService) {
            await errorHandlingService.executeWithErrorHandling(
                async () => {
                    sessionTracker.reset();
                    errorHandlingService.logInfo('Extension', 'Session data cleared');
                    errorHandlingService.getErrorHandler().showUserInfo('Session data cleared');
                },
                { component: 'Extension', operation: 'clearSession' }
            );
        }
    });

    // Command to refresh team dashboard
    const refreshTeamCommand = vscode.commands.registerCommand('sessionRecap.refreshTeam', async () => {
        if (errorHandlingService && teamDashboardService) {
            await errorHandlingService.executeWithErrorHandling(
                async () => {
                    await teamDashboardService.refreshDashboard();
                    errorHandlingService.getErrorHandler().showUserInfo('Team dashboard refreshed');
                },
                { component: 'Extension', operation: 'refreshTeamDashboard' }
            );
        }
    });

    // Command to opt in to team sharing
    const optInCommand = vscode.commands.registerCommand('sessionRecap.optInTeam', async () => {
        if (errorHandlingService && teamDashboardService) {
            await errorHandlingService.executeWithErrorHandling(
                async () => {
                    await teamDashboardService.handleOptIn();
                },
                { component: 'Extension', operation: 'optInTeamSharing' }
            );
        }
    });

    // Command to opt out of team sharing
    const optOutCommand = vscode.commands.registerCommand('sessionRecap.optOutTeam', async () => {
        if (errorHandlingService && teamDashboardService) {
            await errorHandlingService.executeWithErrorHandling(
                async () => {
                    await teamDashboardService.handleOptOut();
                },
                { component: 'Extension', operation: 'optOutTeamSharing' }
            );
        }
    });

    // Command to show output channel
    const showLogsCommand = vscode.commands.registerCommand('sessionRecap.showLogs', () => {
        if (errorHandlingService) {
            errorHandlingService.showLogs();
        } else {
            outputChannel.show();
        }
    });

    // Command to show telemetry summary
    const showTelemetryCommand = vscode.commands.registerCommand('sessionRecap.showTelemetry', () => {
        if (errorHandlingService) {
            const summary = errorHandlingService.getTelemetrySummary();
            const summaryText = JSON.stringify(summary, null, 2);
            
            vscode.workspace.openTextDocument({
                content: summaryText,
                language: 'json'
            }).then(doc => {
                vscode.window.showTextDocument(doc);
            });
            
            errorHandlingService.logInfo('Extension', 'Telemetry summary displayed');
        }
    });

    // Command to set log level
    const setLogLevelCommand = vscode.commands.registerCommand('sessionRecap.setLogLevel', async () => {
        if (errorHandlingService) {
            const levels = ['ERROR', 'WARN', 'INFO', 'DEBUG'];
            const selected = await vscode.window.showQuickPick(levels, {
                placeHolder: 'Select log level'
            });
            
            if (selected) {
                const logLevel = LogLevel[selected as keyof typeof LogLevel];
                errorHandlingService.setLogLevel(logLevel);
                errorHandlingService.getErrorHandler().showUserInfo(`Log level set to ${selected}`);
            }
        }
    });

    context.subscriptions.push(
        refreshCommand, 
        clearCommand, 
        refreshTeamCommand, 
        optInCommand, 
        optOutCommand, 
        showLogsCommand,
        showTelemetryCommand,
        setLogLevelCommand
    );
}