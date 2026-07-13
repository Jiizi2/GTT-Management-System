import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ModalFooter } from '../ModalFooter';

describe('ModalFooter', () => {
  it('renders children', () => {
    render(
      <ModalFooter>
        <button>Save</button>
        <button>Cancel</button>
      </ModalFooter>
    );
    expect(screen.getByText('Save')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('renders with correct styling', () => {
    const { container } = render(
      <ModalFooter>
        <button>Button</button>
      </ModalFooter>
    );
    const footer = container.firstChild;
    expect(footer).toHaveClass('serene-dialog-footer-bar');
  });

  it('handles multiple children', () => {
    render(
      <ModalFooter>
        <button>Button 1</button>
        <button>Button 2</button>
        <button>Button 3</button>
      </ModalFooter>
    );
    expect(screen.getByText('Button 1')).toBeInTheDocument();
    expect(screen.getByText('Button 2')).toBeInTheDocument();
    expect(screen.getByText('Button 3')).toBeInTheDocument();
  });

  it('handles empty children', () => {
    const { container } = render(<ModalFooter>{null}</ModalFooter>);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('handles mixed content types', () => {
    render(
      <ModalFooter>
        <span>Text</span>
        <button>Button</button>
        <div>Div</div>
      </ModalFooter>
    );
    expect(screen.getByText('Text')).toBeInTheDocument();
    expect(screen.getByText('Button')).toBeInTheDocument();
    expect(screen.getByText('Div')).toBeInTheDocument();
  });

  it('maintains button functionality', () => {
    const handleClick = vi.fn();
    render(
      <ModalFooter>
        <button onClick={handleClick}>Click Me</button>
      </ModalFooter>
    );
    fireEvent.click(screen.getByText('Click Me'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
