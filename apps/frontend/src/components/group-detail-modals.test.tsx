import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  UnlinkGroupConfirmModal,
  DeleteConfirmModal,
  DeleteGroupModal,
  MusyrifModal,
  NoteModal,
  GroupEditModal,
  ScheduleModal,
  EditScheduleModal,
} from './group-detail-modals';
import type { ItineraryItem } from '../shared/app-domain';

// Mock hooks
vi.mock('../hooks/use-saudi-city-options', () => ({
  useSaudiCityOptions: () => ['Makkah', 'Madinah', 'Jeddah'],
}));

// Mock only the hooks that make API calls
vi.mock('../hooks/use-saudi-city-options', () => ({
  useSaudiCityOptions: () => ['Makkah', 'Madinah', 'Jeddah'],
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

  it('should toggle pinned state when clicking pin toggle', async () => {
    const user = userEvent.setup();
    render(<NoteModal {...defaultProps} />);

    const pinButton = screen.getByText('Pin to top of group feed').closest('button');
    await user.click(pinButton!);

    await waitFor(() => {
      expect(pinButton).toHaveAttribute('aria-pressed', 'true');
    });
  });

  it('should toggle pinned state when clicking pin toggle', async () => {
    const user = userEvent.setup();
    render(<NoteModal {...defaultProps} />);

    const pinToggle = screen.getByText('Pin to top of group feed').closest('button');
    expect(pinToggle).toHaveAttribute('aria-pressed', 'false');

    await user.click(pinToggle!);

    await waitFor(() => {
      expect(pinToggle).toHaveAttribute('aria-pressed', 'true');
    });
  });

  it('should show character counter', () => {
    render(<NoteModal {...defaultProps} />);
    expect(screen.getByText('0/2000')).toBeInTheDocument();
  });

  it('should show pin toggle label', () => {
    render(<NoteModal {...defaultProps} />);
    expect(screen.getByText('Pin to top of group feed')).toBeInTheDocument();
    expect(screen.getByText('Visible to all operators')).toBeInTheDocument();
  });
});

describe('GroupEditModal', () => {
  const defaultProps = {
    groupCode: 'GRP-001',
    groupName: 'Test Group',
    groupPax: 45,
    requiredBusCount: 2,
    arrivalDate: '2024-03-15',
    returnDate: '2024-03-25',
    onClose: vi.fn(),
    onSave: vi.fn().mockResolvedValue({ ok: true }),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render modal with form fields', () => {
    render(<GroupEditModal {...defaultProps} />);

    expect(screen.getByText('Edit Group')).toBeInTheDocument();
    expect(screen.getByLabelText('Group Number')).toBeInTheDocument();
    expect(screen.getByLabelText('Group Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Total Pax')).toBeInTheDocument();
    expect(screen.getByLabelText('Required Bus')).toBeInTheDocument();
  });

  it('should populate form with initial values', () => {
    render(<GroupEditModal {...defaultProps} />);

    expect(screen.getByLabelText('Group Number')).toHaveValue('GRP-001');
    expect(screen.getByLabelText('Group Name')).toHaveValue('Test Group');
    expect(screen.getByLabelText('Total Pax')).toHaveValue(45);
    expect(screen.getByLabelText('Required Bus')).toHaveValue(2);
  });

  it('should have correct aria attributes', () => {
    render(<GroupEditModal {...defaultProps} />);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'group-edit-title');
  });

  it('should call onSave with form values when valid', async () => {
    const user = userEvent.setup();
    render(<GroupEditModal {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => {
      expect(defaultProps.onSave).toHaveBeenCalledWith({
        code: 'GRP-001',
        name: 'Test Group',
        pax: 45,
        totalBuses: 2,
        arrivalDate: '2024-03-15',
        returnDate: '2024-03-25',
        parentGroupId: null,
      });
    });
  });

  it('should show validation error when code is empty', async () => {
    const user = userEvent.setup();
    render(<GroupEditModal {...defaultProps} />);

    const codeInput = screen.getByLabelText('Group Number');
    await user.clear(codeInput);
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => {
      expect(screen.getByText('Group number tidak boleh kosong.')).toBeInTheDocument();
    });
  });

  it('should show validation error when name is empty', async () => {
    const user = userEvent.setup();
    render(<GroupEditModal {...defaultProps} />);

    const nameInput = screen.getByLabelText('Group Name');
    await user.clear(nameInput);
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => {
      expect(screen.getByText('Group name tidak boleh kosong.')).toBeInTheDocument();
    });
  });

  it('should show validation error when pax is empty', async () => {
    const user = userEvent.setup();
    render(<GroupEditModal {...defaultProps} />);

    const paxInput = screen.getByLabelText('Total Pax');
    await user.clear(paxInput);
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => {
      expect(screen.getByText('Total pax wajib diisi.')).toBeInTheDocument();
    });
  });

  it('should render Start Date and End Date fields', () => {
    render(<GroupEditModal {...defaultProps} />);

    expect(screen.getByText('Start Date')).toBeInTheDocument();
    expect(screen.getByText('End Date')).toBeInTheDocument();
  });

  it('should call onClose when Cancel button is clicked', async () => {
    const user = userEvent.setup();
    render(<GroupEditModal {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('should render parent group select', () => {
    render(<GroupEditModal {...defaultProps} />);

    expect(screen.getByText('Ikuti data dari Group (Sharing Musyrif & Itinerary)')).toBeInTheDocument();
  });

  it('should render groups in parent group select', () => {
    const groups = [
      { id: '1', code: 'GRP-002', name: 'Group 2' },
      { id: '2', code: 'GRP-003', name: 'Group 3' },
    ];
    render(<GroupEditModal {...defaultProps} groups={groups} />);

    // SereneSelect uses a button trigger with aria-haspopup="listbox"
    // The button displays the selected value text
    const parentSelectButtons = screen.getAllByRole('button', { hidden: true });
    const parentSelect = parentSelectButtons.find(btn => btn.getAttribute('aria-haspopup') === 'listbox');
    expect(parentSelect).toBeInTheDocument();
  });

  it('should update form when props change', () => {
    const { rerender } = render(<GroupEditModal {...defaultProps} />);

    rerender(<GroupEditModal {...defaultProps} groupName="Updated Group" />);

    expect(screen.getByLabelText('Group Name')).toHaveValue('Updated Group');
  });
});

describe('ScheduleModal', () => {
  const defaultProps = {
    form: {
      category: 'arrival' as const,
      date: '2024-03-15',
      time: '14:30',
      flightNumber: 'SV-827',
      from: 'Jeddah',
      to: 'Makkah',
      hotelName: 'Swissotel Al Maqam',
      cityTourCity: '',
      fromHotelName: '',
      transferByTrain: false,
      trainDepartureTime: '',
      destinationPickupTime: '',
      hotelPickupRequestTime: '',
      note: '',
      highlighted: false,
    },
    isSaveDisabled: false,
    showFridayCityTourWarning: false,
    onChange: vi.fn(),
    onClose: vi.fn(),
    onSave: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render modal with activity type buttons', () => {
    render(<ScheduleModal {...defaultProps} />);

    expect(screen.getByText('Add New Schedule')).toBeInTheDocument();
    expect(screen.getByText('Activity Type')).toBeInTheDocument();
  });

  it('should have correct aria attributes', () => {
    render(<ScheduleModal {...defaultProps} />);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'schedule-modal-title');
  });

  it('should render date and time inputs', () => {
    render(<ScheduleModal {...defaultProps} />);

    expect(screen.getByText('Date')).toBeInTheDocument();
    expect(screen.getByText('Time')).toBeInTheDocument();
  });

  it('should render hotel name field for arrival category', () => {
    render(<ScheduleModal {...defaultProps} />);

    expect(screen.getByText('Hotel Name')).toBeInTheDocument();
  });

  it('should show warning when isSaveDisabled is true', () => {
    render(<ScheduleModal {...defaultProps} isSaveDisabled={true} />);

    expect(screen.getByText('Complete all required schedule fields before saving.')).toBeInTheDocument();
  });

  it('should call onSave when Save Schedule button is clicked', async () => {
    const user = userEvent.setup();
    render(<ScheduleModal {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: 'Save Schedule' }));

    expect(defaultProps.onSave).toHaveBeenCalled();
  });

  it('should disable Save button when isSaveDisabled is true', () => {
    render(<ScheduleModal {...defaultProps} isSaveDisabled={true} />);

    const saveButton = screen.getByRole('button', { name: 'Save Schedule' });
    expect(saveButton).toBeDisabled();
  });

  it('should call onClose when Cancel button is clicked', async () => {
    const user = userEvent.setup();
    render(<ScheduleModal {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('should render note textarea', () => {
    render(<ScheduleModal {...defaultProps} />);

    expect(screen.getByText('Operational Note')).toBeInTheDocument();
  });

  it('should render highlight toggle', () => {
    render(<ScheduleModal {...defaultProps} />);

    expect(screen.getByText('Highlight in itinerary')).toBeInTheDocument();
  });

  it('should call onChange when category button is clicked', async () => {
    const user = userEvent.setup();
    render(<ScheduleModal {...defaultProps} />);

    const departureButton = screen.getByText('Departure');
    await user.click(departureButton);

    expect(defaultProps.onChange).toHaveBeenCalledWith('category', 'departure');
  });

  it('should render transfer-specific fields for transfer category', () => {
    render(<ScheduleModal {...defaultProps} form={{ ...defaultProps.form, category: 'transfer' }} />);

    expect(screen.getByText('Transfer using High-Speed Train (HHR)')).toBeInTheDocument();
  });

  it('should render city tour fields for city-tour category', () => {
    render(<ScheduleModal {...defaultProps} form={{ ...defaultProps.form, category: 'city-tour' }} />);

    expect(screen.getByText('City Tour City')).toBeInTheDocument();
  });

  it('should show Friday warning when showFridayCityTourWarning is true', () => {
    render(<ScheduleModal {...defaultProps} showFridayCityTourWarning={true} />);

    expect(screen.getByText('City Tour on Friday detected - please confirm timing around Jumu\'ah prayer.')).toBeInTheDocument();
  });
});

describe('EditScheduleModal', () => {
  const defaultProps = {
    form: {
      id: '123',
      category: 'arrival' as const,
      date: '2024-03-15',
      time: '14:30',
      flightNumber: 'SV-827',
      from: 'Jeddah',
      to: 'Makkah',
      hotelName: 'Swissotel Al Maqam',
      cityTourCity: '',
      fromHotelName: '',
      transferByTrain: false,
      trainDepartureTime: '',
      destinationPickupTime: '',
      hotelPickupRequestTime: '',
      requiresBus: false,
      notes: '',
    },
    isSaveDisabled: false,
    showFridayCityTourWarning: false,
    onChange: vi.fn(),
    onClose: vi.fn(),
    onSave: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render modal with activity type buttons', () => {
    render(<EditScheduleModal {...defaultProps} />);

    expect(screen.getByText('Edit Schedule')).toBeInTheDocument();
    expect(screen.getByText('Activity Type')).toBeInTheDocument();
  });

  it('should have correct aria attributes', () => {
    render(<EditScheduleModal {...defaultProps} />);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'edit-schedule-title');
  });

  it('should render date and time inputs', () => {
    render(<EditScheduleModal {...defaultProps} />);

    expect(screen.getByText('Date')).toBeInTheDocument();
  });

  it('should render hotel name field for arrival category', () => {
    render(<EditScheduleModal {...defaultProps} />);

    expect(screen.getByText('Hotel Name')).toBeInTheDocument();
  });

  it('should show warning when isSaveDisabled is true', () => {
    render(<EditScheduleModal {...defaultProps} isSaveDisabled={true} />);

    expect(screen.getByText('Complete all required schedule fields before saving.')).toBeInTheDocument();
  });

  it('should call onSave when Save Changes button is clicked', async () => {
    const user = userEvent.setup();
    render(<EditScheduleModal {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    expect(defaultProps.onSave).toHaveBeenCalled();
  });

  it('should disable Save button when isSaveDisabled is true', () => {
    render(<EditScheduleModal {...defaultProps} isSaveDisabled={true} />);

    const saveButton = screen.getByRole('button', { name: 'Save Changes' });
    expect(saveButton).toBeDisabled();
  });

  it('should call onClose when Cancel button is clicked', async () => {
    const user = userEvent.setup();
    render(<EditScheduleModal {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('should render requiresBus checkbox', () => {
    render(<EditScheduleModal {...defaultProps} />);

    expect(screen.getByText('Requires Bus')).toBeInTheDocument();
  });

  it('should render notes textarea', () => {
    render(<EditScheduleModal {...defaultProps} />);

    expect(screen.getByText('Notes')).toBeInTheDocument();
  });

  it('should call onChange when category button is clicked', async () => {
    const user = userEvent.setup();
    render(<EditScheduleModal {...defaultProps} />);

    const departureButton = screen.getByText('Departure');
    await user.click(departureButton);

    expect(defaultProps.onChange).toHaveBeenCalledWith('category', 'departure');
  });

  it('should render transfer-specific fields for transfer category', () => {
    render(<EditScheduleModal {...defaultProps} form={{ ...defaultProps.form, category: 'transfer' }} />);

    expect(screen.getByText('Transfer using High-Speed Train (HHR)')).toBeInTheDocument();
  });

  it('should render city tour fields for city-tour category', () => {
    render(<EditScheduleModal {...defaultProps} form={{ ...defaultProps.form, category: 'city-tour' }} />);

    expect(screen.getByText('City Tour City')).toBeInTheDocument();
  });

  it('should show Friday warning when showFridayCityTourWarning is true', () => {
    render(<EditScheduleModal {...defaultProps} showFridayCityTourWarning={true} />);

    expect(screen.getByText('City Tour on Friday detected - please confirm timing around Jumu\'ah prayer.')).toBeInTheDocument();
  });

  it('should show "Bus Required (Luggage + Station Pickup)" when transferByTrain is true', () => {
    render(
      <EditScheduleModal
        {...defaultProps}
        form={{ ...defaultProps.form, category: 'transfer', transferByTrain: true }}
      />
    );

    expect(screen.getByText('Bus Required (Luggage + Station Pickup)')).toBeInTheDocument();
  });
});
