import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppMainContent } from '../app-main-content';
import type { AppController } from '../../hooks/use-app-controller';

// Mock all lazy-loaded pages to avoid loading real implementations
vi.mock('../../pages/new-group-screen', () => ({
  AddGroupWorkspaceScreen: () => <div data-testid="new-group-screen">New Group</div>,
}));

vi.mock('../../pages/checklist-page', () => ({
  ChecklistScreen: () => <div data-testid="checklist-screen">Checklist</div>,
}));

vi.mock('../../pages/agreement-inbox-page', () => ({
  AgreementInboxScreen: () => <div data-testid="agreement-inbox-screen">Agreement Inbox</div>,
}));

vi.mock('../../pages/invoice-list-page', () => ({
  InvoiceScreen: () => <div data-testid="invoice-screen">Invoice</div>,
}));

vi.mock('../../pages/group-detail-page', () => ({
  GroupDetail: () => <div data-testid="group-detail-screen">Group Detail</div>,
}));

vi.mock('../../pages/group-itinerary-builder-page', () => ({
  GroupItineraryBuilderPage: () => <div data-testid="itinerary-builder-screen">Itinerary Builder</div>,
}));

vi.mock('../../pages/overview-page', () => ({
  OverviewScreen: () => <div data-testid="overview-screen">Overview</div>,
}));

vi.mock('../../pages/manage-role-page', () => ({
  UserManagementScreen: () => <div data-testid="user-management-screen">User Management</div>,
}));

vi.mock('../../pages/placeholder-page', () => ({
  PlaceholderScreen: ({ title }: { title: string }) => (
    <div data-testid="placeholder-screen">{title}</div>
  ),
}));

vi.mock('../../pages/profile-page', () => ({
  ProfileScreen: () => <div data-testid="profile-screen">Profile</div>,
}));

vi.mock('../../pages/master-data-page', () => ({
  MasterDataScreen: () => <div data-testid="master-data-screen">Master Data</div>,
}));

vi.mock('../../pages/raudhah-reminder-page', () => ({
  RaudhahReminderScreen: () => <div data-testid="raudhah-reminder-screen">Raudhah Reminder</div>,
}));

vi.mock('../../pages/visa-detail-page', () => ({
  VisaTrackingDetailScreen: () => <div data-testid="visa-detail-screen">Visa Detail</div>,
}));

vi.mock('../../pages/visa-tracking-page', () => ({
  VisaTrackingScreen: () => <div data-testid="visa-tracking-screen">Visa Tracking</div>,
}));

// Mock shared modules
vi.mock('../../shared/app-domain', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as any),
    buildVisaTrackingRowsFromGroups: vi.fn(() => []),
  };
});

vi.mock('../../shared/app-route', () => ({
  buildDashboardPath: vi.fn((path: string) => `/dashboard/${path}`),
}));

const createMockController = (overrides: Partial<AppController> = {}): AppController => ({
  query: '',
  handleQueryChange: vi.fn(),
  filteredGroups: [],
  groupRecords: [],
  isGroupRecordsLoading: false,
  isActiveOnly: false,
  handleToggleActiveOnly: vi.fn(),
  overviewMonthFilter: '',
  overviewMonthOptions: [],
  handleOverviewMonthFilterChange: vi.fn(),
  statCards: [],
  summaryMessage: '',
  handleOpenDetail: vi.fn(),
  selectedGroup: null,
  selectedGroupCode: null,
  selectedVisaGroupCode: null,
  selectedVisaRow: null,
  activeNav: 'overview',
  sessionAccessTier: 'admin',
  isSidebarCollapsed: false,
  toggleSidebarCollapse: vi.fn(),
  syncFeedback: null,
  dismissSyncFeedback: vi.fn(),
  handleNavigate: vi.fn(),
  handleOpenNewGroup: vi.fn(),
  handleOpenVisaDetail: vi.fn(),
  handleUpdateAgreementStatus: vi.fn(),
  handleBackToOverview: vi.fn(),
  handleDeleteGroup: vi.fn(),
  handleSaveGroupDetail: vi.fn(),
  handleSaveGroupItinerary: vi.fn(),
  handlePatchGroupDetail: vi.fn(),
  handleSaveInputGroup: vi.fn(),
  handleSaveGroupIdentity: vi.fn(),
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
  handleBackToVisaTracking: vi.fn(),
  handleSetRaudhahTasrehPrinted: vi.fn(),
  ...overrides,
});

