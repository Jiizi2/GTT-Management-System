import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AppSidebar } from './app-sidebar';

// Mock useModalFocusTrap
vi.mock('./use-modal-focus-trap', () => ({
  useModalFocusTrap: () => ({ current: null }),
}));

describe('AppSidebar', () => {
  const defaultProps = {
    activeNav: 'overview' as const,
    sessionAccessTier: 'admin' as const,
    sessionUserName: 'Test User',
    isCollapsed: false,
    onNavigate: vi.fn(),
    onOpenNewGroup: vi.fn(),
    onToggleCollapse: vi.fn(),
    onLogout: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders sidebar', () => {
    render(<AppSidebar {...defaultProps} />);
    expect(screen.getByText('GTT')).toBeInTheDocument();
  });

  it('displays brand name when expanded', () => {
    render(<AppSidebar {...defaultProps} isCollapsed={false} />);
    expect(screen.getByText('Ghaniya Tour and Travel')).toBeInTheDocument();
  });

  it('hides brand name when collapsed', () => {
    render(<AppSidebar {...defaultProps} isCollapsed={true} />);
    expect(screen.queryByText('Ghaniya Tour and travel')).not.toBeInTheDocument();
  });

  it('renders collapse toggle button', () => {
    render(<AppSidebar {...defaultProps} />);
    expect(screen.getByLabelText('Collapse sidebar')).toBeInTheDocument();
  });

  it('renders expand toggle button when collapsed', () => {
    render(<AppSidebar {...defaultProps} isCollapsed={true} />);
    expect(screen.getByLabelText('Expand sidebar')).toBeInTheDocument();
  });

  it('calls onToggleCollapse when collapse button is clicked', () => {
    render(<AppSidebar {...defaultProps} />);
    const collapseButton = screen.getByLabelText('Collapse sidebar');
    fireEvent.click(collapseButton);
    expect(defaultProps.onToggleCollapse).toHaveBeenCalled();
  });

  it('renders Main navigation section', () => {
    render(<AppSidebar {...defaultProps} isCollapsed={false} />);
    expect(screen.getByText('Main')).toBeInTheDocument();
  });

  it('renders Tools navigation section', () => {
    render(<AppSidebar {...defaultProps} isCollapsed={false} />);
    expect(screen.getByText('Tools')).toBeInTheDocument();
  });

  it('hides section labels when collapsed', () => {
    render(<AppSidebar {...defaultProps} isCollapsed={true} />);
    expect(screen.queryByText('Main')).not.toBeInTheDocument();
    expect(screen.queryByText('Tools')).not.toBeInTheDocument();
  });

  it('renders primary nav items', () => {
    render(<AppSidebar {...defaultProps} isCollapsed={false} />);
    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('H-1 Checklist')).toBeInTheDocument();
    expect(screen.getByText('Visa Tracking')).toBeInTheDocument();
  });

  it('renders tools nav items', () => {
    render(<AppSidebar {...defaultProps} isCollapsed={false} />);
    expect(screen.getByText('Agreement Inbox')).toBeInTheDocument();
    expect(screen.getByText('Invoice')).toBeInTheDocument();
    expect(screen.getByText('Raudhah Reminder')).toBeInTheDocument();
  });

  it('calls onNavigate when nav item is clicked', () => {
    render(<AppSidebar {...defaultProps} isCollapsed={false} />);
    const overviewButton = screen.getByText('Overview');
    fireEvent.click(overviewButton);
    expect(defaultProps.onNavigate).toHaveBeenCalledWith('overview');
  });

  it('renders admin items for super-admin', () => {
    render(<AppSidebar {...defaultProps} sessionAccessTier="super-admin" />);
    expect(screen.getByText('Master Data')).toBeInTheDocument();
    expect(screen.getByText('User Management')).toBeInTheDocument();
  });

  it('hides admin items for non-super-admin', () => {
    render(<AppSidebar {...defaultProps} sessionAccessTier="admin" />);
    expect(screen.queryByText('Master Data')).not.toBeInTheDocument();
    expect(screen.queryByText('User Management')).not.toBeInTheDocument();
  });

  it('renders Add New Group button', () => {
    render(<AppSidebar {...defaultProps} />);
    expect(screen.getByLabelText('Add New Group')).toBeInTheDocument();
  });

  it('calls onOpenNewGroup when Add New Group is clicked', () => {
    render(<AppSidebar {...defaultProps} />);
    const addButton = screen.getByLabelText('Add New Group');
    fireEvent.click(addButton);
    expect(defaultProps.onOpenNewGroup).toHaveBeenCalled();
  });

  it('displays user name', () => {
    render(<AppSidebar {...defaultProps} sessionUserName="John Doe" />);
    expect(screen.getByText('John Doe')).toBeInTheDocument();
  });

  it('displays default name when user name is empty', () => {
    render(<AppSidebar {...defaultProps} sessionUserName="" />);
    expect(screen.getByText('Operator')).toBeInTheDocument();
  });

  it('displays Super Admin label for super-admin', () => {
    render(<AppSidebar {...defaultProps} sessionAccessTier="super-admin" />);
    expect(screen.getByText('Super Admin')).toBeInTheDocument();
  });

  it('displays Admin label for admin', () => {
    render(<AppSidebar {...defaultProps} sessionAccessTier="admin" />);
    expect(screen.getByText('Admin')).toBeInTheDocument();
  });

  it('renders profile button', () => {
    render(<AppSidebar {...defaultProps} />);
    expect(screen.getByLabelText('Open Profile')).toBeInTheDocument();
  });

  it('calls onNavigate when profile is clicked', () => {
    render(<AppSidebar {...defaultProps} />);
    const profileButton = screen.getByLabelText('Open Profile');
    fireEvent.click(profileButton);
    expect(defaultProps.onNavigate).toHaveBeenCalledWith('profile');
  });

  it('renders logout button', () => {
    render(<AppSidebar {...defaultProps} />);
    expect(screen.getByLabelText('Logout')).toBeInTheDocument();
  });

  it('opens logout confirmation modal when logout is clicked', () => {
    render(<AppSidebar {...defaultProps} />);
    const logoutButton = screen.getByLabelText('Logout');
    fireEvent.click(logoutButton);
    expect(screen.getByText('Logout dari sesi?')).toBeInTheDocument();
  });

  it('calls onLogout when logout is confirmed', () => {
    render(<AppSidebar {...defaultProps} />);
    // Open modal
    const logoutButton = screen.getByLabelText('Logout');
    fireEvent.click(logoutButton);
    // Confirm - get all buttons with "Logout" text and click the one in the modal
    const logoutButtons = screen.getAllByRole('button', { name: 'Logout' });
    const confirmButton = logoutButtons[logoutButtons.length - 1]; // Modal button is rendered last
    fireEvent.click(confirmButton);
    expect(defaultProps.onLogout).toHaveBeenCalled();
  });

  it('closes logout modal when cancel is clicked', () => {
    render(<AppSidebar {...defaultProps} />);
    // Open modal
    const logoutButton = screen.getByLabelText('Logout');
    fireEvent.click(logoutButton);
    // Cancel
    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);
    expect(screen.queryByText('Logout dari sesi?')).not.toBeInTheDocument();
  });

  it('nav items show title when collapsed', () => {
    render(<AppSidebar {...defaultProps} isCollapsed={true} />);
    const overviewButton = screen.getByTitle('Overview');
    expect(overviewButton).toBeInTheDocument();
  });

  it('nav items do not show title when expanded', () => {
    render(<AppSidebar {...defaultProps} isCollapsed={false} />);
    expect(screen.queryByTitle('Overview')).not.toBeInTheDocument();
  });
});
