import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  UnlinkGroupConfirmModal,
  DeleteConfirmModal,
  DeleteGroupModal,
  MusyrifModal,
  NoteModal,
} from './group-detail-modals';
import type { ItineraryItem } from '../shared/app-domain';

// Mock hooks
vi.mock('../hooks/use-saudi-city-options', () => ({
  useSaudiCityOptions: () => ['Makkah', 'Madinah', 'Jeddah'],
}));

// Mock domain functions
vi.mock('../shared/app-domain', () => ({
  getMinimumBusCountForPax: vi.fn((pax: number) => Math.ceil(pax / 45)),
  getRouteFieldConfigByCategory: vi.fn(() => ({
    fromLabel: 'From',
    toLabel: 'To',
    fromPlaceholder: 'Enter origin',
    toPlaceholder: 'Enter destination',
    helperText: '',
  })),
  isCityTourActivityType: vi.fn(() => false),
  isFlightActivityType: vi.fn(() => false),
  isTransferActivityType: vi.fn(() => false),
  normalizeSaudiCityValue: vi.fn((val: string) => val),
  saudiCityOptions: ['Makkah', 'Madinah', 'Jeddah'],
  scheduleTypeOptions: [
    { value: 'arrival', label: 'Arrival', modalLabel: 'Arrival', icon: 'flight_land' },
    { value: 'departure', label: 'Departure', modalLabel: 'Departure', icon: 'flight_takeoff' },
    { value: 'transfer', label: 'Transfer', modalLabel: 'Transfer', icon: 'swap_horiz' },
    { value: 'city-tour', label: 'City Tour', modalLabel: 'City Tour', icon: 'location_city' },
  ],
}));

describe('UnlinkGroupConfirmModal', () => {
  const defaultProps = {
    groupCode: 'G-123',
    onClose: vi.fn(),
    onConfirm: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render modal with correct title and message', () => {
    render(<UnlinkGroupConfirmModal {...defaultProps} />);

    expect(screen.getByText('Pisahkan dari grup utama?')).toBeInTheDocument();
    expect(screen.getByText('G-123')).toBeInTheDocument();
  });

  it('should have correct aria attributes', () => {
    render(<UnlinkGroupConfirmModal {...defaultProps} />);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'unlink-group-title');
  });

  it('should call onConfirm when Pisahkan Grup button is clicked', async () => {
    const user = userEvent.setup();
    render(<UnlinkGroupConfirmModal {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: 'Pisahkan Grup' }));

    expect(defaultProps.onConfirm).toHaveBeenCalled();
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('should call onClose when Batalkan button is clicked', async () => {
    const user = userEvent.setup();
    render(<UnlinkGroupConfirmModal {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: 'Batalkan' }));

    expect(defaultProps.onClose).toHaveBeenCalled();
    expect(defaultProps.onConfirm).not.toHaveBeenCalled();
  });

  it('should call onClose when overlay is clicked', async () => {
    const user = userEvent.setup();
    render(<UnlinkGroupConfirmModal {...defaultProps} />);

    const overlay = screen.getByRole('dialog').parentElement;
    await user.click(overlay!);

    expect(defaultProps.onClose).toHaveBeenCalled();
  });
});

describe('DeleteConfirmModal', () => {
  const mockItem: ItineraryItem = {
    date: '15',
    year: '2024',
    time: '08:00',
    category: 'arrival',
    title: 'Arrival at Jeddah',
    meta: 'From JED to Makkah',
    icon: 'flight_land',
    from: 'JED',
    to: 'Makkah',
  };

  const defaultProps = {
    item: mockItem,
    onClose: vi.fn(),
    onConfirm: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render modal with itinerary details', () => {
    render(<DeleteConfirmModal {...defaultProps} />);

    expect(screen.getByText('Delete this itinerary?')).toBeInTheDocument();
    expect(screen.getByText('15 2024')).toBeInTheDocument();
    expect(screen.getByText('Arrival at Jeddah')).toBeInTheDocument();
    expect(screen.getByText('arrival')).toBeInTheDocument();
  });

  it('should have correct aria attributes', () => {
    render(<DeleteConfirmModal {...defaultProps} />);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'delete-itinerary-title');
  });

  it('should call onConfirm when Delete Itinerary button is clicked', async () => {
    const user = userEvent.setup();
    render(<DeleteConfirmModal {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: 'Delete Itinerary' }));

    expect(defaultProps.onConfirm).toHaveBeenCalled();
  });

  it('should call onClose when Cancel button is clicked', async () => {
    const user = userEvent.setup();
    render(<DeleteConfirmModal {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(defaultProps.onClose).toHaveBeenCalled();
    expect(defaultProps.onConfirm).not.toHaveBeenCalled();
  });
});

