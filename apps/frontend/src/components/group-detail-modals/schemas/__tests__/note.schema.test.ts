import { describe, it, expect } from 'vitest';
import { noteModalSchema } from '../note.schema';

describe('noteModalSchema', () => {
  describe('valid data', () => {
    it('should validate valid note with pinned false', () => {
      const validData = {
        text: 'This is an important operational note.',
        pinned: false,
      };

      const result = noteModalSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should validate valid note with pinned true', () => {
      const validData = {
        text: 'This is a pinned note.',
        pinned: true,
      };

      const result = noteModalSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should trim whitespace from text', () => {
      const data = {
        text: '  Important note  ',
        pinned: false,
      };

      const result = noteModalSchema.parse(data);
      expect(result.text).toBe('Important note');
    });
  });

  describe('text validation', () => {
    it('should reject empty text', () => {
      const data = {
        text: '',
        pinned: false,
      };

      const result = noteModalSchema.safeParse(data);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Operational note wajib diisi.');
      }
    });

    it('should reject whitespace-only text', () => {
      const data = {
        text: '   ',
        pinned: false,
      };

      const result = noteModalSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should accept text at max length (2000 characters)', () => {
      const data = {
        text: 'A'.repeat(2000),
        pinned: false,
      };

      const result = noteModalSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should reject text over max length', () => {
      const data = {
        text: 'A'.repeat(2001),
        pinned: false,
      };

      const result = noteModalSchema.safeParse(data);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Maksimal 2000 karakter.');
      }
    });

    it('should accept single character text', () => {
      const data = {
        text: 'A',
        pinned: false,
      };

      const result = noteModalSchema.safeParse(data);
      expect(result.success).toBe(true);
    });
  });

  describe('pinned validation', () => {
    it('should accept boolean true', () => {
      const data = {
        text: 'Valid note',
        pinned: true,
      };

      const result = noteModalSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should accept boolean false', () => {
      const data = {
        text: 'Valid note',
        pinned: false,
      };

      const result = noteModalSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should reject string for pinned', () => {
      const data = {
        text: 'Valid note',
        pinned: 'true',
      };

      const result = noteModalSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should reject number for pinned', () => {
      const data = {
        text: 'Valid note',
        pinned: 1,
      };

      const result = noteModalSchema.safeParse(data);
      expect(result.success).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should accept text with special characters', () => {
      const data = {
        text: 'Note with !@#$%^&*() special chars',
        pinned: false,
      };

      const result = noteModalSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should accept text with newlines', () => {
      const data = {
        text: 'Line 1\nLine 2\nLine 3',
        pinned: false,
      };

      const result = noteModalSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should accept text with unicode characters', () => {
      const data = {
        text: 'Note with emoji 🕌 and Arabic: مرحبا',
        pinned: false,
      };

      const result = noteModalSchema.safeParse(data);
      expect(result.success).toBe(true);
    });
  });
});
