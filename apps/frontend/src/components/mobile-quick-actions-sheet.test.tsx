import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MobileQuickActionsSheet } from './mobile-quick-actions-sheet';

// Mock useModalFocusTrap
vi.mock('./use-modal-focus-trap', () => ({
  useModalFocusTrap: () => ({ current: null }),
}));

describe('MobileQuickActionsSheet', () => {
  const defaultProps = {
    activeNav: 'overview' as const,
    sessionAccessTier: 'admin' as const,
    open: true,
    onClose: vi.fn(),
    onSelectAction: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders when open is true', () => {
    render(<MobileQuickActionsSheet {...defaultProps} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('does not render when open is false', () => {
    render(<MobileQuickActionsSheet {...defaultProps} open={false} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('displays title text', () => {
    render(<MobileQuickActionsSheet {...defaultProps} />);
    expect(screen.getByText('Pilih Halaman Tools')).toBeInTheDocument();
  });

  it('displays description text', () => {
    render(<MobileQuickActionsSheet {...defaultProps} />);
    expect(screen.getByText('Akses cepat ke menu operasional dari tombol tengah.')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    render(<MobileQuickActionsSheet {...defaultProps} />);
    const closeButton = screen.getByLabelText('Close quick actions');
    fireEvent.click(closeButton);
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when overlay is clicked', () => {
    render(<MobileQuickActionsSheet {...defaultProps} />);
    const overlay = screen.getByRole('presentation');
    fireEvent.click(overlay);
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose when dialog content is clicked', () => {
    render(<MobileQuickActionsSheet {...defaultProps} />);
    const dialog = screen.getByRole('dialog');
    fireEvent.click(dialog);
    expect(defaultProps.onClose).not.toHaveBeenCalled();
  });

  it('shows non-admin actions for admin user', () => {
    render(<MobileQuickActionsSheet {...defaultProps} />);
    expect(screen.getByText('Tambah Group')).toBeInTheDocument();
    expect(screen.getByText('Raudhah Reminder')).toBeInTheDocument();
    expect(screen.getByText('Agreement Inbox')).toBeInTheDocument();
    expect(screen.getByText('Invoice List')).toBeInTheDocument();
  });

  it('hides admin-only actions for non-super-admin user', () => {
    render(<MobileQuickActionsSheet {...defaultProps} sessionAccessTier="admin" />);
    expect(screen.queryByText('Master Data')).not.toBeInTheDocument();
    expect(screen.queryByText('User Management')).not.toBeInTheDocument();
  });

  it('shows admin-only actions for super-admin user', () => {
    render(<MobileQuickActionsSheet {...defaultProps} sessionAccessTier="super-admin" />);
    expect(screen.getByText('Master Data')).toBeInTheDocument();
    expect(screen.getByText('User Management')).toBeInTheDocument();
  });

  it('marks current active action', () => {
    render(<MobileQuickActionsSheet {...defaultProps} activeNav="invoice" />);
    const invoiceButton = screen.getByText('Invoice List').closest('button');
    expect(invoiceButton).toBeInTheDocument();
    // Check for "Current" badge
    expect(screen.getByText('Current')).toBeInTheDocument();
  });

  it('calls onSelectAction when action is clicked', () => {
    render(<MobileQuickActionsSheet {...defaultProps} />);
    const addButton = screen.getByText('Tambah Group').closest('button');
    if (addButton) {
      fireEvent.click(addButton);
      expect(defaultProps.onSelectAction).toHaveBeenCalledWith('new-group');
    }
  });

  it('shows Admin badge for admin-only actions', () => {
    render(<MobileQuickActionsSheet {...defaultProps} sessionAccessTier="super-admin" />);
    const adminBadges = screen.getAllByText('Admin');
    expect(adminBadges.length).toBeGreaterThan(0);
  });

  it('displays action descriptions', () => {
    render(<MobileQuickActionsSheet {...defaultProps} />);
    expect(screen.getByText('Buat group baru dan isi itinerary dalam satu alur.')).toBeInTheDocument();
    expect(screen.getByText('Buka daftar reminder Raudhah dan template copy cepat.')).toBeInTheDocument();
  });

  it('has aria-modal attribute', () => {
    render(<MobileQuickActionsSheet {...defaultProps} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('has aria-labelledby attribute', () => {
    render(<MobileQuickActionsSheet {...defaultProps} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-labelledby', 'mobile-quick-actions-title');
  });

  it('sets body overflow to hidden when open', () => {
    render(<MobileQuickActionsSheet {...defaultProps} />);
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('restores body overflow when closed', () => {
    const { rerender } = render(<MobileQuickActionsSheet {...defaultProps} />);
    expect(document.body.style.overflow).toBe('hidden');

    rerender(<MobileQuickActionsSheet {...defaultProps} open={false} />);
    expect(document.body.style.overflow).not.toBe('hidden');
  });

  it('calls onClose on Escape key', () => {
    render(<MobileQuickActionsSheet {...defaultProps} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('renders all non-admin actions', () => {
    render(<MobileQuickActionsSheet {...defaultProps} />);
    expect(screen.getByText('Tambah Group')).toBeInTheDocument();
    expect(screen.getByText('Raudhah Reminder')).toBeInTheDocument();
    expect(screen.getByText('Agreement Inbox')).toBeInTheDocument();
    expect(screen.getByText('Invoice List')).toBeInTheDocument();
  });

  it('renders action icons', () => {
    render(<MobileQuickActionsSheet {...defaultProps} />);
    expect(screen.getByText('add_circle')).toBeInTheDocument();
    expect(screen.getByText('notifications_active')).toBeInTheDocument();
    expect(screen.getByText('inventory_2')).toBeInTheDocument();
    expect(screen.getByText('request_quote')).toBeInTheDocument();
  });
});
