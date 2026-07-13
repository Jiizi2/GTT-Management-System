import { describe, it, expect } from 'vitest';
import { musyrifModalSchema } from '../musyrif.schema';

describe('musyrifModalSchema', () => {
  describe('valid data', () => {
    it('should validate valid musyrif data', () => {
      const validData = {
        name: 'Ahmad Fauzi',
        phone: '+6281234567890',
      };

      const result = musyrifModalSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should trim whitespace from name', () => {
      const data = {
        name: '  Ahmad Fauzi  ',
        phone: '+6281234567890',
      };

      const result = musyrifModalSchema.parse(data);
      expect(result.name).toBe('Ahmad Fauzi');
    });

    it('should trim whitespace from phone', () => {
      const data = {
        name: 'Ahmad Fauzi',
        phone: '  +6281234567890  ',
      };

      const result = musyrifModalSchema.parse(data);
      expect(result.phone).toBe('+6281234567890');
    });
  });

  describe('name validation', () => {
    it('should reject empty name', () => {
      const data = {
        name: '',
        phone: '+6281234567890',
      };

      const result = musyrifModalSchema.safeParse(data);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Musyrif name wajib diisi.');
      }
    });

    it('should reject whitespace-only name', () => {
      const data = {
        name: '   ',
        phone: '+6281234567890',
      };

      const result = musyrifModalSchema.safeParse(data);
      expect(result.success).toBe(false);
    });
  });

  describe('phone validation', () => {
    it('should reject empty phone', () => {
      const data = {
        name: 'Ahmad Fauzi',
        phone: '',
      };

      const result = musyrifModalSchema.safeParse(data);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Phone number wajib diisi.');
      }
    });

    it('should reject whitespace-only phone', () => {
      const data = {
        name: 'Ahmad Fauzi',
        phone: '   ',
      };

      const result = musyrifModalSchema.safeParse(data);
      expect(result.success).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should accept single character name', () => {
      const data = {
        name: 'A',
        phone: '+6281234567890',
      };

      const result = musyrifModalSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should accept single character phone', () => {
      const data = {
        name: 'Ahmad Fauzi',
        phone: '1',
      };

      const result = musyrifModalSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should accept long names', () => {
      const data = {
        name: 'A'.repeat(100),
        phone: '+6281234567890',
      };

      const result = musyrifModalSchema.safeParse(data);
      expect(result.success).toBe(true);
    });
  });
});
