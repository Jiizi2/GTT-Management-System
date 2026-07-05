import { describe, it, expect } from 'vitest';
import { shouldUseSaudiCityDropdown } from '../schedule-helpers';

describe('schedule-helpers', () => {
  describe('shouldUseSaudiCityDropdown', () => {
    it('should return true for arrival category', () => {
      expect(shouldUseSaudiCityDropdown('arrival', 'from')).toBe(true);
      expect(shouldUseSaudiCityDropdown('arrival', 'to')).toBe(true);
    });

    it('should return true for transfer category', () => {
      expect(shouldUseSaudiCityDropdown('transfer', 'from')).toBe(true);
      expect(shouldUseSaudiCityDropdown('transfer', 'to')).toBe(true);
    });

    it('should return true for departure category', () => {
      expect(shouldUseSaudiCityDropdown('departure', 'from')).toBe(true);
      expect(shouldUseSaudiCityDropdown('departure', 'to')).toBe(true);
    });

    it('should return false for city-tour category', () => {
      expect(shouldUseSaudiCityDropdown('city-tour', 'from')).toBe(false);
      expect(shouldUseSaudiCityDropdown('city-tour', 'to')).toBe(false);
    });

    it('should return false for other categories', () => {
      expect(shouldUseSaudiCityDropdown('hotel', 'from')).toBe(false);
      expect(shouldUseSaudiCityDropdown('restaurant', 'to')).toBe(false);
      expect(shouldUseSaudiCityDropdown('activity', 'from')).toBe(false);
    });

    it('should return false for empty category', () => {
      expect(shouldUseSaudiCityDropdown('', 'from')).toBe(false);
      expect(shouldUseSaudiCityDropdown('', 'to')).toBe(false);
    });
  });
});
