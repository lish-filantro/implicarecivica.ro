/**
 * Emailul trimis la aprobarea contului. Până la raportul de testare din 2026-09-22, aprobarea
 * era tăcută: utilizatorul rămânea pe /pending-approval fără să afle că poate intra.
 */
import { describe, it, expect } from 'vitest';
import { buildApprovalEmail } from '@m544/admin/approval-email';

describe('buildApprovalEmail', () => {
  const ctx = { displayName: 'Irina', appUrl: 'https://implicarecivica.ro' };

  it('are un subiect care spune ce s-a întâmplat', () => {
    expect(buildApprovalEmail(ctx).subject).toBe('Contul tău Implicare Civică a fost aprobat');
  });

  it('se adresează pe nume şi conţine linkul de intrare', () => {
    const email = buildApprovalEmail(ctx);
    expect(email.text).toContain('Irina');
    expect(email.text).toContain('https://implicarecivica.ro/login');
    expect(email.html).toContain('https://implicarecivica.ro/login');
  });

  it('funcţionează fără nume', () => {
    const email = buildApprovalEmail({ ...ctx, displayName: '' });
    expect(email.text).toContain('Salut,');
    expect(email.text).not.toContain('Salut ,');
  });

  it('escapează numele în HTML', () => {
    const email = buildApprovalEmail({ ...ctx, displayName: '<script>x</script>' });
    expect(email.html).not.toContain('<script>');
  });

  it('nu dublează separatorul când appUrl se termină în slash', () => {
    const email = buildApprovalEmail({ ...ctx, appUrl: 'https://implicarecivica.ro/' });
    expect(email.text).toContain('https://implicarecivica.ro/login');
    expect(email.text).not.toContain('//login');
  });
});
