import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  getFieldErrorId,
  getFieldDescribedBy,
  getFieldAriaInvalid,
  FieldErrorMessage,
} from '../form-accessibility';

describe('form-accessibility', () => {
  describe('getFieldErrorId', () => {
    it('should append -error suffix to fieldId', () => {
      expect(getFieldErrorId('username')).toBe('username-error');
      expect(getFieldErrorId('email-field')).toBe('email-field-error');
    });

    it('should handle empty string', () => {
      expect(getFieldErrorId('')).toBe('-error');
    });
  });

  describe('getFieldDescribedBy', () => {
    it('should return undefined when no ids provided', () => {
      expect(getFieldDescribedBy('field1')).toBeUndefined();
      expect(getFieldDescribedBy('field1', {})).toBeUndefined();
    });

    it('should return describedBy when provided', () => {
      expect(getFieldDescribedBy('field1', { describedBy: 'helper-text' })).toBe('helper-text');
    });

    it('should append error id when errorMessage is truthy', () => {
      const result = getFieldDescribedBy('field1', {
        describedBy: 'helper',
        errorMessage: 'Error message',
      });
      expect(result).toBe('helper field1-error');
    });

    it('should not append error id when errorMessage is falsy', () => {
      expect(getFieldDescribedBy('field1', { describedBy: 'helper', errorMessage: null })).toBe(
        'helper'
      );
      expect(
        getFieldDescribedBy('field1', { describedBy: 'helper', errorMessage: '' })
      ).toBe('helper');
    });

    it('should include extraDescribedBy ids', () => {
      const result = getFieldDescribedBy('field1', {
        describedBy: 'helper',
        extraDescribedBy: ['extra1', 'extra2'],
      });
      expect(result).toBe('helper extra1 extra2');
    });

    it('should filter out null and undefined from extraDescribedBy', () => {
      const result = getFieldDescribedBy('field1', {
        describedBy: 'helper',
        extraDescribedBy: ['extra1', null, undefined, 'extra2'],
      });
      expect(result).toBe('helper extra1 extra2');
    });

    it('should filter out empty strings', () => {
      const result = getFieldDescribedBy('field1', {
        describedBy: 'helper',
        extraDescribedBy: ['', '  ', 'valid'],
        errorMessage: 'Error',
      });
      expect(result).toBe('helper valid field1-error');
    });

    it('should handle all options together', () => {
      const result = getFieldDescribedBy('field1', {
        describedBy: 'helper',
        extraDescribedBy: ['extra1'],
        errorMessage: 'Error message',
      });
      expect(result).toBe('helper extra1 field1-error');
    });
  });

  describe('getFieldAriaInvalid', () => {
    it('should return "true" when errorMessage is truthy', () => {
      expect(getFieldAriaInvalid('Error')).toBe('true');
      expect(getFieldAriaInvalid(' ')).toBe('true');
    });

    it('should return "false" when errorMessage is falsy', () => {
      expect(getFieldAriaInvalid('')).toBe('false');
      expect(getFieldAriaInvalid(null)).toBe('false');
      expect(getFieldAriaInvalid(undefined)).toBe('false');
    });
  });

  describe('FieldErrorMessage', () => {
    it('should render nothing when message is falsy', () => {
      const { container } = render(
        <FieldErrorMessage fieldId="field1" message={null} />
      );
      expect(container.firstChild).toBeNull();

      const { container: container2 } = render(
        <FieldErrorMessage fieldId="field1" message="" />
      );
      expect(container2.firstChild).toBeNull();

      const { container: container3 } = render(
        <FieldErrorMessage fieldId="field1" message={undefined} />
      );
      expect(container3.firstChild).toBeNull();
    });

    it('should render error message when message is truthy', () => {
      render(<FieldErrorMessage fieldId="field1" message="Error occurred" />);
      expect(screen.getByText('Error occurred')).toBeInTheDocument();
    });

    it('should have correct id based on fieldId', () => {
      render(<FieldErrorMessage fieldId="username" message="Required" />);
      const errorElement = screen.getByText('Required');
      expect(errorElement).toHaveAttribute('id', 'username-error');
    });

    it('should have role="alert"', () => {
      render(<FieldErrorMessage fieldId="field1" message="Error" />);
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('should have aria-live="polite"', () => {
      render(<FieldErrorMessage fieldId="field1" message="Error" />);
      const errorElement = screen.getByText('Error');
      expect(errorElement).toHaveAttribute('aria-live', 'polite');
    });

    it('should apply default className', () => {
      render(<FieldErrorMessage fieldId="field1" message="Error" />);
      const errorElement = screen.getByText('Error');
      expect(errorElement.className).toContain('text-xs');
      expect(errorElement.className).toContain('font-semibold');
      expect(errorElement.className).toContain('text-error');
      expect(errorElement.className).toContain('animate-slide-down');
    });

    it('should apply custom className', () => {
      render(
        <FieldErrorMessage
          fieldId="field1"
          message="Error"
          className="custom-class"
        />
      );
      const errorElement = screen.getByText('Error');
      expect(errorElement.className).toBe('custom-class animate-slide-down');
    });
  });
});
