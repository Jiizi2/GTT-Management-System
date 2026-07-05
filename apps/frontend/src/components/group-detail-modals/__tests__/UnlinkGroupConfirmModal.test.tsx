import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { UnlinkGroupConfirmModal } from '../UnlinkGroupConfirmModal';

// Mock useModalFocusTrap to avoid DOM focus issues in tests
vi.mock('../use-modal-focus-trap', () => ({
  useModalFocusTrap: () => ({ current: null }),
}));

describe('UnlinkGroupConfirmModal', () => {
  const mockOnClose = vi.fn();
  const mockOnConfirm = vi.fn();
  const mockGroupCode = 'GRP-001';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render modal with correct title', () => {
      render(
        <UnlinkGroupConfirmModal
          groupCode={mockGroupCode}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      );

      expect(screen.getByText('Pisahkan dari grup utama?')).toBeInTheDocument();
    });

    it('should render warning message with group code', () => {
      render(
        <UnlinkGroupConfirmModal
          groupCode={mockGroupCode}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      );

      expect(screen.getByText(mockGroupCode)).toBeInTheDocument();
      expect(screen.getByText(/menjadi mandiri/)).toBeInTheDocument();
    });

    it('should render unlink and cancel buttons', () => {
      render(
        <UnlinkGroupConfirmModal
          groupCode={mockGroupCode}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      );

      expect(screen.getByText('Pisahkan Grup')).toBeInTheDocument();
      expect(screen.getByText('Batalkan')).toBeInTheDocument();
    });

    it('should render unlink icon', () => {
      render(
        <UnlinkGroupConfirmModal
          groupCode={mockGroupCode}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      );

      expect(screen.getByText('link_off')).toBeInTheDocument();
    });
  });

  describe('user interactions', () => {
    it('should call onClose when close button is clicked', () => {
      render(
        <UnlinkGroupConfirmModal
          groupCode={mockGroupCode}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      );

      const closeButton = screen.getByLabelText('Close unlink confirmation popup');
      fireEvent.click(closeButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when cancel button is clicked', () => {
      render(
        <UnlinkGroupConfirmModal
          groupCode={mockGroupCode}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      );

      const cancelButton = screen.getByText('Batalkan');
      fireEvent.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should call onConfirm and onClose when unlink button is clicked', () => {
      render(
        <UnlinkGroupConfirmModal
          groupCode={mockGroupCode}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      );

      const unlinkButton = screen.getByText('Pisahkan Grup');
      fireEvent.click(unlinkButton);

      expect(mockOnConfirm).toHaveBeenCalledTimes(1);
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should call onConfirm before onClose when unlink button is clicked', () => {
      const callOrder: string[] = [];
      const orderedOnConfirm = vi.fn(() => callOrder.push('confirm'));
      const orderedOnClose = vi.fn(() => callOrder.push('close'));

      render(
        <UnlinkGroupConfirmModal
          groupCode={mockGroupCode}
          onClose={orderedOnClose}
          onConfirm={orderedOnConfirm}
        />
      );

      const unlinkButton = screen.getByText('Pisahkan Grup');
      fireEvent.click(unlinkButton);

      expect(callOrder).toEqual(['confirm', 'close']);
    });
  });

  describe('accessibility', () => {
    it('should have correct aria attributes', () => {
      render(
        <UnlinkGroupConfirmModal
          groupCode={mockGroupCode}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(dialog).toHaveAttribute('aria-labelledby', 'unlink-group-title');
    });

    it('should have close button with aria-label', () => {
      render(
        <UnlinkGroupConfirmModal
          groupCode={mockGroupCode}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      );

      const closeButton = screen.getByLabelText('Close unlink confirmation popup');
      expect(closeButton).toBeInTheDocument();
    });
  });

  describe('different group codes', () => {
    it('should display different group code correctly', () => {
      const differentGroupCode = 'GRP-999';

      render(
        <UnlinkGroupConfirmModal
          groupCode={differentGroupCode}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      );

      expect(screen.getByText(differentGroupCode)).toBeInTheDocument();
    });
  });
});