describe('DeleteGroupModal', () => {
  const defaultProps = {
    groupCode: 'G-123',
    groupName: 'Test Group',
    childGroupCount: 0,
    onClose: vi.fn(),
    onConfirm: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render modal with group details', () => {
    render(<DeleteGroupModal {...defaultProps} />);

    expect(screen.getByText('Delete this group?')).toBeInTheDocument();
    expect(screen.getByText('G-123')).toBeInTheDocument();
    expect(screen.getByText('Test Group')).toBeInTheDocument();
  });

  it('should have correct aria attributes', () => {
    render(<DeleteGroupModal {...defaultProps} />);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'delete-group-title');
  });

  it('should show warning when group has child groups', () => {
    render(<DeleteGroupModal {...defaultProps} childGroupCount={2} />);

    expect(screen.getByText(/This group has 2 linked child groups/)).toBeInTheDocument();
    expect(screen.getByText(/Unlink the child groups before deleting/)).toBeInTheDocument();
  });

  it('should disable Delete button when group has child groups', () => {
    render(<DeleteGroupModal {...defaultProps} childGroupCount={1} />);

    const deleteButton = screen.getByRole('button', { name: 'Delete Group' });
    expect(deleteButton).toBeDisabled();
  });

  it('should enable Delete button when group has no child groups', () => {
    render(<DeleteGroupModal {...defaultProps} childGroupCount={0} />);

    const deleteButton = screen.getByRole('button', { name: 'Delete Group' });
    expect(deleteButton).not.toBeDisabled();
  });

  it('should call onConfirm when Delete Group button is clicked', async () => {
    const user = userEvent.setup();
    render(<DeleteGroupModal {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: 'Delete Group' }));

    expect(defaultProps.onConfirm).toHaveBeenCalled();
  });

  it('should call onClose when Cancel button is clicked', async () => {
    const user = userEvent.setup();
    render(<DeleteGroupModal {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(defaultProps.onClose).toHaveBeenCalled();
    expect(defaultProps.onConfirm).not.toHaveBeenCalled();
  });
});

describe('MusyrifModal', () => {
  const defaultProps = {
    initialValues: {
      name: 'Ahmad Hidayat',
      phone: '+62 812-3456-7890',
    },
    onClose: vi.fn(),
    onSave: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render modal with form fields', () => {
    render(<MusyrifModal {...defaultProps} />);

    expect(screen.getByText('Edit Musyrif')).toBeInTheDocument();
    expect(screen.getByLabelText('Musyrif Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Phone Number')).toBeInTheDocument();
  });

  it('should populate form with initial values', () => {
    render(<MusyrifModal {...defaultProps} />);

    expect(screen.getByLabelText('Musyrif Name')).toHaveValue('Ahmad Hidayat');
    expect(screen.getByLabelText('Phone Number')).toHaveValue('+62 812-3456-7890');
  });

  it('should have correct aria attributes', () => {
    render(<MusyrifModal {...defaultProps} />);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'edit-musyrif-title');
  });

  it('should show validation error when name is empty', async () => {
    const user = userEvent.setup();
    render(<MusyrifModal {...defaultProps} />);

    const nameInput = screen.getByLabelText('Musyrif Name');
    await user.clear(nameInput);
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => {
      expect(screen.getByText('Musyrif name wajib diisi.')).toBeInTheDocument();
    });
  });

  it('should show validation error when phone is empty', async () => {
    const user = userEvent.setup();
    render(<MusyrifModal {...defaultProps} />);

    const phoneInput = screen.getByLabelText('Phone Number');
    await user.clear(phoneInput);
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => {
      expect(screen.getByText('Phone number wajib diisi.')).toBeInTheDocument();
    });
  });

  it('should call onSave with form values when valid', async () => {
    const user = userEvent.setup();
    render(<MusyrifModal {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => {
      expect(defaultProps.onSave).toHaveBeenCalledWith({
        name: 'Ahmad Hidayat',
        phone: '+62 812-3456-7890',
      });
    });
  });

  it('should call onClose when Cancel button is clicked', async () => {
    const user = userEvent.setup();
    render(<MusyrifModal {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('should have aria-invalid on fields with errors', async () => {
    const user = userEvent.setup();
    render(<MusyrifModal {...defaultProps} />);

    const nameInput = screen.getByLabelText('Musyrif Name');
    await user.clear(nameInput);
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => {
      expect(nameInput).toHaveAttribute('aria-invalid', 'true');
    });
  });
});

describe('NoteModal', () => {
  const defaultProps = {
    onClose: vi.fn(),
    onSave: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render modal with form fields', () => {
    render(<NoteModal {...defaultProps} />);

    expect(screen.getByText('Add New Note')).toBeInTheDocument();
    expect(screen.getByText('Operational Note')).toBeInTheDocument();
  });

  it('should show character count', () => {
    render(<NoteModal {...defaultProps} />);
    expect(screen.getByText('0/2000')).toBeInTheDocument();
  });

  it('should have correct aria attributes', () => {
    render(<NoteModal {...defaultProps} />);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'note-modal-title');
  });

  it('should update character count when typing', async () => {
    const user = userEvent.setup();
    render(<NoteModal {...defaultProps} />);

    const textarea = screen.getByRole('textbox');
    await user.type(textarea, 'Test note');

    expect(screen.getByText('9/2000')).toBeInTheDocument();
  });

  it('should show pin toggle', () => {
    render(<NoteModal {...defaultProps} />);
    expect(screen.getByText('Pin to top of group feed')).toBeInTheDocument();
  });

  it('should call onClose when Cancel button is clicked', async () => {
    const user = userEvent.setup();
    render(<NoteModal {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('should call onSave with form values when valid', async () => {
    const user = userEvent.setup();
    render(<NoteModal {...defaultProps} />);

    const textarea = screen.getByRole('textbox');
    await user.type(textarea, 'Test note');
    await user.click(screen.getByRole('button', { name: 'Save Note' }));

    await waitFor(() => {
      expect(defaultProps.onSave).toHaveBeenCalledWith({
        text: 'Test note',
        pinned: false,
      });
    });
  });

  it('should show validation error when note is empty', async () => {
    const user = userEvent.setup();
    render(<NoteModal {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: 'Save Note' }));

    await waitFor(() => {
      expect(screen.getByText('Operational note wajib diisi.')).toBeInTheDocument();
    });
  });
});
