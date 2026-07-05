/// <reference types="vitest/globals" />
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ModalHeader } from '../ModalHeader';

describe('ModalHeader', () => {
  const defaultProps = {
    title: 'Test Title',
    titleId: 'test-title-id',
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders title', () => {
    render(<ModalHeader {...defaultProps} />);
    expect(screen.getByRole('heading', { name: 'Test Title' })).toBeInTheDocument();
  });

  it('renders close button with correct aria-label', () => {
    render(<ModalHeader {...defaultProps} />);
    const closeButton = screen.getByLabelText('Close test title popup');
    expect(closeButton).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    render(<ModalHeader {...defaultProps} />);
    const closeButton = screen.getByLabelText('Close test title popup');
    fireEvent.click(closeButton);
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('renders with provided titleId', () => {
    render(<ModalHeader {...defaultProps} titleId="custom-id" />);
    const heading = screen.getByRole('heading');
    expect(heading).toHaveAttribute('id', 'custom-id');
  });

  it('applies correct styling classes', () => {
    render(<ModalHeader {...defaultProps} />);
    const container = screen.getByRole('heading').parentElement;
    expect(container).toHaveClass('flex');
    expect(container).toHaveClass('items-start');
    expect(container).toHaveClass('justify-between');
  });

  it('applies centered styling when centered prop is true', () => {
    render(<ModalHeader {...defaultProps} centered={true} />);
    const container = screen.getByRole('heading').parentElement;
    expect(container).toHaveClass('items-center');
  });

  it('renders with different title lengths', () => {
    const longTitle = 'This is a very long title that might wrap to multiple lines';
    render(<ModalHeader {...defaultProps} title={longTitle} />);
    expect(screen.getByText(longTitle)).toBeInTheDocument();
  });
});
