import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MusyrifModal } from '../MusyrifModal';

// Mock useModalFocusTrap to avoid DOM focus issues in tests
vi.mock('../use-modal-focus-trap', () => ({
  useModalFocusTrap: () => ({ current: null }),
}));

describe('MusyrifModal', () => {
  const mockOnClose = vi.fn();
  const mockOnSave = vi.fn();
  const mockInitialValues = {
    name: 'Ahmad Fauzi',
    phone: '+6281234567890',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render modal with correct title', () => {
      render(
        <MusyrifModal
          initialValues={mockInitialValues}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      );

      expect(screen.getByText('Edit Musyrif')).toBeInTheDocument();
    });

    it('should render name field with initial value', () => {
      render(
        <MusyrifModal
          initialValues={mockInitialValues}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      );

      const nameInput = screen.getByLabelText('Musyrif Name');
      expect(nameInput).toBeInTheDocument();
      expect(nameInput).toHaveValue('Ahmad Fauzi');
    });

    it('should render phone field with initial value', () => {
      render(
        <MusyrifModal
          initialValues={mockInitialValues}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      );

      const phoneInput = screen.getByLabelText('Phone Number');
      expect(phoneInput).toBeInTheDocument();
      expect(phoneInput).toHaveValue('+6281234567890');
    });

    it('should render save and cancel buttons', () => {
      render(
        <MusyrifModal
          initialValues={mockInitialValues}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      );

      expect(screen.getByText('Save Changes')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    it('should render with empty initial values', () => {
      render(
        <MusyrifModal
          initialValues={{ name: '', phone: '' }}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      );

      const nameInput = screen.getByLabelText('Musyrif Name');
      const phoneInput = screen.getByLabelText('Phone Number');
      expect(nameInput).toHaveValue('');
      expect(phoneInput).toHaveValue('');
    });
  });

  describe('user interactions', () => {
    it('should call onClose when close button is clicked', () => {
      render(
        <MusyrifModal
          initialValues={mockInitialValues}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      );

      const closeButton = screen.getByLabelText('Close edit musyrif popup');
      fireEvent.click(closeButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when cancel button is clicked', () => {
      render(
        <MusyrifModal
          initialValues={mockInitialValues}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      );

      const cancelButton = screen.getByText('Cancel');
      fireEvent.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should call onSave with form values when save button is clicked', async () => {
      render(
        <MusyrifModal
          initialValues={mockInitialValues}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      );

      const saveButton = screen.getByText('Save Changes');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith(mockInitialValues);
      });
    });
  });

  describe('validation', () => {
    it('should show validation error when name is empty', async () => {
      render(
        <MusyrifModal
          initialValues={{ name: '', phone: '+6281234567890' }}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      );

      const saveButton = screen.getByText('Save Changes');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText('Musyrif name wajib diisi.')).toBeInTheDocument();
      });
    });

    it('should show validation error when phone is empty', async () => {
      render(
        <MusyrifModal
          initialValues={{ name: 'Ahmad Fauzi', phone: '' }}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      );

      const saveButton = screen.getByText('Save Changes');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText('Phone number wajib diisi.')).toBeInTheDocument();
      });
    });

    it('should not call onSave when validation fails', async () => {
      render(
        <MusyrifModal
          initialValues={{ name: '', phone: '' }}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      );

      const saveButton = screen.getByText('Save Changes');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockOnSave).not.toHaveBeenCalled();
      });
    });
  });

  describe('accessibility', () => {
    it('should have correct aria attributes', () => {
      render(
        <MusyrifModal
          initialValues={mockInitialValues}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(dialog).toHaveAttribute('aria-labelledby', 'edit-musyrif-title');
    });

    it('should have proper labels for form fields', () => {
      render(
        <MusyrifModal
          initialValues={mockInitialValues}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      );

      expect(screen.getByLabelText('Musyrif Name')).toBeInTheDocument();
      expect(screen.getByLabelText('Phone Number')).toBeInTheDocument();
    });
  });
});
