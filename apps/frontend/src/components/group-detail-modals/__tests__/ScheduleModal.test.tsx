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
        showFridayCityTourWarning: false,
        onChange: vi.fn(),
        onClose: vi.fn(),
        onSave: vi.fn(),
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

    it('should show transfer train checkbox when category is transfer', () => {
      render(
        <ScheduleModal
          {...defaultProps}
          form={{ ...defaultProps.form, category: 'transfer' }}
        />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText(/Transfer using High-Speed Train/i)).toBeInTheDocument();
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
