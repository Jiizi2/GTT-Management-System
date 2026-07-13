import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DeleteGroupModal } from '../DeleteGroupModal';

// Mock useModalFocusTrap to avoid DOM focus issues in tests
vi.mock('../use-modal-focus-trap', () => ({
  useModalFocusTrap: () => ({ current: null }),
}));

describe('DeleteGroupModal', () => {
  const mockOnClose = vi.fn();
  const mockOnConfirm = vi.fn();
  const mockGroupCode = 'GRP-001';
  const mockGroupName = 'Umrah January 2024';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render modal with correct title', () => {
      render(
        <DeleteGroupModal
          groupCode={mockGroupCode}
          groupName={mockGroupName}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      );

      expect(screen.getByText('Delete this group?')).toBeInTheDocument();
    });

    it('should render warning message', () => {
      render(
        <DeleteGroupModal
          groupCode={mockGroupCode}
          groupName={mockGroupName}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      );

      expect(
        screen.getByText(/This action will permanently remove the group/)
      ).toBeInTheDocument();
    });

    it('should display group code and name', () => {
      render(
        <DeleteGroupModal
          groupCode={mockGroupCode}
          groupName={mockGroupName}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      );

      expect(screen.getByText(mockGroupCode)).toBeInTheDocument();
      expect(screen.getByText(mockGroupName)).toBeInTheDocument();
    });

    it('should render delete and cancel buttons', () => {
      render(
        <DeleteGroupModal
          groupCode={mockGroupCode}
          groupName={mockGroupName}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      );

      expect(screen.getByText('Delete Group')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    it('should render warning icon', () => {
      render(
        <DeleteGroupModal
          groupCode={mockGroupCode}
          groupName={mockGroupName}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      );

      expect(screen.getByText('warning')).toBeInTheDocument();
    });

    it('should not render child groups warning when childGroupCount is 0', () => {
      render(
        <DeleteGroupModal
          groupCode={mockGroupCode}
          groupName={mockGroupName}
          childGroupCount={0}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      );

      expect(screen.queryByText(/This group has/)).not.toBeInTheDocument();
    });

    it('should not render child groups warning when childGroupCount is undefined', () => {
      render(
        <DeleteGroupModal
          groupCode={mockGroupCode}
          groupName={mockGroupName}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      );

      expect(screen.queryByText(/This group has/)).not.toBeInTheDocument();
    });

    it('should render child groups warning when childGroupCount is 1', () => {
      render(
        <DeleteGroupModal
          groupCode={mockGroupCode}
          groupName={mockGroupName}
          childGroupCount={1}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      );

      expect(
        screen.getByText(/This group has 1 linked child group\. Unlink the child group before deleting the parent group\./)
      ).toBeInTheDocument();
    });

    it('should render child groups warning when childGroupCount is greater than 1', () => {
      render(
        <DeleteGroupModal
          groupCode={mockGroupCode}
          groupName={mockGroupName}
          childGroupCount={3}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      );

      expect(
        screen.getByText(/This group has 3 linked child groups\. Unlink the child groups before deleting the parent group\./)
      ).toBeInTheDocument();
    });
  });

  describe('user interactions', () => {
    it('should call onClose when close button is clicked', () => {
      render(
        <DeleteGroupModal
          groupCode={mockGroupCode}
          groupName={mockGroupName}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      );

      const closeButton = screen.getByLabelText('Close delete group confirmation popup');
      fireEvent.click(closeButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when cancel button is clicked', () => {
      render(
        <DeleteGroupModal
          groupCode={mockGroupCode}
          groupName={mockGroupName}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      );

      const cancelButton = screen.getByText('Cancel');
      fireEvent.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should call onConfirm when delete button is clicked (no child groups)', () => {
      render(
        <DeleteGroupModal
          groupCode={mockGroupCode}
          groupName={mockGroupName}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      );

      const deleteButton = screen.getByText('Delete Group');
      fireEvent.click(deleteButton);

      expect(mockOnConfirm).toHaveBeenCalledTimes(1);
    });

    it('should disable delete button when there are child groups', () => {
      render(
        <DeleteGroupModal
          groupCode={mockGroupCode}
          groupName={mockGroupName}
          childGroupCount={2}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      );

      const buttons = screen.getAllByRole('button');
      const deleteButton = buttons.find(btn => btn.textContent?.includes('Delete Group'));
      expect(deleteButton).toBeDisabled();
    });

    it('should not call onConfirm when delete button is clicked while disabled', () => {
      render(
        <DeleteGroupModal
          groupCode={mockGroupCode}
          groupName={mockGroupName}
          childGroupCount={2}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      );

      const buttons = screen.getAllByRole('button');
      const deleteButton = buttons.find(btn => btn.textContent?.includes('Delete Group'));
      if (deleteButton) {
        fireEvent.click(deleteButton);
      }

      expect(mockOnConfirm).not.toHaveBeenCalled();
    });

    it('should still allow cancel button when delete is disabled', () => {
      render(
        <DeleteGroupModal
          groupCode={mockGroupCode}
          groupName={mockGroupName}
          childGroupCount={1}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      );

      const cancelButton = screen.getByText('Cancel');
      fireEvent.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('accessibility', () => {
    it('should have correct aria attributes', () => {
      render(
        <DeleteGroupModal
          groupCode={mockGroupCode}
          groupName={mockGroupName}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(dialog).toHaveAttribute('aria-labelledby', 'delete-group-title');
    });

    it('should have close button with aria-label', () => {
      render(
        <DeleteGroupModal
          groupCode={mockGroupCode}
          groupName={mockGroupName}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      );

      const closeButton = screen.getByLabelText('Close delete group confirmation popup');
      expect(closeButton).toBeInTheDocument();
    });
  });

  describe('different group data', () => {
    it('should display different group code and name correctly', () => {
      const differentGroupCode = 'GRP-999';
      const differentGroupName = 'Hajj 2024';

      render(
        <DeleteGroupModal
          groupCode={differentGroupCode}
          groupName={differentGroupName}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      );

      expect(screen.getByText(differentGroupCode)).toBeInTheDocument();
      expect(screen.getByText(differentGroupName)).toBeInTheDocument();
    });

    it('should handle special characters in group name', () => {
      const specialGroupName = 'Group with "quotes" & <brackets>';

      render(
        <DeleteGroupModal
          groupCode={mockGroupCode}
          groupName={specialGroupName}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />
      );

      expect(screen.getByText(specialGroupName)).toBeInTheDocument();
    });
  });
});
