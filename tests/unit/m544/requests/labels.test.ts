/**
 * requests/utils/labels — Romanian status labels and colour tokens.
 */
import { describe, it, expect } from 'vitest';
import { getStatusLabel, getStatusColor } from '@m544/requests/utils/labels';
import type { RequestStatus } from '@m544/shared/types/request';

describe('getStatusLabel', () => {
  it('maps every status to its Romanian label', () => {
    expect(getStatusLabel('pending')).toBe('Așteaptă nr. înreg.');
    expect(getStatusLabel('received')).toBe('Înregistrată');
    expect(getStatusLabel('extension')).toBe('Prelungită');
    expect(getStatusLabel('answered')).toBe('Răspuns primit');
    expect(getStatusLabel('delayed')).toBe('Întârziată');
  });

  it('falls back to the raw value for an unknown status', () => {
    expect(getStatusLabel('weird' as RequestStatus)).toBe('weird');
  });
});

describe('getStatusColor', () => {
  it('maps every status to a colour token', () => {
    expect(getStatusColor('pending')).toBe('blue');
    expect(getStatusColor('received')).toBe('emerald');
    expect(getStatusColor('extension')).toBe('purple');
    expect(getStatusColor('answered')).toBe('green');
    expect(getStatusColor('delayed')).toBe('red');
  });

  it('falls back to gray for an unknown status', () => {
    expect(getStatusColor('weird' as RequestStatus)).toBe('gray');
  });
});
