import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GroupEditModal } from '../GroupEditModal';

describe('GroupEditModal', () => {
  const defaultProps = {
    groupCode: 'GRP-001',
    groupName: 'Test Group',
    groupPax: 45,
    requiredBusCount: 2,
    arrivalDate: '2024-03-15',
    returnDate: '2024-03-25',
    parentGroupId: null,
    groups: [
      { id: 'parent-1', code: 'GRP-002', name: 'Parent Group 1' },
      { id: 'parent-2', code: 'GRP-003', name: 'Parent Group 2' },
    ],
    onClose: vi.fn(),
    onSave: vi.fn(),
  };

  describe('component structure', () => {
    it('should export GroupEditModal function', () => {
      expect(typeof GroupEditModal).toBe('function');
    });

    it('should accept required props', () => {
      expect(() => {
        render(<GroupEditModal {...defaultProps} />);
      }).not.toThrow();
    });

    it('should accept optional parentGroupId prop', () => {
      expect(() => {
        render(<GroupEditModal {...defaultProps} parentGroupId="parent-1" />);
      }).not.toThrow();
    });

    it('should accept empty groups array', () => {
      expect(() => {
        render(<GroupEditModal {...defaultProps} groups={[]} />);
      }).not.toThrow();
    });
  });

  describe('props validation', () => {
    it('should have correct prop types', () => {
      const props = {
        groupCode: 'GRP-001',
        groupName: 'Test Group',
        groupPax: 45,
        requiredBusCount: 2,
        arrivalDate: '2024-03-15',
        returnDate: '2024-03-25',
        onClose: vi.fn(),
        onSave: vi.fn(),
      };

      expect(() => {
        render(<GroupEditModal {...props} />);
      }).not.toThrow();
    });

    it('should accept null parentGroupId', () => {
      expect(() => {
        render(<GroupEditModal {...defaultProps} parentGroupId={null} />);
      }).not.toThrow();
    });

    it('should accept undefined parentGroupId', () => {
      const { parentGroupId, ...propsWithoutParent } = defaultProps;

      expect(() => {
        render(<GroupEditModal {...propsWithoutParent} />);
      }).not.toThrow();
    });
  });
});
