import { describe, it, expect } from 'vitest';
import { createGroupEditModalSchema } from '../group-edit.schema';

describe('group-edit.schema', () => {
  const schema = createGroupEditModalSchema();

  describe('valid data', () => {
    it('should validate correct group edit data', () => {
      const validData = {
        code: 'GRP-001',
        name: 'Test Group',
        pax: '45',
        totalBuses: '2',
        arrivalDate: '2024-03-15',
        returnDate: '2024-03-25',
      };

      const result = schema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should validate with optional parentGroupId', () => {
      const validData = {
        code: 'GRP-001',
        name: 'Test Group',
        pax: '45',
        totalBuses: '2',
        arrivalDate: '2024-03-15',
        returnDate: '2024-03-25',
        parentGroupId: 'parent-1',
      };

      const result = schema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should validate without parentGroupId', () => {
      const validData = {
        code: 'GRP-001',
        name: 'Test Group',
        pax: '45',
        totalBuses: '2',
        arrivalDate: '2024-03-15',
        returnDate: '2024-03-25',
      };

      const result = schema.safeParse(validData);
      expect(result.success).toBe(true);
    });
  });

  describe('code validation', () => {
    it('should reject empty code', () => {
      const invalidData = {
        code: '',
        name: 'Test Group',
        pax: '45',
        totalBuses: '2',
        arrivalDate: '2024-03-15',
        returnDate: '2024-03-25',
      };

      const result = schema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Group number tidak boleh kosong.');
      }
    });

    it('should reject whitespace-only code', () => {
      const invalidData = {
        code: '   ',
        name: 'Test Group',
        pax: '45',
        totalBuses: '2',
        arrivalDate: '2024-03-15',
        returnDate: '2024-03-25',
      };

      const result = schema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('name validation', () => {
    it('should reject empty name', () => {
      const invalidData = {
        code: 'GRP-001',
        name: '',
        pax: '45',
        totalBuses: '2',
        arrivalDate: '2024-03-15',
        returnDate: '2024-03-25',
      };

      const result = schema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Group name tidak boleh kosong.');
      }
    });

    it('should reject whitespace-only name', () => {
      const invalidData = {
        code: 'GRP-001',
        name: '   ',
        pax: '45',
        totalBuses: '2',
        arrivalDate: '2024-03-15',
        returnDate: '2024-03-25',
      };

      const result = schema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('pax validation', () => {
    it('should reject empty pax', () => {
      const invalidData = {
        code: 'GRP-001',
        name: 'Test Group',
        pax: '',
        totalBuses: '2',
        arrivalDate: '2024-03-15',
        returnDate: '2024-03-25',
      };

      const result = schema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Total pax wajib diisi.');
      }
    });

    it('should reject zero pax', () => {
      const invalidData = {
        code: 'GRP-001',
        name: 'Test Group',
        pax: '0',
        totalBuses: '2',
        arrivalDate: '2024-03-15',
        returnDate: '2024-03-25',
      };

      const result = schema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Total pax harus lebih dari 0.');
      }
    });

    it('should reject negative pax', () => {
      const invalidData = {
        code: 'GRP-001',
        name: 'Test Group',
        pax: '-5',
        totalBuses: '2',
        arrivalDate: '2024-03-15',
        returnDate: '2024-03-25',
      };

      const result = schema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject non-numeric pax', () => {
      const invalidData = {
        code: 'GRP-001',
        name: 'Test Group',
        pax: 'abc',
        totalBuses: '2',
        arrivalDate: '2024-03-15',
        returnDate: '2024-03-25',
      };

      const result = schema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should accept valid pax', () => {
      const validData = {
        code: 'GRP-001',
        name: 'Test Group',
        pax: '1',
        totalBuses: '1',
        arrivalDate: '2024-03-15',
        returnDate: '2024-03-25',
      };

      const result = schema.safeParse(validData);
      expect(result.success).toBe(true);
    });
  });

  describe('totalBuses validation', () => {
    it('should reject empty totalBuses', () => {
      const invalidData = {
        code: 'GRP-001',
        name: 'Test Group',
        pax: '45',
        totalBuses: '',
        arrivalDate: '2024-03-15',
        returnDate: '2024-03-25',
      };

      const result = schema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Required bus wajib diisi.');
      }
    });

    it('should reject zero totalBuses', () => {
      const invalidData = {
        code: 'GRP-001',
        name: 'Test Group',
        pax: '45',
        totalBuses: '0',
        arrivalDate: '2024-03-15',
        returnDate: '2024-03-25',
      };

      const result = schema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Required bus harus lebih dari 0.');
      }
    });

    it('should reject negative totalBuses', () => {
      const invalidData = {
        code: 'GRP-001',
        name: 'Test Group',
        pax: '45',
        totalBuses: '-1',
        arrivalDate: '2024-03-15',
        returnDate: '2024-03-25',
      };

      const result = schema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject non-numeric totalBuses', () => {
      const invalidData = {
        code: 'GRP-001',
        name: 'Test Group',
        pax: '45',
        totalBuses: 'abc',
        arrivalDate: '2024-03-15',
        returnDate: '2024-03-25',
      };

      const result = schema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('date validation', () => {
    it('should reject empty arrivalDate', () => {
      const invalidData = {
        code: 'GRP-001',
        name: 'Test Group',
        pax: '45',
        totalBuses: '2',
        arrivalDate: '',
        returnDate: '2024-03-25',
      };

      const result = schema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Start Date wajib diisi.');
      }
    });

    it('should reject empty returnDate', () => {
      const invalidData = {
        code: 'GRP-001',
        name: 'Test Group',
        pax: '45',
        totalBuses: '2',
        arrivalDate: '2024-03-15',
        returnDate: '',
      };

      const result = schema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('End Date wajib diisi.');
      }
    });

    it('should reject returnDate before arrivalDate', () => {
      const invalidData = {
        code: 'GRP-001',
        name: 'Test Group',
        pax: '45',
        totalBuses: '2',
        arrivalDate: '2024-03-25',
        returnDate: '2024-03-15',
      };

      const result = schema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('End Date tidak boleh sebelum Start Date.');
      }
    });

    it('should accept same arrival and return date', () => {
      const validData = {
        code: 'GRP-001',
        name: 'Test Group',
        pax: '45',
        totalBuses: '2',
        arrivalDate: '2024-03-15',
        returnDate: '2024-03-15',
      };

      const result = schema.safeParse(validData);
      expect(result.success).toBe(true);
    });
  });

  describe('bus count validation', () => {
    it('should reject insufficient buses for pax count', () => {
      // getMinimumBusCountForPax(51) returns Math.ceil(51/50) = 2
      const invalidData = {
        code: 'GRP-001',
        name: 'Test Group',
        pax: '51',
        totalBuses: '1',
        arrivalDate: '2024-03-15',
        returnDate: '2024-03-25',
      };

      const result = schema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('bus diperlukan');
      }
    });

    it('should accept sufficient buses for pax count', () => {
      const validData = {
        code: 'GRP-001',
        name: 'Test Group',
        pax: '45',
        totalBuses: '2',
        arrivalDate: '2024-03-15',
        returnDate: '2024-03-25',
      };

      const result = schema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should accept more buses than minimum required', () => {
      const validData = {
        code: 'GRP-001',
        name: 'Test Group',
        pax: '45',
        totalBuses: '3',
        arrivalDate: '2024-03-15',
        returnDate: '2024-03-25',
      };

      const result = schema.safeParse(validData);
      expect(result.success).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should trim whitespace from all string fields', () => {
      const validData = {
        code: '  GRP-001  ',
        name: '  Test Group  ',
        pax: '  45  ',
        totalBuses: '  2  ',
        arrivalDate: '  2024-03-15  ',
        returnDate: '  2024-03-25  ',
      };

      const result = schema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should accept large pax count', () => {
      const validData = {
        code: 'GRP-001',
        name: 'Test Group',
        pax: '500',
        totalBuses: '15',
        arrivalDate: '2024-03-15',
        returnDate: '2024-03-25',
      };

      const result = schema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should accept long group names', () => {
      const validData = {
        code: 'GRP-001',
        name: 'A'.repeat(100),
        pax: '45',
        totalBuses: '2',
        arrivalDate: '2024-03-15',
        returnDate: '2024-03-25',
      };

      const result = schema.safeParse(validData);
      expect(result.success).toBe(true);
    });
  });
});
