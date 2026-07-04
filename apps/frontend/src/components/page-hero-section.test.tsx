import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PageHeroSection } from './page-hero-section';

describe('PageHeroSection', () => {
  it('renders eyebrow text', () => {
    render(
      <PageHeroSection
        eyebrow="Dashboard"
        title="Welcome"
        description="This is the main dashboard"
      />
    );
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('renders title text', () => {
    render(
      <PageHeroSection
        eyebrow="Dashboard"
        title="Welcome Back"
        description="This is the main dashboard"
      />
    );
    expect(screen.getByText('Welcome Back')).toBeInTheDocument();
  });

  it('renders description text', () => {
    render(
      <PageHeroSection
        eyebrow="Dashboard"
        title="Welcome"
        description="Manage your groups and itineraries here"
      />
    );
    expect(screen.getByText('Manage your groups and itineraries here')).toBeInTheDocument();
  });

  it('renders description as ReactNode', () => {
    render(
      <PageHeroSection
        eyebrow="Dashboard"
        title="Welcome"
        description={<span data-testid="custom-desc">Custom description</span>}
      />
    );
    expect(screen.getByTestId('custom-desc')).toBeInTheDocument();
  });

  it('renders actions when provided', () => {
    render(
      <PageHeroSection
        eyebrow="Dashboard"
        title="Welcome"
        description="Description"
        actions={<button>Add New</button>}
      />
    );
    expect(screen.getByRole('button', { name: 'Add New' })).toBeInTheDocument();
  });

  it('does not render actions when not provided', () => {
    render(
      <PageHeroSection
        eyebrow="Dashboard"
        title="Welcome"
        description="Description"
      />
    );
    // Actions container should not be in the document
    const actions = screen.queryByRole('button');
    expect(actions).not.toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <PageHeroSection
        eyebrow="Dashboard"
        title="Welcome"
        description="Description"
        className="custom-hero"
      />
    );
    const section = container.firstChild;
    expect(section).toHaveClass('custom-hero');
  });

  it('applies serene-section class by default', () => {
    const { container } = render(
      <PageHeroSection
        eyebrow="Dashboard"
        title="Welcome"
        description="Description"
      />
    );
    const section = container.firstChild;
    expect(section).toHaveClass('serene-section');
  });

  it('renders with all props', () => {
    render(
      <PageHeroSection
        eyebrow="Settings"
        title="User Preferences"
        description="Configure your account settings"
        actions={<button>Save Changes</button>}
        className="settings-hero"
      />
    );
    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.getByText('User Preferences')).toBeInTheDocument();
    expect(screen.getByText('Configure your account settings')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeInTheDocument();
  });
});
