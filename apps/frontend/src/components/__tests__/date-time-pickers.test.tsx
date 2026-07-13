import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DatePickerInput, TimePickerInput } from '../date-time-pickers';

describe('DatePickerInput', () => {
  const defaultProps = {
    value: '2024-06-15',
    onChange: vi.fn(),
    inputClassName: 'test-input',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render input with formatted date', () => {
    render(<DatePickerInput {...defaultProps} />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveValue('15/06/2024');
  });

  it('should render empty input when value is empty', () => {
    render(<DatePickerInput {...defaultProps} value="" />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveValue('');
  });

  it('should have placeholder text', () => {
    render(<DatePickerInput {...defaultProps} placeholder="Select date" />);
    const input = screen.getByPlaceholderText('Select date');
    expect(input).toBeInTheDocument();
  });

  it('should use default placeholder when not provided', () => {
    render(<DatePickerInput {...defaultProps} />);
    const input = screen.getByPlaceholderText('dd/mm/yyyy');
    expect(input).toBeInTheDocument();
  });

  it('should be read-only', () => {
    render(<DatePickerInput {...defaultProps} />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('aria-readonly', 'true');
  });

  it('should have calendar icon', () => {
    render(<DatePickerInput {...defaultProps} />);
    expect(screen.getByText('calendar_month')).toBeInTheDocument();
  });

  it('should open calendar on click', async () => {
    const user = userEvent.setup();
    render(<DatePickerInput {...defaultProps} />);
    const input = screen.getByRole('textbox');

    await user.click(input);
    expect(screen.getByRole('dialog', { name: /select date/i })).toBeInTheDocument();
  });

  it('should open calendar on focus', async () => {
    const user = userEvent.setup();
    render(<DatePickerInput {...defaultProps} />);
    const input = screen.getByRole('textbox');

    await user.tab();
    expect(screen.getByRole('dialog', { name: /select date/i })).toBeInTheDocument();
  });

  it('should open calendar on Enter key', async () => {
    const user = userEvent.setup();
    render(<DatePickerInput {...defaultProps} />);
    const input = screen.getByRole('textbox');

    await user.tab();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('dialog', { name: /select date/i })).toBeInTheDocument();
  });

  it('should open calendar on Space key', async () => {
    const user = userEvent.setup();
    render(<DatePickerInput {...defaultProps} />);
    const input = screen.getByRole('textbox');

    await user.tab();
    await user.keyboard(' ');
    expect(screen.getByRole('dialog', { name: /select date/i })).toBeInTheDocument();
  });

  it('should open calendar on ArrowDown key', async () => {
    const user = userEvent.setup();
    render(<DatePickerInput {...defaultProps} />);
    const input = screen.getByRole('textbox');

    await user.tab();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('dialog', { name: /select date/i })).toBeInTheDocument();
  });

  it('should not open calendar when disabled', async () => {
    const user = userEvent.setup();
    render(<DatePickerInput {...defaultProps} disabled />);
    const input = screen.getByRole('textbox');

    await user.click(input);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('should display disabled state', () => {
    render(<DatePickerInput {...defaultProps} disabled />);
    const input = screen.getByRole('textbox');
    expect(input).toBeDisabled();
  });

  it('should have correct aria attributes when closed', () => {
    render(<DatePickerInput {...defaultProps} />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(input).toHaveAttribute('aria-haspopup', 'dialog');
  });

  it('should have correct aria attributes when open', async () => {
    const user = userEvent.setup();
    render(<DatePickerInput {...defaultProps} />);
    const input = screen.getByRole('textbox');

    await user.click(input);
    expect(input).toHaveAttribute('aria-expanded', 'true');
  });

  it('should apply aria-invalid when provided', () => {
    render(<DatePickerInput {...defaultProps} ariaInvalid="true" />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('aria-invalid', 'true');
  });

  it('should apply aria-describedby when provided', () => {
    render(<DatePickerInput {...defaultProps} ariaDescribedBy="date-helper" />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('aria-describedby', 'date-helper');
  });

  it('should display month navigation buttons', async () => {
    const user = userEvent.setup();
    render(<DatePickerInput {...defaultProps} />);

    await user.click(screen.getByRole('textbox'));
    expect(screen.getByRole('button', { name: /previous month/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /next month/i })).toBeInTheDocument();
  });

  it('should display current month and year', async () => {
    const user = userEvent.setup();
    render(<DatePickerInput {...defaultProps} />);

    await user.click(screen.getByRole('textbox'));
    expect(screen.getByText('June 2024')).toBeInTheDocument();
  });

  it('should display day labels', async () => {
    const user = userEvent.setup();
    render(<DatePickerInput {...defaultProps} />);

    await user.click(screen.getByRole('textbox'));
    expect(screen.getByText('Su')).toBeInTheDocument();
    expect(screen.getByText('Mo')).toBeInTheDocument();
    expect(screen.getByText('Tu')).toBeInTheDocument();
    expect(screen.getByText('We')).toBeInTheDocument();
    expect(screen.getByText('Th')).toBeInTheDocument();
    expect(screen.getByText('Fr')).toBeInTheDocument();
    expect(screen.getByText('Sa')).toBeInTheDocument();
  });

  it('should call onChange when date is selected', async () => {
    const user = userEvent.setup();
    render(<DatePickerInput {...defaultProps} />);

    await user.click(screen.getByRole('textbox'));
    await user.click(screen.getByRole('button', { name: '20' }));

    expect(defaultProps.onChange).toHaveBeenCalledWith('2024-06-20');
  });

  it('should close calendar after date selection', async () => {
    const user = userEvent.setup();
    render(<DatePickerInput {...defaultProps} />);

    await user.click(screen.getByRole('textbox'));
    await user.click(screen.getByRole('button', { name: '20' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('should navigate to previous month', async () => {
    const user = userEvent.setup();
    render(<DatePickerInput {...defaultProps} />);

    await user.click(screen.getByRole('textbox'));
    expect(screen.getByText('June 2024')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /previous month/i }));
    expect(screen.getByText('May 2024')).toBeInTheDocument();
  });

  it('should navigate to next month', async () => {
    const user = userEvent.setup();
    render(<DatePickerInput {...defaultProps} />);

    await user.click(screen.getByRole('textbox'));
    expect(screen.getByText('June 2024')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /next month/i }));
    expect(screen.getByText('July 2024')).toBeInTheDocument();
  });

  it('should clear date when Clear button is clicked', async () => {
    const user = userEvent.setup();
    render(<DatePickerInput {...defaultProps} />);

    await user.click(screen.getByRole('textbox'));
    await user.click(screen.getByRole('button', { name: /clear/i }));

    expect(defaultProps.onChange).toHaveBeenCalledWith('');
  });

  it('should set today date when Today button is clicked', async () => {
    const user = userEvent.setup();
    render(<DatePickerInput {...defaultProps} />);

    await user.click(screen.getByRole('textbox'));
    await user.click(screen.getByRole('button', { name: /today/i }));

    expect(defaultProps.onChange).toHaveBeenCalled();
    const calledDate = defaultProps.onChange.mock.calls[0][0];
    expect(calledDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('should close calendar on Escape key', async () => {
    const user = userEvent.setup();
    render(<DatePickerInput {...defaultProps} />);

    await user.click(screen.getByRole('textbox'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('should apply custom id', () => {
    render(<DatePickerInput {...defaultProps} id="date-field" />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('id', 'date-field');
  });
});

describe('TimePickerInput', () => {
  const defaultProps = {
    value: '14:30',
    onChange: vi.fn(),
    inputClassName: 'test-input',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render input with formatted time', () => {
    render(<TimePickerInput {...defaultProps} />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveValue('14:30');
  });

  it('should render empty input when value is empty', () => {
    render(<TimePickerInput {...defaultProps} value="" />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveValue('');
  });

  it('should have placeholder text', () => {
    render(<TimePickerInput {...defaultProps} placeholder="Select time" />);
    const input = screen.getByPlaceholderText('Select time');
    expect(input).toBeInTheDocument();
  });

  it('should use default placeholder when not provided', () => {
    render(<TimePickerInput {...defaultProps} />);
    const input = screen.getByPlaceholderText('--:--');
    expect(input).toBeInTheDocument();
  });

  it('should be read-only', () => {
    render(<TimePickerInput {...defaultProps} />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('aria-readonly', 'true');
  });

  it('should have schedule icon', () => {
    render(<TimePickerInput {...defaultProps} />);
    expect(screen.getByText('schedule')).toBeInTheDocument();
  });

  it('should open picker on click', async () => {
    const user = userEvent.setup();
    render(<TimePickerInput {...defaultProps} />);
    const input = screen.getByRole('textbox');

    await user.click(input);
    expect(screen.getByRole('dialog', { name: /select time/i })).toBeInTheDocument();
  });

  it('should open picker on focus', async () => {
    const user = userEvent.setup();
    render(<TimePickerInput {...defaultProps} />);
    const input = screen.getByRole('textbox');

    await user.tab();
    expect(screen.getByRole('dialog', { name: /select time/i })).toBeInTheDocument();
  });

  it('should open picker on Enter key', async () => {
    const user = userEvent.setup();
    render(<TimePickerInput {...defaultProps} />);
    const input = screen.getByRole('textbox');

    await user.tab();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('dialog', { name: /select time/i })).toBeInTheDocument();
  });

  it('should open picker on Space key', async () => {
    const user = userEvent.setup();
    render(<TimePickerInput {...defaultProps} />);
    const input = screen.getByRole('textbox');

    await user.tab();
    await user.keyboard(' ');
    expect(screen.getByRole('dialog', { name: /select time/i })).toBeInTheDocument();
  });

  it('should open picker on ArrowDown key', async () => {
    const user = userEvent.setup();
    render(<TimePickerInput {...defaultProps} />);
    const input = screen.getByRole('textbox');

    await user.tab();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('dialog', { name: /select time/i })).toBeInTheDocument();
  });

  it('should not open picker when disabled', async () => {
    const user = userEvent.setup();
    render(<TimePickerInput {...defaultProps} disabled />);
    const input = screen.getByRole('textbox');

    await user.click(input);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('should display disabled state', () => {
    render(<TimePickerInput {...defaultProps} disabled />);
    const input = screen.getByRole('textbox');
    expect(input).toBeDisabled();
  });

  it('should have correct aria attributes when closed', () => {
    render(<TimePickerInput {...defaultProps} />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(input).toHaveAttribute('aria-haspopup', 'dialog');
  });

  it('should have correct aria attributes when open', async () => {
    const user = userEvent.setup();
    render(<TimePickerInput {...defaultProps} />);
    const input = screen.getByRole('textbox');

    await user.click(input);
    expect(input).toHaveAttribute('aria-expanded', 'true');
  });

  it('should apply aria-invalid when provided', () => {
    render(<TimePickerInput {...defaultProps} ariaInvalid="true" />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('aria-invalid', 'true');
  });

  it('should apply aria-describedby when provided', () => {
    render(<TimePickerInput {...defaultProps} ariaDescribedBy="time-helper" />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('aria-describedby', 'time-helper');
  });

  it('should display hour and minute selects', async () => {
    const user = userEvent.setup();
    render(<TimePickerInput {...defaultProps} />);

    await user.click(screen.getByRole('textbox'));
    expect(screen.getByText('Hour')).toBeInTheDocument();
    expect(screen.getByText('Minute')).toBeInTheDocument();
  });

  it('should display hour options from 00 to 23', async () => {
    const user = userEvent.setup();
    render(<TimePickerInput {...defaultProps} />);

    await user.click(screen.getByRole('textbox'));
    const hourSelect = screen.getAllByRole('combobox')[0];
    const hourOptions = hourSelect.querySelectorAll('option');

    expect(hourOptions.length).toBe(24);
    expect(hourOptions[0].value).toBe('00');
    expect(hourOptions[23].value).toBe('23');
  });

  it('should display minute options from 00 to 59', async () => {
    const user = userEvent.setup();
    render(<TimePickerInput {...defaultProps} />);

    await user.click(screen.getByRole('textbox'));
    const minuteSelect = screen.getAllByRole('combobox')[1];
    const minuteOptions = minuteSelect.querySelectorAll('option');

    expect(minuteOptions.length).toBe(60);
    expect(minuteOptions[0].value).toBe('00');
    expect(minuteOptions[59].value).toBe('59');
  });

  it('should select hour from dropdown', async () => {
    const user = userEvent.setup();
    render(<TimePickerInput {...defaultProps} />);

    await user.click(screen.getByRole('textbox'));
    const hourSelect = screen.getAllByRole('combobox')[0];

    await user.selectOptions(hourSelect, '10');
    expect(hourSelect).toHaveValue('10');
  });

  it('should select minute from dropdown', async () => {
    const user = userEvent.setup();
    render(<TimePickerInput {...defaultProps} />);

    await user.click(screen.getByRole('textbox'));
    const minuteSelect = screen.getAllByRole('combobox')[1];

    await user.selectOptions(minuteSelect, '45');
    expect(minuteSelect).toHaveValue('45');
  });

  it('should call onChange when Apply is clicked', async () => {
    const user = userEvent.setup();
    render(<TimePickerInput {...defaultProps} />);

    await user.click(screen.getByRole('textbox'));
    await user.click(screen.getByRole('button', { name: /apply/i }));

    expect(defaultProps.onChange).toHaveBeenCalledWith('14:30');
  });

  it('should close picker after Apply', async () => {
    const user = userEvent.setup();
    render(<TimePickerInput {...defaultProps} />);

    await user.click(screen.getByRole('textbox'));
    await user.click(screen.getByRole('button', { name: /apply/i }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('should call onChange with new time after selection and Apply', async () => {
    const user = userEvent.setup();
    render(<TimePickerInput {...defaultProps} />);

    await user.click(screen.getByRole('textbox'));
    const hourSelect = screen.getAllByRole('combobox')[0];
    const minuteSelect = screen.getAllByRole('combobox')[1];

    await user.selectOptions(hourSelect, '10');
    await user.selectOptions(minuteSelect, '45');
    await user.click(screen.getByRole('button', { name: /apply/i }));

    expect(defaultProps.onChange).toHaveBeenCalledWith('10:45');
  });

  it('should clear time when Clear button is clicked', async () => {
    const user = userEvent.setup();
    render(<TimePickerInput {...defaultProps} />);

    await user.click(screen.getByRole('textbox'));
    await user.click(screen.getByRole('button', { name: /clear/i }));

    expect(defaultProps.onChange).toHaveBeenCalledWith('');
  });

  it('should set current time when Now button is clicked', async () => {
    const user = userEvent.setup();
    render(<TimePickerInput {...defaultProps} />);

    await user.click(screen.getByRole('textbox'));
    await user.click(screen.getByRole('button', { name: /now/i }));

    // Now button updates draft values, need to click Apply
    await user.click(screen.getByRole('button', { name: /apply/i }));

    expect(defaultProps.onChange).toHaveBeenCalled();
    const calledTime = defaultProps.onChange.mock.calls[0][0];
    expect(calledTime).toMatch(/^\d{2}:\d{2}$/);
  });

  it('should close picker on Escape key', async () => {
    const user = userEvent.setup();
    render(<TimePickerInput {...defaultProps} />);

    await user.click(screen.getByRole('textbox'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('should apply custom id', () => {
    render(<TimePickerInput {...defaultProps} id="time-field" />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('id', 'time-field');
  });
});
