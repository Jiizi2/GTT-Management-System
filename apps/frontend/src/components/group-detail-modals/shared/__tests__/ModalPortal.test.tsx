import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { ModalPortal } from '../ModalPortal';

describe('ModalPortal', () => {
  it('renders children when document exists', () => {
    const { getByText } = render(
      <ModalPortal>
        <div>Test Content</div>
      </ModalPortal>
    );

    expect(getByText('Test Content')).toBeInTheDocument();
  });

  it('renders to document.body', () => {
    const { baseElement } = render(
      <ModalPortal>
        <div data-testid="portal-content">Content</div>
      </ModalPortal>
    );

    const portalContent = baseElement.querySelector('[data-testid="portal-content"]');
    expect(portalContent).toBeInTheDocument();
    expect(portalContent?.closest('body')).toBeTruthy();
  });

  it('handles null children', () => {
    const { container } = render(
      <ModalPortal>
        {null}
      </ModalPortal>
    );

    expect(container).toBeTruthy();
  });

  it('handles multiple children', () => {
    const { getByText } = render(
      <ModalPortal>
        <div>Child 1</div>
        <div>Child 2</div>
        <div>Child 3</div>
      </ModalPortal>
    );

    expect(getByText('Child 1')).toBeInTheDocument();
    expect(getByText('Child 2')).toBeInTheDocument();
    expect(getByText('Child 3')).toBeInTheDocument();
  });
});
