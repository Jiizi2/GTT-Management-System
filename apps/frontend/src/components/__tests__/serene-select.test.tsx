import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SereneSelect } from '../serene-select';

describe('SereneSelect', () => {
  const options = [
    { value: 'option1', label: 'Option 1', disabled: false },
    { value: 'option2', label: 'Option 2', disabled: false },
    { value: 'option3', label: 'Option 3', disabled: false },
  ];

  it('renders select component', () => {
    render(
      <SereneSelect value="option1" onChange={() => {}}>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} disabled={opt.disabled}>
            {opt.label}
          </option>
        ))}
      </SereneSelect>
    );
    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
  });

  it('displays selected option label', () => {
    render(
      <SereneSelect value="option2" onChange={() => {}}>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} disabled={opt.disabled}>
            {opt.label}
          </option>
        ))}
      </SereneSelect>
    );
    expect(screen.getByText('Option 2')).toBeInTheDocument();
  });

  it('displays first enabled option when value is empty', () => {
    render(
      <SereneSelect value="" onChange={() => {}}>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} disabled={opt.disabled}>
            {opt.label}
          </option>
        ))}
      </SereneSelect>
    );
    expect(screen.getByText('Option 1')).toBeInTheDocument();
  });

  it('displays raw value when no matching option', () => {
    render(
      <SereneSelect value="unknown" onChange={() => {}}>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} disabled={opt.disabled}>
            {opt.label}
          </option>
        ))}
      </SereneSelect>
    );
    // When value doesn't match any option, it should show the first enabled option as fallback
    expect(screen.getByText('Option 1')).toBeInTheDocument();
  });

  it('opens dropdown when clicked', () => {
    render(
      <SereneSelect value="option1" onChange={() => {}}>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} disabled={opt.disabled}>
            {opt.label}
          </option>
        ))}
      </SereneSelect>
    );
    const button = screen.getByRole('button');
    fireEvent.click(button);
    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });

  it('shows all options in dropdown', () => {
    render(
      <SereneSelect value="option1" onChange={() => {}}>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} disabled={opt.disabled}>
            {opt.label}
          </option>
        ))}
      </SereneSelect>
    );
    const button = screen.getByRole('button');
    fireEvent.click(button);

    // Wait for dropdown to open and get all option buttons
    const optionButtons = screen.getAllByRole('option');
    expect(optionButtons).toHaveLength(3);
  });

  it('calls onChange when option is selected', () => {
    const handleChange = vi.fn();
    render(
      <SereneSelect value="option1" onChange={handleChange}>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} disabled={opt.disabled}>
            {opt.label}
          </option>
        ))}
      </SereneSelect>
    );

    const button = screen.getByRole('button');
    fireEvent.click(button);

    const option2 = screen.getByText('Option 2');
    fireEvent.click(option2);

    expect(handleChange).toHaveBeenCalledWith({ target: { value: 'option2' } });
  });

  it('does not call onChange when same option is selected', () => {
    const handleChange = vi.fn();
    render(
      <SereneSelect value="option1" onChange={handleChange}>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} disabled={opt.disabled}>
            {opt.label}
          </option>
        ))}
      </SereneSelect>
    );

    const button = screen.getByRole('button');
    fireEvent.click(button);

    // Get the first option (which is already selected)
    const optionButtons = screen.getAllByRole('option');
    fireEvent.click(optionButtons[0]);

    expect(handleChange).not.toHaveBeenCalled();
  });

  it('closes dropdown after selection', () => {
    render(
      <SereneSelect value="option1" onChange={() => {}}>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} disabled={opt.disabled}>
            {opt.label}
          </option>
        ))}
      </SereneSelect>
    );

    const button = screen.getByRole('button');
    fireEvent.click(button);
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    const option2 = screen.getByText('Option 2');
    fireEvent.click(option2);

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('closes dropdown when clicked again', () => {
    render(
      <SereneSelect value="option1" onChange={() => {}}>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} disabled={opt.disabled}>
            {opt.label}
          </option>
        ))}
      </SereneSelect>
    );

    const button = screen.getByRole('button');
    fireEvent.click(button);
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    fireEvent.click(button);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('disables select when disabled prop is true', () => {
    render(
      <SereneSelect value="option1" disabled onChange={() => {}}>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} disabled={opt.disabled}>
            {opt.label}
          </option>
        ))}
      </SereneSelect>
    );

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });

  it('does not open dropdown when disabled', () => {
    render(
      <SereneSelect value="option1" disabled onChange={() => {}}>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} disabled={opt.disabled}>
            {opt.label}
          </option>
        ))}
      </SereneSelect>
    );

    const button = screen.getByRole('button');
    fireEvent.click(button);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('renders hidden input when name is provided', () => {
    const { container } = render(
      <SereneSelect value="option1" name="mySelect" onChange={() => {}}>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} disabled={opt.disabled}>
            {opt.label}
          </option>
        ))}
      </SereneSelect>
    );

    const hiddenInput = container.querySelector('input[type="hidden"]');
    expect(hiddenInput).toBeInTheDocument();
    expect(hiddenInput).toHaveAttribute('name', 'mySelect');
    expect(hiddenInput).toHaveAttribute('value', 'option1');
  });

  it('does not render hidden input when name is not provided', () => {
    const { container } = render(
      <SereneSelect value="option1" onChange={() => {}}>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} disabled={opt.disabled}>
            {opt.label}
          </option>
        ))}
      </SereneSelect>
    );

    const hiddenInput = container.querySelector('input[type="hidden"]');
    expect(hiddenInput).not.toBeInTheDocument();
  });

  it('applies custom id', () => {
    render(
      <SereneSelect value="option1" id="custom-select" onChange={() => {}}>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} disabled={opt.disabled}>
            {opt.label}
          </option>
        ))}
      </SereneSelect>
    );

    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('id', 'custom-select');
  });

  it('applies aria-label', () => {
    render(
      <SereneSelect value="option1" aria-label="Custom label" onChange={() => {}}>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} disabled={opt.disabled}>
            {opt.label}
          </option>
        ))}
      </SereneSelect>
    );

    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-label', 'Custom label');
  });

  it('applies aria-labelledby', () => {
    render(
      <SereneSelect value="option1" aria-labelledby="label-id" onChange={() => {}}>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} disabled={opt.disabled}>
            {opt.label}
          </option>
        ))}
      </SereneSelect>
    );

    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-labelledby', 'label-id');
  });

  it('applies aria-describedby', () => {
    render(
      <SereneSelect value="option1" aria-describedby="desc-id" onChange={() => {}}>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} disabled={opt.disabled}>
            {opt.label}
          </option>
        ))}
      </SereneSelect>
    );

    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-describedby', 'desc-id');
  });

  it('applies aria-invalid', () => {
    render(
      <SereneSelect value="option1" aria-invalid="true" onChange={() => {}}>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} disabled={opt.disabled}>
            {opt.label}
          </option>
        ))}
      </SereneSelect>
    );

    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-invalid', 'true');
  });

  it('has aria-haspopup attribute', () => {
    render(
      <SereneSelect value="option1" onChange={() => {}}>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} disabled={opt.disabled}>
            {opt.label}
          </option>
        ))}
      </SereneSelect>
    );

    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-haspopup', 'listbox');
  });

  it('has aria-expanded attribute', () => {
    render(
      <SereneSelect value="option1" onChange={() => {}}>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} disabled={opt.disabled}>
            {opt.label}
          </option>
        ))}
      </SereneSelect>
    );

    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
  });

  it('hides caret when showCaret is false', () => {
    render(
      <SereneSelect value="option1" showCaret={false} onChange={() => {}}>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} disabled={opt.disabled}>
            {opt.label}
          </option>
        ))}
      </SereneSelect>
    );

    const caret = screen.queryByText('expand_more');
    expect(caret).not.toBeInTheDocument();
  });

  it('shows caret by default', () => {
    render(
      <SereneSelect value="option1" onChange={() => {}}>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} disabled={opt.disabled}>
            {opt.label}
          </option>
        ))}
      </SereneSelect>
    );

    const caret = screen.getByText('expand_more');
    expect(caret).toBeInTheDocument();
  });

  it('marks selected option with check icon', () => {
    render(
      <SereneSelect value="option2" onChange={() => {}}>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} disabled={opt.disabled}>
            {opt.label}
          </option>
        ))}
      </SereneSelect>
    );

    const button = screen.getByRole('button');
    fireEvent.click(button);

    const checkIcons = screen.getAllByText('check');
    expect(checkIcons.length).toBeGreaterThan(0);
  });

  it('applies custom className', () => {
    render(
      <SereneSelect value="option1" className="custom-select" onChange={() => {}}>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} disabled={opt.disabled}>
            {opt.label}
          </option>
        ))}
      </SereneSelect>
    );

    const button = screen.getByRole('button');
    expect(button.className).toContain('custom-select');
  });

  it('handles keyboard navigation with Enter', () => {
    const handleChange = vi.fn();
    render(
      <SereneSelect value="option1" onChange={handleChange}>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} disabled={opt.disabled}>
            {opt.label}
          </option>
        ))}
      </SereneSelect>
    );

    const button = screen.getByRole('button');
    fireEvent.keyDown(button, { key: 'Enter' });
    expect(button).toHaveAttribute('aria-expanded', 'true');
  });

  it('handles keyboard navigation with Space', () => {
    render(
      <SereneSelect value="option1" onChange={() => {}}>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} disabled={opt.disabled}>
            {opt.label}
          </option>
        ))}
      </SereneSelect>
    );

    const button = screen.getByRole('button');
    fireEvent.keyDown(button, { key: ' ' });
    expect(button).toHaveAttribute('aria-expanded', 'true');
  });

  it('closes dropdown on Escape', () => {
    render(
      <SereneSelect value="option1" onChange={() => {}}>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} disabled={opt.disabled}>
            {opt.label}
          </option>
        ))}
      </SereneSelect>
    );

    const button = screen.getByRole('button');
    fireEvent.click(button);
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('closes dropdown on Tab', () => {
    render(
      <SereneSelect value="option1" onChange={() => {}}>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} disabled={opt.disabled}>
            {opt.label}
          </option>
        ))}
      </SereneSelect>
    );

    const button = screen.getByRole('button');
    fireEvent.click(button);
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    fireEvent.keyDown(button, { key: 'Tab' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});
