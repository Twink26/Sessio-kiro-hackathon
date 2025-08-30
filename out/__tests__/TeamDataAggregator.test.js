"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const TeamDataAggregator_1 = require("../services/TeamDataAggregator");
// Mock VS Code API
jest.mock('vscode', () => ({
    ExtensionContext: jest.fn(),
    OutputChannel: jest.fn(),
    workspace: {
        getConfiguration: jest.fn(),
        workspaceFolders: [{ name: 'test-workspace' }]
    },
    window: {
        showInformationMessage: jest.fn(),
        showErrorMessage: jest.fn()
    }
}));
describe('TeamDataAggregator', () => {
    let teamDataAggregator;
    let mockContext;
    let mockConfigService;
    let mockOutputChannel;
    beforeEach(() => {
        mockContext = {
            globalState: {
                get: jest.fn(),
                update: jest.fn()
            }
        };
        mockConfigService = {
            getConfiguration: jest.fn().mockReturnValue({
                enableTeamDashboard: true,
                privacySettings: {
                    shareWithTeam: false,
                    excludeFilePatterns: ['*.log'],
                    excludeCommitPatterns: ['WIP:']
                }
            }),
            updateConfiguration: jest.fn()
        };
        mockOutputChannel = {
            appendLine: jest.fn()
        };
        teamDataAggregator = new TeamDataAggregator_1.TeamDataAggregator(mockContext, mockConfigService, mockOutputChannel);
    });
    describe('hasUserOptedIn', () => {
        it('should return false when user has not opted in', async () => {
            mockContext.globalState.get.mockReturnValue(false);
            const result = await teamDataAggregator.hasUserOptedIn();
            expect(result).toBe(false);
        });
        it('should return false when team dashboard is disabled', async () => {
            mockContext.globalState.get.mockReturnValue(true);
            mockConfigService.getConfiguration.mockReturnValue({
                enableTeamDashboard: false,
                privacySettings: { shareWithTeam: true }
            });
            const result = await teamDataAggregator.hasUserOptedIn();
            expect(result).toBe(false);
        });
        it('should return true when user has opted in and team dashboard is enabled', async () => {
            mockContext.globalState.get.mockReturnValue(true);
            mockConfigService.getConfiguration.mockReturnValue({
                enableTeamDashboard: true,
                privacySettings: { shareWithTeam: true }
            });
            const result = await teamDataAggregator.hasUserOptedIn();
            expect(result).toBe(true);
        });
    });
    describe('optInToTeamSharing', () => {
        it('should update global state and configuration when opting in', async () => {
            await teamDataAggregator.optInToTeamSharing();
            expect(mockContext.globalState.update).toHaveBeenCalledWith('sessionRecap.teamOptIn', true);
            expect(mockConfigService.updateConfiguration).toHaveBeenCalledWith('privacySettings.shareWithTeam', true);
            expect(mockConfigService.updateConfiguration).toHaveBeenCalledWith('enableTeamDashboard', true);
        });
        it('should handle errors when opting in fails', async () => {
            mockContext.globalState.update.mockRejectedValue(new Error('Update failed'));
            await expect(teamDataAggregator.optInToTeamSharing()).rejects.toThrow('Failed to opt in to team data sharing');
        });
    });
    describe('optOutOfTeamSharing', () => {
        it('should update global state and configuration when opting out', async () => {
            await teamDataAggregator.optOutOfTeamSharing();
            expect(mockContext.globalState.update).toHaveBeenCalledWith('sessionRecap.teamOptIn', false);
            expect(mockConfigService.updateConfiguration).toHaveBeenCalledWith('privacySettings.shareWithTeam', false);
        });
    });
    describe('getUserPermissions', () => {
        it('should return null when user has not opted in', async () => {
            mockContext.globalState.get.mockReturnValue(false);
            const result = await teamDataAggregator.getUserPermissions();
            expect(result).toBeNull();
        });
        it('should return permissions when user has opted in', async () => {
            mockContext.globalState.get.mockReturnValue(true);
            mockConfigService.getConfiguration.mockReturnValue({
                enableTeamDashboard: true,
                privacySettings: { shareWithTeam: true }
            });
            const result = await teamDataAggregator.getUserPermissions();
            expect(result).toEqual({
                canViewTeamData: true,
                canViewMemberDetails: true,
                isTeamLead: false,
                teamId: 'team-test-workspace'
            });
        });
    });
    describe('isTeamDashboardAvailable', () => {
        it('should return configuration value for team dashboard', async () => {
            const result = await teamDataAggregator.isTeamDashboardAvailable();
            expect(result).toBe(true);
            expect(mockConfigService.getConfiguration).toHaveBeenCalled();
        });
    });
});
//# sourceMappingURL=TeamDataAggregator.test.js.map