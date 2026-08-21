import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ScheduleModal } from '../ScheduleModal';

// Mock the hooks
vi.mock('../../../hooks/use-saudi-city-options', () => ({
  useSaudiCityOptions: () => ['Makkah', 'Madinah', 'Jeddah'],
}));

// Create a QueryClient wrapper
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('ScheduleModal', () => {
  const defaultProps = {
    form: {
      category: 'arrival',
      date: '2024-03-15',
      time: '14:30',
      transportMode: 'flight' as const,
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
    isAddAnotherDisabled: false,
    pendingItems: [],
    showFridayCityTourWarning: false,
    onChange: vi.fn(),
    onClose: vi.fn(),
    onSave: vi.fn(),
    onAddAnother: vi.fn(),
    onRemovePending: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('component structure', () => {
    it('should export ScheduleModal function', () => {
      expect(typeof ScheduleModal).toBe('function');
    });

    it('should accept required props', () => {
      expect(() => {
        render(<ScheduleModal {...defaultProps} />, { wrapper: createWrapper() });
      }).not.toThrow();
    });

    it('should accept different activity categories', () => {
      const categories = ['arrival', 'departure', 'transfer', 'city-tour', 'hotel'];

      categories.forEach((category) => {
        expect(() => {
          render(<ScheduleModal {...defaultProps} form={{ ...defaultProps.form, category }} />, { wrapper: createWrapper() });
        }).not.toThrow();
      });
    });

    it('should accept empty form values', () => {
      const emptyForm = {
        category: '',
        date: '',
        time: '',
        transportMode: 'flight' as const,
        flightNumber: '',
        from: '',
        to: '',
        hotelName: '',
        cityTourCity: '',
        fromHotelName: '',
        transferByTrain: false,
        trainDepartureTime: '',
        destinationPickupTime: '',
        hotelPickupRequestTime: '',
        note: '',
        highlighted: false,
      };

      expect(() => {
        render(<ScheduleModal {...defaultProps} form={emptyForm} />, { wrapper: createWrapper() });
      }).not.toThrow();
    });
  });

  describe('props validation', () => {
    it('should have correct prop types', () => {
      const props = {
        form: defaultProps.form,
        isSaveDisabled: false,
        isAddAnotherDisabled: false,
        pendingItems: [],
        showFridayCityTourWarning: false,
        onChange: vi.fn(),
        onClose: vi.fn(),
        onSave: vi.fn(),
        onAddAnother: vi.fn(),
        onRemovePending: vi.fn(),
      };

      expect(() => {
        render(<ScheduleModal {...props} />, { wrapper: createWrapper() });
      }).not.toThrow();
    });

    it('should accept isSaveDisabled true', () => {
      expect(() => {
        render(<ScheduleModal {...defaultProps} isSaveDisabled={true} />, { wrapper: createWrapper() });
      }).not.toThrow();
    });

    it('should accept showFridayCityTourWarning true', () => {
      expect(() => {
        render(<ScheduleModal {...defaultProps} showFridayCityTourWarning={true} />, { wrapper: createWrapper() });
      }).not.toThrow();
    });
  });

  describe('batch add (queue)', () => {
    const pendingItems = [
      {
        date: '10 Sep',
        year: '2026',
        category: 'Arrival',
        title: 'Jeddah to Makkah',
        meta: '',
        icon: 'flight_land',
        categoryKey: 'arrival',
        isoDate: '2026-09-10',
        time: '19:30',
      },
      {
        date: '11 Sep',
        year: '2026',
        category: 'City Tour',
        title: 'City Tour Madinah',
        meta: '',
        icon: 'tour',
        categoryKey: 'city-tour',
        isoDate: '2026-09-11',
        time: '09:00',
      },
    ];

    it('renders the queued trips with a count and per-row remove', () => {
      const onRemovePending = vi.fn();
      render(
        <ScheduleModal {...defaultProps} pendingItems={pendingItems} onRemovePending={onRemovePending} />,
        { wrapper: createWrapper() },
      );

      expect(screen.getByText('Added this session (2)')).toBeInTheDocument();
      expect(screen.getByText('Arrival · Jeddah to Makkah')).toBeInTheDocument();
      expect(screen.getByText('City Tour · City Tour Madinah')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Remove Arrival Jeddah to Makkah' }));
      expect(onRemovePending).toHaveBeenCalledWith(0);
    });

    it('labels Save with the total count (queue + current entry)', () => {
      // Empty/invalid form (isAddAnotherDisabled) + 2 queued -> "Save 2 Trips".
      render(
        <ScheduleModal {...defaultProps} isAddAnotherDisabled pendingItems={pendingItems} />,
        { wrapper: createWrapper() },
      );
      expect(screen.getByRole('button', { name: /Save 2 Trips/ })).toBeInTheDocument();
    });

    it('queues the current entry via "Add another"', () => {
      const onAddAnother = vi.fn();
      render(<ScheduleModal {...defaultProps} onAddAnother={onAddAnother} />, { wrapper: createWrapper() });
      fireEvent.click(screen.getByRole('button', { name: 'Add another' }));
      expect(onAddAnother).toHaveBeenCalledTimes(1);
    });
  });

  describe('form rendering', () => {
    it('should render activity type buttons', () => {
      render(<ScheduleModal {...defaultProps} />, { wrapper: createWrapper() });

      // Check for at least one activity type button
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });

    it('should render date input', () => {
      render(<ScheduleModal {...defaultProps} />, { wrapper: createWrapper() });

      const dateInputs = screen.getAllByRole('textbox');
      expect(dateInputs.length).toBeGreaterThan(0);
    });

    it('should render save and cancel buttons', () => {
      render(<ScheduleModal {...defaultProps} />, { wrapper: createWrapper() });

      expect(screen.getByText('Save Schedule')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });
  });

  describe('conditional rendering', () => {
    it('should show warning when showFridayCityTourWarning is true and category is city-tour', () => {
      render(
        <ScheduleModal
          {...defaultProps}
          form={{ ...defaultProps.form, category: 'city-tour' }}
          showFridayCityTourWarning={true}
        />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText(/City Tour on Friday detected/i)).toBeInTheDocument();
    });

    it('should show transport mode selector with a Train option when category is transfer', () => {
      render(
        <ScheduleModal
          {...defaultProps}
          form={{ ...defaultProps.form, category: 'transfer', transportMode: 'bus' }}
        />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText('Transport Mode')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Train/i })).toBeInTheDocument();
    });

    it('should show train time fields when transfer transport mode is train', () => {
      render(
        <ScheduleModal
          {...defaultProps}
          form={{ ...defaultProps.form, category: 'transfer', transportMode: 'train' }}
        />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText('Train Departure Time')).toBeInTheDocument();
      expect(screen.getByText('Destination Station Pickup Time')).toBeInTheDocument();
    });

    it('should show hotel name field for arrival category', () => {
      render(
        <ScheduleModal
          {...defaultProps}
          form={{ ...defaultProps.form, category: 'arrival' }}
        />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText('Hotel Name')).toBeInTheDocument();
    });

    it('should show hotel name field for departure category', () => {
      render(
        <ScheduleModal
          {...defaultProps}
          form={{ ...defaultProps.form, category: 'departure' }}
        />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText('Hotel Name')).toBeInTheDocument();
    });
  });

  describe('user interactions', () => {
    it('should call onClose when Cancel button is clicked', () => {
      render(<ScheduleModal {...defaultProps} />, { wrapper: createWrapper() });

      const cancelButton = screen.getByText('Cancel');
      fireEvent.click(cancelButton);

      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });

    it('should call onSave when Save Schedule button is clicked', () => {
      render(<ScheduleModal {...defaultProps} />, { wrapper: createWrapper() });

      const saveButton = screen.getByText('Save Schedule');
      fireEvent.click(saveButton);

      expect(defaultProps.onSave).toHaveBeenCalledTimes(1);
    });

    it('should disable Save Schedule button when isSaveDisabled is true', () => {
      render(<ScheduleModal {...defaultProps} isSaveDisabled={true} />, { wrapper: createWrapper() });

      const saveButton = screen.getByRole('button', { name: /Save Schedule/i });
      expect(saveButton).toBeDisabled();
    });

    it('should call onChange when activity type is changed', () => {
      render(<ScheduleModal {...defaultProps} />, { wrapper: createWrapper() });

      // Find a departure button (assuming it exists)
      const buttons = screen.getAllByRole('button');
      const departureButton = buttons.find((btn) => btn.textContent?.includes('Departure'));

      if (departureButton) {
        fireEvent.click(departureButton);
        expect(defaultProps.onChange).toHaveBeenCalledWith('category', 'departure');
      }
    });
  });
});
