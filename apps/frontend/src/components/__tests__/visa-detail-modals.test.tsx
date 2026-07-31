import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import {
  AgentAssignmentModal,
  VisaStatusModal,
  PaymentStatusModal,
  SyarikahModal,
  VisaTypeModal,
} from '../visa-detail-modals';

// Mock useModalFocusTrap
vi.mock('../use-modal-focus-trap', () => ({
  useModalFocusTrap: () => ({ current: null }),
}));

describe('VisaStatusModal', () => {
  const defaultProps = {
    initialValue: 'Draft' as const,
    todayIso: '2026-07-31',
    onClose: vi.fn(),
    onSave: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders modal with title', () => {
    render(<VisaStatusModal {...defaultProps} />);
    expect(screen.getByText('Edit Visa Status')).toBeInTheDocument();
  });

  it('displays description', () => {
    render(<VisaStatusModal {...defaultProps} />);
    expect(screen.getByText('Update the visa approval status for this group.')).toBeInTheDocument();
  });

  it('renders visa status select', () => {
    render(<VisaStatusModal {...defaultProps} />);
    expect(screen.getByText('Visa Status')).toBeInTheDocument();
  });

  it('displays initial value', () => {
    render(<VisaStatusModal {...defaultProps} initialValue="Pending" />);
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    render(<VisaStatusModal {...defaultProps} />);
    const closeButton = screen.getByLabelText('Close edit visa status popup');
    fireEvent.click(closeButton);
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('renders save and cancel buttons', () => {
    render(<VisaStatusModal {...defaultProps} />);
    expect(screen.getByText('Save Changes')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('hides the issued date field for statuses that have no issued date', () => {
    render(<VisaStatusModal {...defaultProps} initialValue="Pending" />);
    expect(screen.queryByText('Issued Date')).not.toBeInTheDocument();
  });

  it('shows the issued date field once Issued is selected', async () => {
    render(<VisaStatusModal {...defaultProps} />);
    expect(screen.queryByText('Issued Date')).not.toBeInTheDocument();

    fireEvent.click(document.querySelector('[aria-haspopup="listbox"]') as HTMLElement);
    fireEvent.click(await screen.findByRole('option', { name: 'Issued' }));

    await waitFor(() => {
      expect(screen.getByText('Issued Date')).toBeInTheDocument();
    });
  });

  it('prefills the stored issued date so an existing date is not overwritten', () => {
    render(
      <VisaStatusModal {...defaultProps} initialValue="Issued" initialIssuedDateIso="2026-03-14" />,
    );
    expect(document.querySelector('#visa-status-issued-date')).toHaveValue('14/03/2026');
  });

  it("defaults to today when the visa has no issued date yet", () => {
    render(<VisaStatusModal {...defaultProps} initialValue="Issued" />);
    expect(document.querySelector('#visa-status-issued-date')).toHaveValue('31/07/2026');
  });

  it('saves the selected issued date alongside the status', async () => {
    render(
      <VisaStatusModal {...defaultProps} initialValue="Issued" initialIssuedDateIso="2026-03-14" />,
    );
    fireEvent.click(screen.getByText('Save Changes'));

    await waitFor(() => {
      expect(defaultProps.onSave).toHaveBeenCalledWith('Issued', '2026-03-14');
    });
  });

  it('clears the issued date when the status is not Issued', async () => {
    render(
      <VisaStatusModal {...defaultProps} initialValue="Pending" initialIssuedDateIso="2026-03-14" />,
    );
    fireEvent.click(screen.getByText('Save Changes'));

    await waitFor(() => {
      expect(defaultProps.onSave).toHaveBeenCalledWith('Pending', '');
    });
  });
});

describe('PaymentStatusModal', () => {
  const defaultProps = {
    initialValue: 'Unpaid' as const,
    onClose: vi.fn(),
    onSave: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders modal with title', () => {
    render(<PaymentStatusModal {...defaultProps} />);
    expect(screen.getByText('Edit Payment Status')).toBeInTheDocument();
  });

  it('displays description', () => {
    render(<PaymentStatusModal {...defaultProps} />);
    expect(screen.getByText('Update the payment progress for this group.')).toBeInTheDocument();
  });

  it('renders payment status select', () => {
    render(<PaymentStatusModal {...defaultProps} />);
    expect(screen.getByText('Payment Status')).toBeInTheDocument();
  });

  it('displays initial value', () => {
    render(<PaymentStatusModal {...defaultProps} initialValue="Paid" />);
    expect(screen.getByText('Paid')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    render(<PaymentStatusModal {...defaultProps} />);
    const closeButton = screen.getByLabelText('Close edit payment status popup');
    fireEvent.click(closeButton);
    expect(defaultProps.onClose).toHaveBeenCalled();
  });
});

describe('AgentAssignmentModal', () => {
  const agents = [
    { id: 'agent-1', code: 'A01', name: 'Agent One', type: 'PARTNER' as const, status: 'ACTIVE' as const },
    { id: 'agent-2', code: 'A02', name: 'Agent Two', type: 'PARTNER' as const, status: 'ACTIVE' as const },
  ];

  it('renders the current agent in an edit modal', () => {
    render(
      <AgentAssignmentModal
        initialValue="agent-1"
        agents={agents}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    expect(screen.getByText('Edit Agent')).toBeInTheDocument();
    expect(screen.getByText('Agent One')).toBeInTheDocument();
    expect(screen.getByText('Save Changes')).toBeInTheDocument();
  });

  it('uses assignment copy when the group has no agent', () => {
    render(
      <AgentAssignmentModal initialValue="" agents={agents} onClose={vi.fn()} onSave={vi.fn()} />,
    );

    expect(screen.getByRole('heading', { name: 'Assign Agent' })).toBeInTheDocument();
  });
});

describe('SyarikahModal', () => {
  const defaultProps = {
    initialValue: 'Al-Tayyar',
    onClose: vi.fn(),
    onSave: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders modal with title', () => {
    render(<SyarikahModal {...defaultProps} />);
    expect(screen.getByText('Edit Syarikah')).toBeInTheDocument();
  });

  it('displays description', () => {
    render(<SyarikahModal {...defaultProps} />);
    expect(screen.getByText('Update the provider agency used for visa coordination.')).toBeInTheDocument();
  });

  it('renders syarikah input field', () => {
    render(<SyarikahModal {...defaultProps} />);
    expect(screen.getByText('Syarikah / Provider Agency')).toBeInTheDocument();
  });

  it('displays initial value in input', () => {
    render(<SyarikahModal {...defaultProps} />);
    const input = screen.getByPlaceholderText('e.g. Al-Tayyar');
    expect(input).toHaveValue('Al-Tayyar');
  });

  it('calls onClose when close button is clicked', () => {
    render(<SyarikahModal {...defaultProps} />);
    const closeButton = screen.getByLabelText('Close edit syarikah popup');
    fireEvent.click(closeButton);
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('calls onSave with trimmed value when save is clicked', async () => {
    render(<SyarikahModal {...defaultProps} />);
    const saveButton = screen.getByText('Save Changes');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(defaultProps.onSave).toHaveBeenCalledWith('Al-Tayyar');
    });
  });

  it('shows validation error when input is empty', async () => {
    render(<SyarikahModal {...defaultProps} initialValue="" />);
    const input = screen.getByPlaceholderText('e.g. Al-Tayyar');
    fireEvent.change(input, { target: { value: '' } });

    const saveButton = screen.getByText('Save Changes');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText('Syarikah wajib diisi.')).toBeInTheDocument();
    });
  });
});

describe('VisaTypeModal', () => {
  const defaultProps = {
    initialValue: 'Visa Only' as const,
    onClose: vi.fn(),
    onSave: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders modal with title', () => {
    render(<VisaTypeModal {...defaultProps} />);
    expect(screen.getByText('Edit Visa Type')).toBeInTheDocument();
  });

  it('displays description', () => {
    render(<VisaTypeModal {...defaultProps} />);
    expect(screen.getByText('Update the visa service type for this group.')).toBeInTheDocument();
  });

  it('renders visa type select', () => {
    render(<VisaTypeModal {...defaultProps} />);
    expect(screen.getByText('Visa Type')).toBeInTheDocument();
  });

  it('displays initial value', () => {
    render(<VisaTypeModal {...defaultProps} initialValue="Visa+" />);
    expect(screen.getByText('Visa+')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    render(<VisaTypeModal {...defaultProps} />);
    const closeButton = screen.getByLabelText('Close edit visa type popup');
    fireEvent.click(closeButton);
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('calls onSave with selected value when save is clicked', async () => {
    render(<VisaTypeModal {...defaultProps} />);
    const saveButton = screen.getByText('Save Changes');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(defaultProps.onSave).toHaveBeenCalledWith('Visa Only');
    });
  });
});
