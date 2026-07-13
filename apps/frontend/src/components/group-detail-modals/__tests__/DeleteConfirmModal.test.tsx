import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DeleteConfirmModal } from '../DeleteConfirmModal';

// Mock useModalFocusTrap to avoid DOM focus issues in tests
vi.mock('../use-modal-focus-trap', () => ({
  useModalFocusTrap: () => ({ current: null }),
}));

describe('DeleteConfirmModal', () => {
  const mockOnClose = vi.fn();
  const mockOnConfirm = vi.fn();
  const mockItem = {
    id: '1',
    date: '15',
    month: 'Mar',
    year: '2024',
    title: 'Arrival at Jeddah Airport',
    category: 'Arrival',
    description: 'Group arrives at King Abdulaziz International Airport',
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render modal with correct title', () => {
      render(
        <DeleteConfirmModal
          item={mockItem}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      );

      expect(screen.getByText('Delete this itinerary?')).toBeInTheDocument();
    });

    it('should render warning message', () => {
      render(
        <DeleteConfirmModal
          item={mockItem}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      );

      expect(
        screen.getByText(/This action will remove the selected itinerary item/)
      ).toBeInTheDocument();
    });

    it('should display item details', () => {
      render(
        <DeleteConfirmModal
          item={mockItem}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      );

      expect(screen.getByText('15 2024')).toBeInTheDocument();
      expect(screen.getByText('Arrival at Jeddah Airport')).toBeInTheDocument();
      expect(screen.getByText('Arrival')).toBeInTheDocument();
    });

    it('should render delete and cancel buttons', () => {
      render(
        <DeleteConfirmModal
          item={mockItem}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      );

      expect(screen.getByText('Delete Itinerary')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    it('should render delete icon', () => {
      render(
        <DeleteConfirmModal
          item={mockItem}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      );

      expect(screen.getByText('delete_forever')).toBeInTheDocument();
    });
  });

  describe('user interactions', () => {
    it('should call onClose when close button is clicked', () => {
      render(
        <DeleteConfirmModal
          item={mockItem}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      );

      const closeButton = screen.getByLabelText('Close delete confirmation popup');
      fireEvent.click(closeButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when cancel button is clicked', () => {
      render(
        <DeleteConfirmModal
          item={mockItem}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      );

      const cancelButton = screen.getByText('Cancel');
      fireEvent.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should call onConfirm when delete button is clicked', () => {
      render(
        <DeleteConfirmModal
          item={mockItem}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      );

      const deleteButton = screen.getByText('Delete Itinerary');
      fireEvent.click(deleteButton);

      expect(mockOnConfirm).toHaveBeenCalledTimes(1);
    });
  });

  describe('accessibility', () => {
    it('should have correct aria attributes', () => {
      render(
        <DeleteConfirmModal
          item={mockItem}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(dialog).toHaveAttribute('aria-labelledby', 'delete-itinerary-title');
    });

    it('should have close button with aria-label', () => {
      render(
        <DeleteConfirmModal
          item={mockItem}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      );

      const closeButton = screen.getByLabelText('Close delete confirmation popup');
      expect(closeButton).toBeInTheDocument();
    });
  });

  describe('different item types', () => {
    it('should display departure item correctly', () => {
      const departureItem = {
        ...mockItem,
        title: 'Departure to Madinah',
        category: 'Departure',
      };

      render(
        <DeleteConfirmModal
          item={departureItem}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      );

      expect(screen.getByText('Departure to Madinah')).toBeInTheDocument();
      expect(screen.getByText('Departure')).toBeInTheDocument();
    });

    it('should display city tour item correctly', () => {
      const cityTourItem = {
        ...mockItem,
        title: 'Makkah City Tour',
        category: 'City Tour',
      };

      render(
        <DeleteConfirmModal
          item={cityTourItem}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      );

      expect(screen.getByText('Makkah City Tour')).toBeInTheDocument();
      expect(screen.getByText('City Tour')).toBeInTheDocument();
    });
  });
});
