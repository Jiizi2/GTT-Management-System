import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ModalShell } from '../ModalShell';

describe('ModalShell', () => {
  const defaultProps = {
    onClose: vi.fn(),
    ariaLabelledBy: 'test-modal-title',
    children: <div>Modal Content</div>,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders children', () => {
    render(<ModalShell {...defaultProps} />);
    expect(screen.getByText('Modal Content')).toBeInTheDocument();
  });

  it('calls onClose when overlay is clicked', () => {
    render(<ModalShell {...defaultProps} />);
    const overlay = screen.getByRole('dialog').parentElement;
    fireEvent.click(overlay!);
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose when modal content is clicked', () => {
    render(<ModalShell {...defaultProps} />);
    const modal = screen.getByRole('dialog');
    fireEvent.click(modal);
    expect(defaultProps.onClose).not.toHaveBeenCalled();
  });

  it('renders with correct aria attributes', () => {
    render(<ModalShell {...defaultProps} />);
    const modal = screen.getByRole('dialog');
    expect(modal).toHaveAttribute('aria-modal', 'true');
    expect(modal).toHaveAttribute('aria-labelledby', 'test-modal-title');
  });

  it('supports custom size', () => {
    render(<ModalShell {...defaultProps} size="4xl" />);
    const modal = screen.getByRole('dialog');
    expect(modal).toHaveClass('max-w-4xl');
  });

  it('uses default size of 2xl', () => {
    render(<ModalShell {...defaultProps} />);
    const modal = screen.getByRole('dialog');
    expect(modal).toHaveClass('max-w-2xl');
  });
});
