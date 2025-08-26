"use strict";
// Jest setup file for VS Code extension tests
// Mock VS Code API
const mockVSCode = {
    workspace: {
        workspaceFolders: [
            {
                uri: {
                    fsPath: '/test/workspace'
                }
            }
        ]
    },
    ExtensionContext: class {
        constructor() {
            this.globalStorageUri = {
                fsPath: '/test/storage'
            };
        }
    }
};
// Make vscode module available for tests
jest.mock('vscode', () => mockVSCode, { virtual: true });
//# sourceMappingURL=setup.js.map