describe('AppMainContent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading fallback when loading and requires detailed records', async () => {
    const controller = createMockController({
      isGroupRecordsLoading: true,
      activeNav: 'visa',
    });

    render(
      <MemoryRouter initialEntries={['/visa']}>
        <AppMainContent controller={controller} />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Loading screen...')).toBeInTheDocument();
    });
  });

  it('renders overview screen on /overview route', async () => {
    const controller = createMockController({ activeNav: 'overview' });

    render(
      <MemoryRouter initialEntries={['/overview']}>
        <AppMainContent controller={controller} />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('overview-screen')).toBeInTheDocument();
    });
  });

  it('renders placeholder when group not found on /groups/:groupCode', async () => {
    const controller = createMockController({
      activeNav: 'overview',
      selectedGroupCode: 'GRP001',
      selectedGroup: null,
    });

    render(
      <MemoryRouter initialEntries={['/groups/GRP001']}>
        <AppMainContent controller={controller} />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('placeholder-screen')).toBeInTheDocument();
      expect(screen.getByText('Group belum ditemukan')).toBeInTheDocument();
    });
  });

  it('renders group detail when group exists on /groups/:groupCode', async () => {
    const controller = createMockController({
      activeNav: 'overview',
      selectedGroupCode: 'GRP001',
      selectedGroup: {
        id: '1',
        code: 'GRP001',
        name: 'Test Group',
        status: 'active',
        lifecycleStatus: 'ACTIVE',
        tone: 'active',
        pax: 30,
        totalBuses: 2,
        packageName: 'Umrah Package',
        durationDays: 10,
        arrivalDate: '2026-04-15',
        returnDate: '2026-04-25',
        itinerary: [],
        visaSetup: undefined,
        nextActivity: { title: '', date: '2026-04-15', time: '08:00', icon: 'flight_land' },
        musyrif: { name: 'Test Musyrif', phone: '12345', avatar: '' },
        notes: [],
        timeline: [
          { date: '15 Apr', title: 'Arrival' },
          { date: '25 Apr', title: 'Return' }
        ],
        checklistAssignments: [],
      },
    });

    render(
      <MemoryRouter initialEntries={['/groups/GRP001']}>
        <AppMainContent controller={controller} />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('group-detail-screen')).toBeInTheDocument();
    });
  });

  it('renders checklist screen on /checklist route', async () => {
    const controller = createMockController({ activeNav: 'checklist' });

    render(
      <MemoryRouter initialEntries={['/checklist']}>
        <AppMainContent controller={controller} />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('checklist-screen')).toBeInTheDocument();
    });
  });

  it('renders placeholder for non-super-admin on /user-management', async () => {
    const controller = createMockController({
      activeNav: 'user-management',
      sessionAccessTier: 'admin',
    });

    render(
      <MemoryRouter initialEntries={['/user-management']}>
        <AppMainContent controller={controller} />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('placeholder-screen')).toBeInTheDocument();
      expect(screen.getByText('Super Admin Only')).toBeInTheDocument();
    });
  });

  it('renders user management screen for super-admin on /user-management', async () => {
    const controller = createMockController({
      activeNav: 'user-management',
      sessionAccessTier: 'super-admin',
    });

    render(
      <MemoryRouter initialEntries={['/user-management']}>
        <AppMainContent controller={controller} />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('user-management-screen')).toBeInTheDocument();
    });
  });

  it('renders profile screen on /profile route', async () => {
    const controller = createMockController({ activeNav: 'profile' });

    render(
      <MemoryRouter initialEntries={['/profile']}>
        <AppMainContent controller={controller} />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('profile-screen')).toBeInTheDocument();
    });
  });

  it('renders placeholder for unknown routes', async () => {
    const controller = createMockController();

    render(
      <MemoryRouter initialEntries={['/unknown-route']}>
        <AppMainContent controller={controller} />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('placeholder-screen')).toBeInTheDocument();
      expect(screen.getByText('Page Not Available')).toBeInTheDocument();
    });
  });
});
