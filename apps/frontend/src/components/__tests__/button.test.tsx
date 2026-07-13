import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from '../button';

describe('Button', () => {
  it('renders children correctly', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument();
  });

  it('applies primary variant by default', () => {
    render(<Button>Primary</Button>);
    const button = screen.getByRole('button');
    expect(button.className).toContain('serene-btn-primary');
  });

  it('applies secondary variant', () => {
    render(<Button variant="secondary">Secondary</Button>);
    const button = screen.getByRole('button');
    expect(button.className).toContain('serene-btn-secondary');
  });

  it('applies tertiary variant', () => {
    render(<Button variant="tertiary">Tertiary</Button>);
    const button = screen.getByRole('button');
    expect(button.className).toContain('serene-btn-tertiary');
  });

  it('applies danger variant', () => {
    render(<Button variant="danger">Danger</Button>);
    const button = screen.getByRole('button');
    expect(button.className).toContain('serene-btn-danger');
  });

  it('applies medium size by default', () => {
    render(<Button>Medium</Button>);
    const button = screen.getByRole('button');
    expect(button.className).toContain('h-11');
    expect(button.className).toContain('px-4');
    expect(button.className).toContain('text-sm');
  });

  it('applies small size', () => {
    render(<Button size="sm">Small</Button>);
    const button = screen.getByRole('button');
    expect(button.className).toContain('h-8');
    expect(button.className).toContain('px-3');
    expect(button.className).toContain('text-xs');
  });

  it('applies large size', () => {
    render(<Button size="lg">Large</Button>);
    const button = screen.getByRole('button');
    expect(button.className).toContain('h-12');
    expect(button.className).toContain('px-6');
    expect(button.className).toContain('text-base');
  });

  it('handles click events', async () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click me</Button>);

    const button = screen.getByRole('button');
    await userEvent.click(button);

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('disables button when disabled prop is true', () => {
    render(<Button disabled>Disabled</Button>);
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button.className).toContain('disabled:cursor-not-allowed');
  });

  it('does not trigger click when disabled', async () => {
    const handleClick = vi.fn();
    render(<Button disabled onClick={handleClick}>Disabled</Button>);

    const button = screen.getByRole('button');
    await userEvent.click(button);

    expect(handleClick).not.toHaveBeenCalled();
  });

  it('sets button type to button by default', () => {
    render(<Button>Button</Button>);
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('type', 'button');
  });

  it('allows setting button type to submit', () => {
    render(<Button type="submit">Submit</Button>);
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('type', 'submit');
  });

  it('applies custom className', () => {
    render(<Button className="custom-class">Custom</Button>);
    const button = screen.getByRole('button');
    expect(button.className).toContain('custom-class');
  });

  it('passes through additional props', () => {
    render(<Button data-testid="test-button">Test</Button>);
    const button = screen.getByTestId('test-button');
    expect(button).toBeInTheDocument();
  });
});
