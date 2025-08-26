"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SidebarPanelProvider = void 0;
/**
 * Manages the VS Code webview panel for displaying session recap
 * This is a basic implementation that will be expanded in later tasks
 */
class SidebarPanelProvider {
    constructor(extensionUri) {
        this._extensionUri = extensionUri;
    }
    resolveWebviewView(webviewView, context, _token) {
        this._view = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };
        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
        // Handle messages from the webview
        webviewView.webview.onDidReceiveMessage(data => {
            switch (data.type) {
                case 'fileClick':
                    if (this._fileClickCallback) {
                        this._fileClickCallback(data.filePath);
                    }
                    break;
            }
        });
    }
    show() {
        if (this._view) {
            this._view.show?.(true);
        }
    }
    hide() {
        // WebviewView doesn't have a hide method, but we can clear content
        if (this._view) {
            this._view.webview.html = '';
        }
    }
    updateContent(sessionData) {
        if (this._view) {
            this._view.webview.postMessage({ type: 'updateSession', sessionData });
        }
    }
    onFileClick(callback) {
        this._fileClickCallback = callback;
    }
    _getHtmlForWebview(webview) {
        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Session Recap</title>
                <style>
                    body {
                        font-family: var(--vscode-font-family);
                        font-size: var(--vscode-font-size);
                        color: var(--vscode-foreground);
                        background-color: var(--vscode-editor-background);
                        padding: 10px;
                        margin: 0;
                    }
                    .section {
                        margin-bottom: 20px;
                    }
                    .section-title {
                        font-weight: bold;
                        margin-bottom: 8px;
                        color: var(--vscode-textLink-foreground);
                    }
                    .file-item {
                        cursor: pointer;
                        padding: 4px;
                        border-radius: 3px;
                    }
                    .file-item:hover {
                        background-color: var(--vscode-list-hoverBackground);
                    }
                    .empty-state {
                        color: var(--vscode-descriptionForeground);
                        font-style: italic;
                    }
                </style>
            </head>
            <body>
                <div id="content">
                    <div class="section">
                        <div class="section-title">Session Recap</div>
                        <div class="empty-state">Loading session data...</div>
                    </div>
                </div>

                <script>
                    const vscode = acquireVsCodeApi();
                    
                    window.addEventListener('message', event => {
                        const message = event.data;
                        switch (message.type) {
                            case 'updateSession':
                                updateSessionDisplay(message.sessionData);
                                break;
                        }
                    });

                    function updateSessionDisplay(sessionData) {
                        const content = document.getElementById('content');
                        
                        let html = '<div class="section">';
                        html += '<div class="section-title">Session Summary</div>';
                        
                        if (sessionData.summary) {
                            html += '<div>' + sessionData.summary + '</div>';
                        } else if (sessionData.sessionId === 'welcome') {
                            html += '<div class="empty-state">Welcome to Session Recap! This is your first session.</div>';
                        } else {
                            html += '<div class="empty-state">No summary available</div>';
                        }
                        
                        html += '</div>';

                        // Files section
                        html += '<div class="section">';
                        html += '<div class="section-title">Edited Files</div>';
                        if (sessionData.editedFiles && sessionData.editedFiles.length > 0) {
                            sessionData.editedFiles.forEach(file => {
                                html += '<div class="file-item" onclick="openFile(\'' + file.filePath + '\')">' + file.filePath + '</div>';
                            });
                        } else {
                            html += '<div class="empty-state">No files edited in last session</div>';
                        }
                        html += '</div>';

                        // Git commits section
                        html += '<div class="section">';
                        html += '<div class="section-title">Git Commits</div>';
                        if (sessionData.gitCommits && sessionData.gitCommits.length > 0) {
                            sessionData.gitCommits.forEach(commit => {
                                html += '<div>' + commit.hash.substring(0, 7) + ' - ' + commit.message + '</div>';
                            });
                        } else {
                            html += '<div class="empty-state">No commits since last session</div>';
                        }
                        html += '</div>';

                        // Terminal errors section
                        html += '<div class="section">';
                        html += '<div class="section-title">Terminal Errors</div>';
                        if (sessionData.terminalErrors && sessionData.terminalErrors.length > 0) {
                            const lastError = sessionData.terminalErrors[sessionData.terminalErrors.length - 1];
                            html += '<div>' + lastError.message + '</div>';
                        } else {
                            html += '<div class="empty-state">No terminal errors in last session</div>';
                        }
                        html += '</div>';

                        content.innerHTML = html;
                    }

                    function openFile(filePath) {
                        vscode.postMessage({
                            type: 'fileClick',
                            filePath: filePath
                        });
                    }
                </script>
            </body>
            </html>`;
    }
}
exports.SidebarPanelProvider = SidebarPanelProvider;
SidebarPanelProvider.viewType = 'sessionRecap';
//# sourceMappingURL=SidebarPanelProvider.js.map