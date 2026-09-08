/**
 * inbound/webhook/addresses — RFC 5322 address helpers used by the webhooks.
 */
import { describe, it, expect } from 'vitest';
import { extractEmail, extractName, cleanReplySubject, stripAngleBrackets } from '@m544/inbound/webhook/addresses';

describe('extractEmail', () => {
  it('extracts the address from "Name <addr>" and lowercases it', () => {
    expect(extractEmail('Ion Popescu <Ion.Popescu@Primaria.ro>')).toBe('ion.popescu@primaria.ro');
  });
  it('returns a bare address trimmed and lowercased', () => {
    expect(extractEmail('  Registratura@PS3.ro ')).toBe('registratura@ps3.ro');
  });
  it('handles quoted display names', () => {
    expect(extractEmail('"Primăria Sector 3" <registratura@ps3.ro>')).toBe('registratura@ps3.ro');
  });
  it('takes the first address when several are present', () => {
    expect(extractEmail('A <first@x.ro>, B <second@x.ro>')).toBe('first@x.ro');
  });
});

describe('extractName', () => {
  it('returns the display name without quotes', () => {
    expect(extractName('"Ion Popescu" <ion@x.ro>')).toBe('Ion Popescu');
    expect(extractName('Ion Popescu <ion@x.ro>')).toBe('Ion Popescu');
  });
  it('returns null for a bare address or empty name', () => {
    expect(extractName('ion@x.ro')).toBeNull();
    expect(extractName('<ion@x.ro>')).toBeNull();
    expect(extractName('"" <ion@x.ro>')).toBeNull();
  });
});

describe('stripAngleBrackets', () => {
  it('removes < > and whitespace from a Message-ID', () => {
    expect(stripAngleBrackets(' <abc@def.ro> ')).toBe('abc@def.ro');
    expect(stripAngleBrackets('abc@def.ro')).toBe('abc@def.ro');
    expect(stripAngleBrackets('')).toBe('');
  });
});

describe('cleanReplySubject', () => {
  it('strips Re/Fwd/FW/RE prefixes (repeatedly) and trims', () => {
    expect(cleanReplySubject('Re: Fwd: Subiect')).toBe('Subiect');
    expect(cleanReplySubject('RE:Subiect')).toBe('Subiect');
    expect(cleanReplySubject('  Subiect  ')).toBe('Subiect');
  });
  it('returns empty string for null/undefined', () => {
    expect(cleanReplySubject(undefined)).toBe('');
    expect(cleanReplySubject(null)).toBe('');
  });
});
