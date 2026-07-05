import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NoteModal } from '../NoteModal';

// Mock useModalFocusTrap to avoid DOM focus issues in tests
vi.mock('../use-modal-focus-trap', () => ({
  useModalFocusTrap: () => ({ current: null }),
}));

describe('NoteModal', () => {
  const mockOnClose = vi.fn();
  const mockOnSave = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render modal with correct title', () => {
      render(<NoteModal onClose={mockOnClose} onSave={mockOnSave} />);

      expect(screen.getByText('Add New Note')).toBeInTheDocument();
    });

    it('should render text field', () => {
      render(<NoteModal onClose={mockOnClose} onSave={mockOnSave} />);

      const textField = screen.getByRole('textbox');
      expect(textField).toBeInTheDocument();
      expect(textField.tagName).toBe('TEXTAREA');
    });

    it('should render character count', () => {
      render(<NoteModal onClose={mockOnClose} onSave={mockOnSave} />);

      expect(screen.getByText('0/2000')).toBeInTheDocument();
    });

    it('should render pin toggle', () => {
      render(<NoteModal onClose={mockOnClose} onSave={mockOnSave} />);

      expect(screen.getByText('Pin to top of group feed')).toBeInTheDocument();
    });

    it('should render visibility info', () => {
      render(<NoteModal onClose={mockOnClose} onSave={mockOnSave} />);

      expect(screen.getByText('Visible to all operators')).toBeInTheDocument();
    });

    it('should render save and cancel buttons', () => {
      render(<NoteModal onClose={mockOnClose} onSave={mockOnSave} />);

      expect(screen.getByText('Save Note')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });
  });

  describe('user interactions', () => {
    it('should call onClose when close button is clicked', () => {
      render(<NoteModal onClose={mockOnClose} onSave={mockOnSave} />);

      const closeButton = screen.getByLabelText('Close add new note popup');
      fireEvent.click(closeButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when cancel button is clicked', () => {
      render(<NoteModal onClose={mockOnClose} onSave={mockOnSave} />);

      const cancelButton = screen.getByText('Cancel');
      fireEvent.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should not call onSave when validation fails', async () => {
      render(<NoteModal onClose={mockOnClose} onSave={mockOnSave} />);

      const saveButton = screen.getByText('Save Note');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockOnSave).not.toHaveBeenCalled();
      });
    });
  });

  describe('validation', () => {
    it('should show validation error when text is empty', async () => {
      render(<NoteModal onClose={mockOnClose} onSave={mockOnSave} />);

      const saveButton = screen.getByText('Save Note');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText('Operational note wajib diisi.')).toBeInTheDocument();
      });
    });

    it('should not call onSave when validation fails', async () => {
      render(<NoteModal onClose={mockOnClose} onSave={mockOnSave} />);

      const saveButton = screen.getByText('Save Note');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockOnSave).not.toHaveBeenCalled();
      });
    });
  });

  describe('accessibility', () => {
    it('should have correct aria attributes', () => {
      render(<NoteModal onClose={mockOnClose} onSave={mockOnSave} />);

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(dialog).toHaveAttribute('aria-labelledby', 'note-modal-title');
    });

    it('should have proper label for text field', () => {
      render(<NoteModal onClose={mockOnClose} onSave={mockOnSave} />);

      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('should have aria-pressed on pin toggle button', () => {
      render(<NoteModal onClose={mockOnClose} onSave={mockOnSave} />);

      const pinButton = screen.getByRole('button', { name: /Pin to top of group feed/i });
      expect(pinButton).toHaveAttribute('aria-pressed');
    });
  });
});
