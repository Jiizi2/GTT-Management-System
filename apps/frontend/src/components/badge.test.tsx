import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge } from './badge';

describe('Badge', () => {
  it('renders children correctly', () => {
    render(<Badge>Active</Badge>);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('applies neutral status by default', () => {
    render(<Badge>Neutral</Badge>);
    const badge = screen.getByText('Neutral');
    expect(badge.className).toContain('bg-slate-100/90');
    expect(badge.className).toContain('text-slate-800');
  });

  it('applies success status', () => {
    render(<Badge status="success">Success</Badge>);
    const badge = screen.getByText('Success');
    expect(badge.className).toContain('serene-chip-complete');
  });

  it('applies warning status', () => {
    render(<Badge status="warning">Warning</Badge>);
    const badge = screen.getByText('Warning');
    expect(badge.className).toContain('serene-chip-warning');
  });

  it('applies error status', () => {
    render(<Badge status="error">Error</Badge>);
    const badge = screen.getByText('Error');
    expect(badge.className).toContain('serene-chip-alert');
  });

  it('applies info status', () => {
    render(<Badge status="info">Info</Badge>);
    const badge = screen.getByText('Info');
    expect(badge.className).toContain('bg-sky-100/90');
    expect(badge.className).toContain('text-sky-800');
  });

  it('applies custom className', () => {
    render(<Badge className="custom-badge">Custom</Badge>);
    const badge = screen.getByText('Custom');
    expect(badge.className).toContain('custom-badge');
  });

  it('passes through additional props', () => {
    render(<Badge data-testid="test-badge">Test</Badge>);
    const badge = screen.getByTestId('test-badge');
    expect(badge).toBeInTheDocument();
  });

  it('renders with complex children', () => {
    render(
      <Badge>
        <span>Complex</span> <strong>Content</strong>
      </Badge>
    );
    expect(screen.getByText('Complex')).toBeInTheDocument();
    expect(screen.getByText('Content')).toBeInTheDocument();
  });
});
