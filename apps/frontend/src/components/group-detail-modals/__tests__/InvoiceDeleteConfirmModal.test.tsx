import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InvoiceDeleteConfirmModal } from '../InvoiceDeleteConfirmModal';

// Mock useModalFocusTrap to avoid DOM focus issues in tests
vi.mock('../use-modal-focus-trap', () => ({
  useModalFocusTrap: () => ({ current: null }),
}));

describe('InvoiceDeleteConfirmModal', () => {
  const mockOnClose = vi.fn();
  const mockOnConfirm = vi.fn();
  const mockInvoice = {
    invoiceNumber: 'INV-2026-001',
    clientName: 'Ahmad Sulaiman',
    amount: 2500000,
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render modal with correct title', () => {
      render(
        <InvoiceDeleteConfirmModal
          invoice={mockInvoice}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      );

      expect(screen.getByText('Hapus Invoice Ini?')).toBeInTheDocument();
    });

    it('should render warning message', () => {
      render(
        <InvoiceDeleteConfirmModal
          invoice={mockInvoice}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      );

      expect(
        screen.getByText(/Tindakan ini akan menghapus invoice dan seluruh item rinciannya secara permanen/)
      ).toBeInTheDocument();
    });

    it('should display invoice details correctly', () => {
      render(
        <InvoiceDeleteConfirmModal
          invoice={mockInvoice}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      );

      expect(screen.getByText('INV-2026-001')).toBeInTheDocument();
      expect(screen.getByText('Ahmad Sulaiman')).toBeInTheDocument();
      // Amount formatted in IDR
      expect(screen.getByText('IDR 2.500.000')).toBeInTheDocument();
    });

    it('should render delete and cancel buttons', () => {
      render(
        <InvoiceDeleteConfirmModal
          invoice={mockInvoice}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      );

      expect(screen.getByText('Hapus Invoice')).toBeInTheDocument();
      expect(screen.getByText('Batal')).toBeInTheDocument();
    });

    it('should render delete forever icon', () => {
      render(
        <InvoiceDeleteConfirmModal
          invoice={mockInvoice}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      );

      expect(screen.getByText('delete_forever')).toBeInTheDocument();
    });
  });

  describe('user interactions', () => {
    it('should call onClose when close icon button is clicked', () => {
      render(
        <InvoiceDeleteConfirmModal
          invoice={mockInvoice}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      );

      const closeButton = screen.getByLabelText('Tutup popup konfirmasi hapus');
      fireEvent.click(closeButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when cancel button is clicked', () => {
      render(
        <InvoiceDeleteConfirmModal
          invoice={mockInvoice}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      );

      const cancelButton = screen.getByText('Batal');
      fireEvent.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should call onConfirm when delete button is clicked', () => {
      render(
        <InvoiceDeleteConfirmModal
          invoice={mockInvoice}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      );

      const deleteButton = screen.getByText('Hapus Invoice');
      fireEvent.click(deleteButton);

      expect(mockOnConfirm).toHaveBeenCalledTimes(1);
    });
  });

  describe('accessibility', () => {
    it('should have correct aria attributes', () => {
      render(
        <InvoiceDeleteConfirmModal
          invoice={mockInvoice}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(dialog).toHaveAttribute('aria-labelledby', 'delete-invoice-title');
    });

    it('should have close button with aria-label', () => {
      render(
        <InvoiceDeleteConfirmModal
          invoice={mockInvoice}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      );

      const closeButton = screen.getByLabelText('Tutup popup konfirmasi hapus');
      expect(closeButton).toBeInTheDocument();
    });
  });
});
