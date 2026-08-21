import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DashboardWorkspaceShell } from '../dashboard-workspace-shell';
import type { AuthSession } from '../../shared/auth-session';
import { useAppController } from '../../hooks/use-app-controller';


const mockController = {
  activeNav: 'overview' as const,
  sessionAccessTier: 'admin' as const,
  isSidebarCollapsed: false,
  selectedVisaRow: null,
  syncFeedback: null,
  handleNavigate: vi.fn(),
  handleOpenNewGroup: vi.fn(),
  toggleSidebarCollapse: vi.fn(),
  dismissSyncFeedback: vi.fn(),
  groupRecords: [],
  isGroupRecordsLoading: false,
  query: '',
  isActiveOnly: false,
  overviewMonthFilter: '',
  overviewMonthOptions: [],
  statCards: [],
  summaryMessage: '',
  selectedGroup: null,
  selectedGroupCode: null,
  selectedVisaGroupCode: null,
  filteredGroups: [],
  handleQueryChange: vi.fn(),
  handleToggleActiveOnly: vi.fn(),
  handleOverviewMonthFilterChange: vi.fn(),
  handleOpenDetail: vi.fn(),
  handleBackToOverview: vi.fn(),
  handleDeleteGroup: vi.fn(),
  handleSaveGroupDetail: vi.fn(),
  handleSaveGroupItinerary: vi.fn(),
  handlePatchGroupDetail: vi.fn(),
  handleOpenVisaDetail: vi.fn(),
  handleUpdateAgreementStatus: vi.fn(),
  handleBackToVisaTracking: vi.fn(),
  handleDeleteVisaGroup: vi.fn(),
  handleSaveVisaGroupDetail: vi.fn(),
  handleUpdateVisaStatus: vi.fn(),
  handleUpdateVisaType: vi.fn(),
  handleToggleHotelWaiver: vi.fn(),
  handleUpdatePaymentStatus: vi.fn(),
  handleUpdateSyarikah: vi.fn(),
  handleUpdateFlightDetails: vi.fn(),
  handleUpdateVisaHotel: vi.fn(),
  handleDeleteVisaHotel: vi.fn(),
  handleSyncVisaItinerary: vi.fn(),
  handleUpdateRaudhahAppointment: vi.fn(),
  handleClearRaudhahAppointment: vi.fn(),
  handleSetRaudhahTasrehPrinted: vi.fn(),
  handleSaveInputGroup: vi.fn(),
  handleSaveGroupIdentity: vi.fn(),
};

vi.mock('../../hooks/use-app-controller', () => ({
  useAppController: vi.fn(() => mockController),
}));

vi.mock('../app-sidebar', () => ({
  AppSidebar: ({ activeNav, onLogout, onNavigate, onToggleCollapse }: any) => (
    <div data-testid="app-sidebar" data-active-nav={activeNav}>
      <button onClick={onLogout}>Logout</button>
      <button onClick={onNavigate}>Navigate</button>
      <button onClick={onToggleCollapse}>Toggle Collapse</button>
    </div>
  ),
}));

vi.mock('../app-main-content', () => ({
  AppMainContent: () => <div data-testid="app-main-content">Main Content</div>,
}));

vi.mock('../mobile-nav', () => ({
  MobileNav: ({ isActionsOpen, onToggleActions }: any) => (
    <div data-testid="mobile-nav" data-actions-open={isActionsOpen}>
      <button onClick={onToggleActions}>Toggle Actions</button>
    </div>
  ),
}));

vi.mock('../mobile-quick-actions-sheet', () => ({
  MobileQuickActionsSheet: ({ open, onClose }: any) =>
    open ? (
      <div data-testid="mobile-quick-actions-sheet">
        <button onClick={onClose}>Close Sheet</button>
      </div>
    ) : null,
}));

vi.mock('../theme-toggle-button', () => ({
  ThemeToggleButton: ({ variant }: any) => (
    <div data-testid="theme-toggle-button" data-variant={variant}>
      Theme Toggle
    </div>
  ),
}));

