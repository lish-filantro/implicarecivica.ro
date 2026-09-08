// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import EmailDetailHeader from '@m544/ui/emails/EmailDetailHeader';
import { makeEmail } from './_fixtures';

afterEach(cleanup);

describe('EmailDetailHeader', () => {
  it('shows subject, from/to, badges and registration number for a received email', () => {
    render(
      <EmailDetailHeader
        email={makeEmail({ subject: 'Confirmare', category: 'inregistrate', registration_number: '12', processing_status: 'failed' })}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Confirmare' })).toBeTruthy();
    expect(screen.getByText('registratura@primarie.ro')).toBeTruthy();
    expect(screen.getByText('ion@544.ro')).toBeTruthy();
    expect(screen.getByText('Confirmare înregistrare')).toBeTruthy();
    expect(screen.getByText('Procesare eșuată')).toBeTruthy();
    expect(screen.getByText('Nr. 12')).toBeTruthy();
  });

  it('hides the badges for sent emails', () => {
    render(<EmailDetailHeader email={makeEmail({ type: 'sent', category: 'trimise' })} />);
    expect(screen.queryByText('Trimis')).toBeNull();
    expect(screen.queryByText(/^Nr\./)).toBeNull();
  });
});
