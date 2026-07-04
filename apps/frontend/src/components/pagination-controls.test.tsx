import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PaginationControls } from './pagination-controls';

describe('PaginationControls', () => {
  const defaultProps = {
    currentPage: 1,
    totalPages: 5,
    totalItems: 50,
    rangeStart: 1,
    rangeEnd: 10,
    itemLabel: 'items',
    onPageChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render nothing when totalItems is 0', () => {
    const { container } = render(
      <PaginationControls {...defaultProps} totalItems={0} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('should render nothing when totalPages is 1', () => {
    const { container } = render(
      <PaginationControls {...defaultProps} totalPages={1} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('should render pagination controls when valid', () => {
    render(<PaginationControls {...defaultProps} />);
    expect(screen.getByRole('navigation')).toBeInTheDocument();
  });

  it('should display range information', () => {
    render(<PaginationControls {...defaultProps} />);
    // Check the paragraph element contains all range info
    const paragraph = screen.getByText(/Showing/i).closest('p');
    expect(paragraph).toBeInTheDocument();
    expect(paragraph?.textContent).toContain('1');
    expect(paragraph?.textContent).toContain('10');
    expect(paragraph?.textContent).toContain('50');
    expect(paragraph?.textContent).toContain('items');
  });

  it('should have correct aria-label on navigation', () => {
    render(<PaginationControls {...defaultProps} itemLabel="products" />);
    expect(screen.getByRole('navigation')).toHaveAttribute(
      'aria-label',
      'products pagination'
    );
  });

  it('should render previous and next buttons', () => {
    render(<PaginationControls {...defaultProps} />);
    expect(screen.getByRole('button', { name: /previous page/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /next page/i })).toBeInTheDocument();
  });

  it('should disable previous button on first page', () => {
    render(<PaginationControls {...defaultProps} currentPage={1} />);
    expect(screen.getByRole('button', { name: /previous page/i })).toBeDisabled();
  });

  it('should disable next button on last page', () => {
    render(<PaginationControls {...defaultProps} currentPage={5} />);
    expect(screen.getByRole('button', { name: /next page/i })).toBeDisabled();
  });

  it('should enable both buttons on middle page', () => {
    render(<PaginationControls {...defaultProps} currentPage={3} />);
    expect(screen.getByRole('button', { name: /previous page/i })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: /next page/i })).not.toBeDisabled();
  });

  it('should call onPageChange when previous button is clicked', async () => {
    const user = userEvent.setup();
    render(<PaginationControls {...defaultProps} currentPage={3} />);

    await user.click(screen.getByRole('button', { name: /previous page/i }));
    expect(defaultProps.onPageChange).toHaveBeenCalledWith(2);
  });

  it('should call onPageChange when next button is clicked', async () => {
    const user = userEvent.setup();
    render(<PaginationControls {...defaultProps} currentPage={3} />);

    await user.click(screen.getByRole('button', { name: /next page/i }));
    expect(defaultProps.onPageChange).toHaveBeenCalledWith(4);
  });

  it('should render page number buttons', () => {
    render(<PaginationControls {...defaultProps} />);
    expect(screen.getByRole('button', { name: /page 1/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /page 2/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /page 3/i })).toBeInTheDocument();
  });

  it('should highlight current page', () => {
    render(<PaginationControls {...defaultProps} currentPage={3} />);
    const currentPageButton = screen.getByRole('button', { name: /page 3/i });
    expect(currentPageButton).toHaveAttribute('aria-current', 'page');
  });

  it('should not highlight other pages', () => {
    render(<PaginationControls {...defaultProps} currentPage={3} />);
    const otherPageButton = screen.getByRole('button', { name: /page 1/i });
    expect(otherPageButton).not.toHaveAttribute('aria-current');
  });

  it('should call onPageChange when page number is clicked', async () => {
    const user = userEvent.setup();
    render(<PaginationControls {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: /page 3/i }));
    expect(defaultProps.onPageChange).toHaveBeenCalledWith(3);
  });

  it('should show max 5 page buttons', () => {
    render(
      <PaginationControls {...defaultProps} totalPages={10} currentPage={5} />
    );

    const pageButtons = screen.getAllByRole('button', { name: /page \d+/i });
    expect(pageButtons.length).toBeLessThanOrEqual(5);
  });

  it('should show first pages when on page 1', () => {
    render(
      <PaginationControls {...defaultProps} totalPages={10} currentPage={1} />
    );

    expect(screen.getByRole('button', { name: /page 1/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /page 5/i })).toBeInTheDocument();
  });

  it('should show last pages when on last page', () => {
    render(
      <PaginationControls {...defaultProps} totalPages={10} currentPage={10} />
    );

    expect(screen.getByRole('button', { name: /page 10/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /page 6/i })).toBeInTheDocument();
  });

  it('should center current page in visible range', () => {
    render(
      <PaginationControls {...defaultProps} totalPages={10} currentPage={5} />
    );

    expect(screen.getByRole('button', { name: /page 3/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /page 5/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /page 7/i })).toBeInTheDocument();
  });
});