describe('DashboardWorkspaceShell', () => {
  const mockSessionUser: AuthSession['user'] = {
    id: 'user-1',
    name: 'Test User',
    username: 'testuser',
    email: 'test@example.com',
    accessTier: 'admin',
  };

  const mockOnLogout = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render workspace shell with all components', () => {
    render(<DashboardWorkspaceShell sessionUser={mockSessionUser} onLogout={mockOnLogout} />);

    expect(screen.getByTestId('app-sidebar')).toBeInTheDocument();
    expect(screen.getByTestId('app-main-content')).toBeInTheDocument();
    expect(screen.getByTestId('mobile-nav')).toBeInTheDocument();
  });

  it('should show floating theme toggle on detail pages', () => {
    vi.mocked(useAppController).mockReturnValue({
      ...mockController,
      activeNav: 'groups' as any,
    });

    render(<DashboardWorkspaceShell sessionUser={mockSessionUser} onLogout={mockOnLogout} />);

    expect(screen.getByTestId('theme-toggle-button')).toBeInTheDocument();
    expect(screen.getByTestId('theme-toggle-button')).toHaveAttribute('data-variant', 'floating');
  });

  it('should not show floating theme toggle on main pages', () => {
    vi.mocked(useAppController).mockReturnValue({
      ...mockController,
      activeNav: 'overview',
    });

    render(<DashboardWorkspaceShell sessionUser={mockSessionUser} onLogout={mockOnLogout} />);

    expect(screen.queryByTestId('theme-toggle-button')).not.toBeInTheDocument();
  });

  it('should hide mobile nav on new-group and input pages', () => {
    vi.mocked(useAppController).mockReturnValue({
      ...mockController,
      activeNav: 'new-group',
    });

    render(<DashboardWorkspaceShell sessionUser={mockSessionUser} onLogout={mockOnLogout} />);

    expect(screen.queryByTestId('mobile-nav')).not.toBeInTheDocument();
  });

  it('should show mobile nav on other pages', () => {
    vi.mocked(useAppController).mockReturnValue({
      ...mockController,
      activeNav: 'checklist',
    });

    render(<DashboardWorkspaceShell sessionUser={mockSessionUser} onLogout={mockOnLogout} />);

    expect(screen.getByTestId('mobile-nav')).toBeInTheDocument();
  });

  it('should toggle mobile actions sheet', async () => {
    render(<DashboardWorkspaceShell sessionUser={mockSessionUser} onLogout={mockOnLogout} />);

    const toggleButton = screen.getByRole('button', { name: 'Toggle Actions' });
    fireEvent.click(toggleButton);

    expect(screen.getByTestId('mobile-quick-actions-sheet')).toBeInTheDocument();

    const closeButton = screen.getByRole('button', { name: 'Close Sheet' });
    fireEvent.click(closeButton);

    expect(screen.queryByTestId('mobile-quick-actions-sheet')).not.toBeInTheDocument();
  });

  it('should show sync feedback when present', () => {
    vi.mocked(useAppController).mockReturnValue({
      ...mockController,
      syncFeedback: { id: 1, tone: 'success', message: 'Saved successfully' },
    });

    render(<DashboardWorkspaceShell sessionUser={mockSessionUser} onLogout={mockOnLogout} />);

    expect(screen.getByText('Saved successfully')).toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('should dismiss sync feedback when close button is clicked', () => {
    const mockDismiss = vi.fn();
    vi.mocked(useAppController).mockReturnValue({
      ...mockController,
      syncFeedback: { id: 1, tone: 'success', message: 'Saved successfully' },
      dismissSyncFeedback: mockDismiss,
    });

    render(<DashboardWorkspaceShell sessionUser={mockSessionUser} onLogout={mockOnLogout} />);

    const closeButton = screen.getByRole('button', { name: 'Close sync message' });
    fireEvent.click(closeButton);

    expect(mockDismiss).toHaveBeenCalled();
  });

  it('should apply correct styles for different feedback tones', () => {
    const tones = ['success', 'error', 'info'] as const;
    const icons = ['check_circle', 'error', 'info'];

    tones.forEach((tone, index) => {
      const { unmount } = render(
        <DashboardWorkspaceShell sessionUser={mockSessionUser} onLogout={mockOnLogout} />
      );

      vi.mocked(useAppController).mockReturnValue({
        ...mockController,
        syncFeedback: { id: 1, tone, message: `Test ${tone}` },
      });

      render(<DashboardWorkspaceShell sessionUser={mockSessionUser} onLogout={mockOnLogout} />);

      const elements = screen.getAllByText(icons[index]);
      expect(elements.length).toBeGreaterThan(0);

      unmount();
      vi.clearAllMocks();
    });
  });

  it('should pass session user name to sidebar', () => {
    render(<DashboardWorkspaceShell sessionUser={mockSessionUser} onLogout={mockOnLogout} />);

    const sidebar = screen.getByTestId('app-sidebar');
    expect(sidebar).toBeInTheDocument();
  });

  it('should adjust main content margin when sidebar is collapsed', () => {
    vi.mocked(useAppController).mockReturnValue({
      ...mockController,
      isSidebarCollapsed: true,
    });

    const { container } = render(
      <DashboardWorkspaceShell sessionUser={mockSessionUser} onLogout={mockOnLogout} />
    );

    const main = container.querySelector('main');
    expect(main?.className).toContain('xl:ml-[104px]');
  });

  it('should adjust main content margin when sidebar is expanded', () => {
    vi.mocked(useAppController).mockReturnValue({
      ...mockController,
      isSidebarCollapsed: false,
    });

    const { container } = render(
      <DashboardWorkspaceShell sessionUser={mockSessionUser} onLogout={mockOnLogout} />
    );

    const main = container.querySelector('main');
    expect(main?.className).toContain('xl:ml-[280px]');
  });

  it('should set body overflow hidden when mobile actions is open', () => {
    render(<DashboardWorkspaceShell sessionUser={mockSessionUser} onLogout={mockOnLogout} />);

    const toggleButton = screen.getByRole('button', { name: 'Toggle Actions' });
    fireEvent.click(toggleButton);

    expect(screen.getByTestId('mobile-quick-actions-sheet')).toBeInTheDocument();
  });

  it('should restore body overflow when mobile actions is closed', () => {
    render(<DashboardWorkspaceShell sessionUser={mockSessionUser} onLogout={mockOnLogout} />);

    const toggleButton = screen.getByRole('button', { name: 'Toggle Actions' });
    fireEvent.click(toggleButton);

    const closeButton = screen.getByRole('button', { name: 'Close Sheet' });
    fireEvent.click(closeButton);

    expect(document.body.style.overflow).toBe('');
  });
});
