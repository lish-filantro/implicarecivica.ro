// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { createElement as h } from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import EmailDetail, { EmailEmptyState } from '@m544/ui/emails/EmailDetail';
import { makeEmail } from './_fixtures';

afterEach(cleanup);

describe('EmailDetail', () => {
  it('renders a received email with category badge, registration number and attachment button', () => {
    const email = makeEmail({
      subject: 'Raspuns la cererea 12',
      category: 'raspunse',
      registration_number: '4521',
      body: '<p>Text raspuns</p><script>alert(1)</script>',
      attachments: [{ name: 'raspuns.pdf', type: 'application/pdf', size: 2048 }],
    });
    const { container } = render(h(EmailDetail, { email }));

    expect(screen.getByRole('heading', { name: 'Raspuns la cererea 12' })).toBeTruthy();
    expect(screen.getByText('Răspuns final')).toBeTruthy();
    expect(screen.getByText('Nr. 4521')).toBeTruthy();
    expect(screen.getByText('Text raspuns')).toBeTruthy();
    expect(container.querySelector('script')).toBeNull();
    expect(screen.getByText('Atașamente (1)')).toBeTruthy();
    expect(screen.getByRole('button', { name: /raspuns\.pdf/ })).toBeTruthy();
    expect(screen.getByText('2 KB')).toBeTruthy();
    // completed emails show no processing badge
    expect(screen.queryByText('Neprocesar')).toBeNull();
  });

  it('labels the new categories and shows the processing badge', () => {
    render(h(EmailDetail, { email: makeEmail({ category: 'redirectionat', processing_status: 'failed' }) }));
    expect(screen.getByText('Redirecționat')).toBeTruthy();
    expect(screen.getByText('Procesare eșuată')).toBeTruthy();
    cleanup();
    render(h(EmailDetail, { email: makeEmail({ category: 'irelevant', processing_status: 'processing' }) }));
    expect(screen.getByText('Irelevant')).toBeTruthy();
    expect(screen.getByText('Se procesează...')).toBeTruthy();
  });

  it('hides badges for sent emails and shows the empty-body placeholder', () => {
    render(h(EmailDetail, { email: makeEmail({ type: 'sent', category: 'trimise', body: null }) }));
    expect(screen.queryByText('Trimis')).toBeNull();
    expect(screen.getByText('Fără conținut')).toBeTruthy();
  });

  it('EmailEmptyState renders the prompt', () => {
    render(h(EmailEmptyState));
    expect(screen.getByText('Selectează un email')).toBeTruthy();
  });
});
