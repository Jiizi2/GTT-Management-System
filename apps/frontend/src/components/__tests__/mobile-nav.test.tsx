import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MobileNav } from '../mobile-nav';

describe('MobileNav', () => {
  const defaultProps = {
    activeNav: 'overview' as const,
    isActionsOpen: false,
    onNavigate: vi.fn(),
    onToggleActions: vi.fn(),
  };

  it('renders mobile navigation', () => {
    render(<MobileNav {...defaultProps} />);
    expect(screen.getByRole('navigation', { name: 'Mobile navigation' })).toBeInTheDocument();
  });

  it('renders navigation items', () => {
    render(<MobileNav {...defaultProps} />);
    // mobileItems should include overview and visa
    expect(screen.getByLabelText('Overview')).toBeInTheDocument();
    expect(screen.getByLabelText('Visa')).toBeInTheDocument();
  });

  it('marks active nav item with aria-current', () => {
    render(<MobileNav {...defaultProps} activeNav="overview" />);
    const overviewButton = screen.getByLabelText('Overview');
    expect(overviewButton).toHaveAttribute('aria-current', 'page');
  });

  it('does not mark inactive items with aria-current', () => {
    render(<MobileNav {...defaultProps} activeNav="overview" />);
    const visaButton = screen.getByLabelText('Visa');
    expect(visaButton).not.toHaveAttribute('aria-current');
  });

  it('calls onNavigate when nav item is clicked', () => {
    render(<MobileNav {...defaultProps} />);
    const visaButton = screen.getByLabelText('Visa');
    fireEvent.click(visaButton);
    expect(defaultProps.onNavigate).toHaveBeenCalledWith('visa');
  });

  it('renders Tools button (quick actions)', () => {
    render(<MobileNav {...defaultProps} />);
    const toolsButton = screen.getByLabelText('Open quick actions');
    expect(toolsButton).toBeInTheDocument();
  });

  it('calls onToggleActions when Tools button is clicked', () => {
    render(<MobileNav {...defaultProps} />);
    const toolsButton = screen.getByLabelText('Open quick actions');
    fireEvent.click(toolsButton);
    expect(defaultProps.onToggleActions).toHaveBeenCalled();
  });

  it('shows Close quick actions label when actions are open', () => {
    render(<MobileNav {...defaultProps} isActionsOpen={true} />);
    const toolsButton = screen.getByLabelText('Close quick actions');
    expect(toolsButton).toBeInTheDocument();
  });

  it('Tools button has aria-haspopup attribute', () => {
    render(<MobileNav {...defaultProps} />);
    const toolsButton = screen.getByLabelText('Open quick actions');
    expect(toolsButton).toHaveAttribute('aria-haspopup', 'dialog');
  });

  it('Tools button has aria-expanded attribute', () => {
    render(<MobileNav {...defaultProps} isActionsOpen={false} />);
    const toolsButton = screen.getByLabelText('Open quick actions');
    expect(toolsButton).toHaveAttribute('aria-expanded', 'false');
  });

  it('Tools button aria-expanded is true when actions are open', () => {
    render(<MobileNav {...defaultProps} isActionsOpen={true} />);
    const toolsButton = screen.getByLabelText('Close quick actions');
    expect(toolsButton).toHaveAttribute('aria-expanded', 'true');
  });

  it('Tools button shows active state when actions are open', () => {
    render(<MobileNav {...defaultProps} isActionsOpen={true} />);
    const toolsLabel = screen.getByText('Tools');
    expect(toolsLabel).toHaveClass('text-primary');
  });

  it('Tools button shows active state for new-group', () => {
    render(<MobileNav {...defaultProps} activeNav="new-group" />);
    const toolsLabel = screen.getByText('Tools');
    expect(toolsLabel).toHaveClass('text-primary');
  });

  it('Tools button shows active state for invoice', () => {
    render(<MobileNav {...defaultProps} activeNav="invoice" />);
    const toolsLabel = screen.getByText('Tools');
    expect(toolsLabel).toHaveClass('text-primary');
  });

  it('renders apps icon for Tools button', () => {
    render(<MobileNav {...defaultProps} />);
    expect(screen.getByText('apps')).toBeInTheDocument();
  });

  it('active nav item label is visible', () => {
    render(<MobileNav {...defaultProps} activeNav="overview" />);
    const overviewLabel = screen.getByText('Overview');
    expect(overviewLabel).toHaveClass('text-primary');
  });

  it('inactive nav item label is hidden', () => {
    render(<MobileNav {...defaultProps} activeNav="overview" />);
    const visaLabel = screen.getByText('Visa');
    expect(visaLabel).toHaveClass('opacity-0');
  });
});
