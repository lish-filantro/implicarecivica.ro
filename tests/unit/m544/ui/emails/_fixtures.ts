import type { Email } from '@m544/shared/types/email';

export function makeEmail(overrides: Partial<Email> = {}): Email {
  return {
    id: 'e1',
    user_id: 'u1',
    message_id: 'm1',
    type: 'received',
    from_email: 'registratura@primarie.ro',
    to_email: 'ion@544.ro',
    subject: 'Raspuns cerere',
    body: '<p>Buna ziua</p>',
    ocr_processed: false,
    processing_status: 'completed',
    retry_count: 0,
    is_read: true,
    created_at: '2026-09-01T10:00:00Z',
    updated_at: '2026-09-01T10:00:00Z',
    ...overrides,
  };
}
