import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GroupCard } from './group-card';
import type { GroupData } from '../shared/app-domain';

// Mock the domain functions
vi.mock('../shared/app-domain', async () => {
  const actual = await vi.importActual('../shared/app-domain');
  return {
    ...actual,
    resolveGroupCompleteness: vi.fn(() => ({
      state: 'ready' as const,
      badgeLabel: 'Ready',
      isReadyForOperations: true,
      issues: [],
      primaryMessage: '',
    })),
    resolveTotalBusCount: vi.fn(() => 2),
    inferCategoryKey: vi.fn(() => 'arrival'),
    getItineraryIsoDate: vi.fn(() => '2026-04-15'),
    getScheduleTypeOption: vi.fn(() => ({ cardLabel: 'Arrival' })),
    formatScheduleTime: vi.fn((time: string) => time || '08:00'),
    parseDisplayDateToIso: vi.fn(() => '2026-04-15'),
    parseTimeForInput: vi.fn(() => '08:00'),
  };
});

describe('GroupCard', () => {
  const mockGroup: GroupData = {
    id: 'group-1',
    code: 'GRP001',
    name: 'Test Group',
    status: 'active',
    lifecycleStatus: 'ACTIVE',
    tone: 'active',
    pax: 30,
    totalBuses: 2,
    packageName: 'Umrah Premium',
    arrivalDate: '2026-04-15',
    returnDate: '2026-04-25',
    itinerary: [
      {
        id: 'itin-1',
        date: '15 Apr',
        year: '2026',
        category: 'arrival',
        title: 'Arrival in Jeddah',
        from: 'CGK',
        to: 'JED',
        time: '08:00',
        meta: '08:00 | Flight SV123',
        highlighted: false,
        fromHotel: '',
        toHotel: '',
        cityTourCity: '',
        busCount: 0,
        trainTransfer: null,
      },
    ],
    visaSetup: {
      status: 'Issued',
      paymentStatus: 'Paid',
      syarikah: 'Al-Tayyar',
      busStatus: 'Visa+',
      hotels: {
        makkah: [],
        madinah: [],
      },
    },
    nextActivity: {
      title: 'Arrival in Jeddah',
      scheduledAt: '2026-04-15T08:00:00',
    },
    musyrif: null,
    notes: [],
    timeline: [],
    checklist: [],
  };

  it('renders group card with basic info', () => {
    render(<GroupCard group={mockGroup} onOpenDetail={() => {}} />);
    expect(screen.getByText('GRP001')).toBeInTheDocument();
    expect(screen.getByText('Test Group')).toBeInTheDocument();
  });

  it('displays pax count', () => {
    render(<GroupCard group={mockGroup} onOpenDetail={() => {}} />);
    expect(screen.getByText('30 Pax')).toBeInTheDocument();
  });

  it('displays package name', () => {
    render(<GroupCard group={mockGroup} onOpenDetail={() => {}} />);
    expect(screen.getByText('Umrah Premium Package')).toBeInTheDocument();
  });

  it('displays visa type', () => {
    render(<GroupCard group={mockGroup} onOpenDetail={() => {}} />);
    expect(screen.getByText('Visa+')).toBeInTheDocument();
  });

  it('displays bus count when bus service is available', () => {
    render(<GroupCard group={mockGroup} onOpenDetail={() => {}} />);
    expect(screen.getByText(/2 Bus/)).toBeInTheDocument();
  });

  it('renders View Detail button', () => {
    render(<GroupCard group={mockGroup} onOpenDetail={() => {}} />);
    expect(screen.getByText('View Detail')).toBeInTheDocument();
  });

  it('displays Active badge for active groups', () => {
    render(<GroupCard group={mockGroup} onOpenDetail={() => {}} />);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('displays Ready badge for ready groups', () => {
    render(<GroupCard group={mockGroup} onOpenDetail={() => {}} />);
    expect(screen.getByText('Ready')).toBeInTheDocument();
  });

  it('displays itinerary preview', () => {
    render(<GroupCard group={mockGroup} onOpenDetail={() => {}} />);
    expect(screen.getByText('Itinerary Preview')).toBeInTheDocument();
  });

  it('handles group without package name', () => {
    const groupWithoutPackage = { ...mockGroup, packageName: '' };
    render(<GroupCard group={groupWithoutPackage} onOpenDetail={() => {}} />);
    expect(screen.queryByText(/Package/)).not.toBeInTheDocument();
  });

  it('handles group without visa setup', () => {
    const groupWithoutVisa = { ...mockGroup, visaSetup: undefined };
    render(<GroupCard group={groupWithoutVisa} onOpenDetail={() => {}} />);
    expect(screen.queryByText('Visa+')).not.toBeInTheDocument();
  });

  it('handles inactive group', () => {
    const inactiveGroup = { ...mockGroup, tone: 'inactive' as const };
    render(<GroupCard group={inactiveGroup} onOpenDetail={() => {}} />);
    expect(screen.getByText('Inactive')).toBeInTheDocument();
  });
});
