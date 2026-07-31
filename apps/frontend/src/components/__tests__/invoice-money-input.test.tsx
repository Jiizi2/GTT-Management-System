import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MoneyInput } from '../../pages/invoice/components/MoneyInput';

function ControlledMoneyInput({ onChange }: { onChange?: (value: number) => void }) {
  const [amount, setAmount] = useState(0);
  return (
    <MoneyInput
      ariaLabel="Amount"
      value={amount}
      onChange={(next) => {
        setAmount(next);
        onChange?.(next);
      }}
    />
  );
}

describe('MoneyInput', () => {
  it('lets the user type past the decimal separator', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    render(<ControlledMoneyInput onChange={handleChange} />);
    const input = screen.getByLabelText('Amount');

    await user.clear(input);
    await user.type(input, '468,75');

    // The half-typed "468," must survive on screen. A fully controlled input
    // reformats it back to "468" and eats the separator, which is what made
    // decimals unreachable before.
    expect(input).toHaveValue('468,75');
    expect(handleChange).toHaveBeenLastCalledWith(468.75);
  });

  it('reports the parsed value on every keystroke so totals stay live', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    render(<ControlledMoneyInput onChange={handleChange} />);
    const input = screen.getByLabelText('Amount');

    await user.clear(input);
    await user.type(input, '505,2');

    expect(handleChange.mock.calls.map((call) => call[0])).toContain(505.2);
  });

  it('restores canonical formatting on blur', async () => {
    const user = userEvent.setup();
    render(<ControlledMoneyInput />);
    const input = screen.getByLabelText('Amount');

    await user.clear(input);
    await user.type(input, '1234567,5');
    await user.tab();

    expect(input).toHaveValue('1.234.567,5');
  });

  it('clamps negative input to zero by default', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    render(<ControlledMoneyInput onChange={handleChange} />);
    const input = screen.getByLabelText('Amount');

    await user.clear(input);
    await user.type(input, '-50');

    expect(handleChange).toHaveBeenLastCalledWith(0);
  });

  it('uses a decimal keypad hint so mobile keyboards expose the separator', () => {
    render(<ControlledMoneyInput />);
    expect(screen.getByLabelText('Amount')).toHaveAttribute('inputmode', 'decimal');
  });
});
