import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DialogShell } from './dialog-shell';

// Mock useModalFocusTrap to return a simple ref
vi.mock('./use-modal-focus-trap', () => ({
  useModalFocusTrap: () => ({ current: null }),
}));

describe('DialogShell', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    title: 'Test Dialog',
    children: <div>Dialog Content</div>,
  };

  beforeEach(() => {
    defaultProps.onClose.mockClear();
  });

  it('renders dialog when isOpen is true', () => {
    render(<DialogShell {...defaultProps} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('does not render dialog when isOpen is false', () => {
    render(<DialogShell {...defaultProps} isOpen={false} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('displays title text', () => {
    render(<DialogShell {...defaultProps} />);
    expect(screen.getByText('Test Dialog')).toBeInTheDocument();
  });

  it('renders children content', () => {
    render(<DialogShell {...defaultProps} />);
    expect(screen.getByText('Dialog Content')).toBeInTheDocument();
  });

  it('has aria-modal attribute', () => {
    render(<DialogShell {...defaultProps} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('calls onClose when close button is clicked', () => {
    render(<DialogShell {...defaultProps} />);
    const closeButton = screen.getByRole('button', { name: /close/i });
    fireEvent.click(closeButton);
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when overlay is clicked', () => {
    render(<DialogShell {...defaultProps} />);
    // The overlay is the parent div with onClick={onClose}
    const overlay = screen.getByRole('dialog').parentElement;
    if (overlay) {
      fireEvent.click(overlay);
      expect(defaultProps.onClose).toHaveBeenCalled();
    }
  });

  it('does not call onClose when dialog content is clicked', () => {
    render(<DialogShell {...defaultProps} />);
    const dialog = screen.getByRole('dialog');
    fireEvent.click(dialog);
    expect(defaultProps.onClose).not.toHaveBeenCalled();
  });

  it('applies sm size class', () => {
    render(<DialogShell {...defaultProps} size="sm" />);
    const dialog = screen.getByRole('dialog');
    expect(dialog.className).toContain('max-w-md');
  });

  it('applies md size class by default', () => {
    render(<DialogShell {...defaultProps} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog.className).toContain('max-w-xl');
  });

  it('applies lg size class', () => {
    render(<DialogShell {...defaultProps} size="lg" />);
    const dialog = screen.getByRole('dialog');
    expect(dialog.className).toContain('max-w-4xl');
  });

  it('close button has correct aria-label', () => {
    render(<DialogShell {...defaultProps} />);
    const closeButton = screen.getByLabelText('Close Test Dialog popup');
    expect(closeButton).toBeInTheDocument();
  });

  it('renders with custom title', () => {
    render(<DialogShell {...defaultProps} title="Custom Title" />);
    expect(screen.getByText('Custom Title')).toBeInTheDocument();
  });

  it('renders with complex children', () => {
    render(
      <DialogShell {...defaultProps}>
        <div>
          <h3>Section Title</h3>
          <p>Section content</p>
          <button>Action Button</button>
        </div>
      </DialogShell>
    );
    expect(screen.getByText('Section Title')).toBeInTheDocument();
    expect(screen.getByText('Section content')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Action Button' })).toBeInTheDocument();
  });
});
