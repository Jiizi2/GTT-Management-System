import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeToggleButton } from '../theme-toggle-button';

const mockToggleTheme = vi.fn();
let mockTheme: 'light' | 'dark' = 'light';

vi.mock('../../theme/theme-provider', () => ({
  useThemeMode: () => ({
    theme: mockTheme,
    toggleTheme: mockToggleTheme,
  }),
}));

describe('ThemeToggleButton', () => {
  beforeEach(() => {
    mockToggleTheme.mockClear();
    mockTheme = 'light';
  });

  it('renders button with dark mode icon when theme is light', () => {
    render(<ThemeToggleButton />);
    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('aria-label', 'Switch to dark mode');
    expect(button).toHaveAttribute('title', 'Switch to dark mode');
  });

  it('renders button with light mode icon when theme is dark', () => {
    mockTheme = 'dark';
    render(<ThemeToggleButton />);
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-label', 'Switch to light mode');
    expect(button).toHaveAttribute('title', 'Switch to light mode');
  });

  it('calls toggleTheme when clicked', () => {
    render(<ThemeToggleButton />);
    const button = screen.getByRole('button');
    fireEvent.click(button);
    expect(mockToggleTheme).toHaveBeenCalledTimes(1);
  });

  it('applies page variant class by default', () => {
    render(<ThemeToggleButton />);
    const button = screen.getByRole('button');
    expect(button.className).toContain('serene-theme-toggle-shell');
  });

  it('applies floating variant class when variant is floating', () => {
    render(<ThemeToggleButton variant="floating" />);
    const button = screen.getByRole('button');
    expect(button.className).toContain('serene-theme-toggle-floating');
  });

  it('applies custom className', () => {
    render(<ThemeToggleButton className="custom-theme-toggle" />);
    const button = screen.getByRole('button');
    expect(button.className).toContain('custom-theme-toggle');
  });

  it('renders dark_mode icon when theme is light', () => {
    render(<ThemeToggleButton />);
    const icon = screen.getByText('dark_mode');
    expect(icon).toBeInTheDocument();
    expect(icon).toHaveAttribute('aria-hidden', 'true');
  });

  it('renders light_mode icon when theme is dark', () => {
    mockTheme = 'dark';
    render(<ThemeToggleButton />);
    const icon = screen.getByText('light_mode');
    expect(icon).toBeInTheDocument();
    expect(icon).toHaveAttribute('aria-hidden', 'true');
  });
});
