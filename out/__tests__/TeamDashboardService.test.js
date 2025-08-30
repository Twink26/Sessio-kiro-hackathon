"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const TeamDashboardService_1 = require("../services/TeamDashboardService");
describe('TeamDashboardService', () => {
    let teamDashboardService;
    let mockTeamDataAggregator;
    let mockTeamDashboardProvider;
    let mockOutputChannel;
    beforeEach(() => {
        mockTeamDataAggregator = {
            hasUserOptedIn: jest.fn(),
            optInToTeamSharing: jest.fn(),
            optOutOfTeamSharing: jest.fn(),
            getUserPermissions: jest.fn(),
            getTeamSessionData: jest.fn(),
            shareSessionData: jest.fn(),
            isTeamDashboardAvailable: jest.fn()
        };
        mockTeamDashboardProvider = {
            show: jest.fn(),
            hide: jest.fn(),
            updateContent: jest.fn(),
            showAuthenticationRequired: jest.fn(),
            showPermissionDenied: jest.fn(),
            showOptInRequired: jest.fn(),
            onOptIn: jest.fn(),
            onAuthenticate: jest.fn()
        };
        mockOutputChannel = {
            appendLine: jest.fn()
        };
        teamDashboardService = new TeamDashboardService_1.TeamDashboardService(mockTeamDataAggregator, mockTeamDashboardProvider, mockOutputChannel);
    });
    describe('initialize', () => {
        it('should initialize when team dashboard is available', async () => {
            mockTeamDataAggregator.isTeamDashboardAvailable.mockResolvedValue(true);
            mockTeamDataAggregator.hasUserOptedIn.mockResolvedValue(true);
            mockTeamDataAggregator.getUserPermissions.mockResolvedValue({
                canViewTeamData: true,
                canViewMemberDetails: true,
                isTeamLead: false,
                teamId: 'test-team'
            });
            mockTeamDataAggregator.getTeamSessionData.mockResolvedValue({
                teamId: 'test-team',
                members: [],
                aggregatedAt: new Date()
            });
            await teamDashboardService.initialize();
            expect(mockTeamDataAggregator.isTeamDashboardAvailable).toHaveBeenCalled();
            expect(mockOutputChannel.appendLine).toHaveBeenCalledWith('Team dashboard service initialized');
        });
        it('should not initialize when team dashboard is disabled', async () => {
            mockTeamDataAggregator.isTeamDashboardAvailable.mockResolvedValue(false);
            await teamDashboardService.initialize();
            expect(mockOutputChannel.appendLine).toHaveBeenCalledWith('Team dashboard is disabled in configuration');
        });
    });
    describe('refreshDashboard', () => {
        it('should show opt-in required when user has not opted in', async () => {
            mockTeamDataAggregator.hasUserOptedIn.mockResolvedValue(false);
            await teamDashboardService.refreshDashboard();
            expect(mockTeamDashboardProvider.showOptInRequired).toHaveBeenCalled();
        });
        it('should show authentication required when user has no permissions', async () => {
            mockTeamDataAggregator.hasUserOptedIn.mockResolvedValue(true);
            mockTeamDataAggregator.getUserPermissions.mockResolvedValue(null);
            await teamDashboardService.refreshDashboard();
            expect(mockTeamDashboardProvider.showAuthenticationRequired).toHaveBeenCalled();
        });
        it('should show permission denied when user cannot view team data', async () => {
            mockTeamDataAggregator.hasUserOptedIn.mockResolvedValue(true);
            mockTeamDataAggregator.getUserPermissions.mockResolvedValue({
                canViewTeamData: false,
                canViewMemberDetails: false,
                isTeamLead: false,
                teamId: 'test-team'
            });
            await teamDashboardService.refreshDashboard();
            expect(mockTeamDashboardProvider.showPermissionDenied).toHaveBeenCalled();
        });
        it('should update content when user has permissions and data is available', async () => {
            const mockTeamData = {
                teamId: 'test-team',
                members: [],
                aggregatedAt: new Date()
            };
            mockTeamDataAggregator.hasUserOptedIn.mockResolvedValue(true);
            mockTeamDataAggregator.getUserPermissions.mockResolvedValue({
                canViewTeamData: true,
                canViewMemberDetails: true,
                isTeamLead: false,
                teamId: 'test-team'
            });
            mockTeamDataAggregator.getTeamSessionData.mockResolvedValue(mockTeamData);
            await teamDashboardService.refreshDashboard();
            expect(mockTeamDashboardProvider.updateContent).toHaveBeenCalledWith(mockTeamData);
        });
    });
    describe('shareSessionData', () => {
        it('should share session data through aggregator', async () => {
            const mockSessionData = {
                sessionId: 'test-session',
                startTime: new Date(),
                editedFiles: [],
                gitCommits: [],
                terminalErrors: []
            };
            await teamDashboardService.shareSessionData(mockSessionData);
            expect(mockTeamDataAggregator.shareSessionData).toHaveBeenCalledWith(mockSessionData);
        });
        it('should handle errors when sharing fails', async () => {
            const mockSessionData = {
                sessionId: 'test-session',
                startTime: new Date(),
                editedFiles: [],
                gitCommits: [],
                terminalErrors: []
            };
            mockTeamDataAggregator.shareSessionData.mockRejectedValue(new Error('Share failed'));
            await teamDashboardService.shareSessionData(mockSessionData);
            expect(mockOutputChannel.appendLine).toHaveBeenCalledWith('Failed to share session data: Error: Share failed');
        });
    });
    describe('handleOptIn', () => {
        it('should opt in and refresh dashboard', async () => {
            mockTeamDataAggregator.hasUserOptedIn.mockResolvedValue(true);
            mockTeamDataAggregator.getUserPermissions.mockResolvedValue({
                canViewTeamData: true,
                canViewMemberDetails: true,
                isTeamLead: false,
                teamId: 'test-team'
            });
            mockTeamDataAggregator.getTeamSessionData.mockResolvedValue({
                teamId: 'test-team',
                members: [],
                aggregatedAt: new Date()
            });
            await teamDashboardService.handleOptIn();
            expect(mockTeamDataAggregator.optInToTeamSharing).toHaveBeenCalled();
        });
    });
    describe('handleOptOut', () => {
        it('should opt out and show opt-in required', async () => {
            await teamDashboardService.handleOptOut();
            expect(mockTeamDataAggregator.optOutOfTeamSharing).toHaveBeenCalled();
            expect(mockTeamDashboardProvider.showOptInRequired).toHaveBeenCalled();
        });
    });
});
//# sourceMappingURL=TeamDashboardService.test.js.map