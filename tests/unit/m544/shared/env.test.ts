/**
 * shared/env — fail-fast access to environment variables.
 *
 * Contract:
 *  - requireEnv(name): value, or throws EnvError naming the variable
 *  - requireSecret(name): like requireEnv but also rejects placeholder-like values
 *  - optionalEnv(name): value or undefined (empty string counts as undefined)
 *  - isPlaceholder(value): detects "placeholder", "whsec_placeholder", "re_placeholder", "xxx", "..."
 *  - Nothing is cached at import time: tests can mutate process.env freely.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { requireEnv, requireSecret, optionalEnv, isPlaceholder, EnvError } from '@m544/shared/env';

const KEY = 'M544_TEST_VAR';

beforeEach(() => {
  delete process.env[KEY];
});
afterEach(() => {
  delete process.env[KEY];
});

describe('requireEnv', () => {
  it('returns the value when set', () => {
    process.env[KEY] = 'hello';
    expect(requireEnv(KEY)).toBe('hello');
  });

  it('throws EnvError naming the variable when missing', () => {
    expect(() => requireEnv(KEY)).toThrow(EnvError);
    expect(() => requireEnv(KEY)).toThrow(/M544_TEST_VAR/);
  });

  it('treats empty string as missing', () => {
    process.env[KEY] = '';
    expect(() => requireEnv(KEY)).toThrow(EnvError);
  });

  it('reads the live value on every call (no import-time cache)', () => {
    process.env[KEY] = 'first';
    expect(requireEnv(KEY)).toBe('first');
    process.env[KEY] = 'second';
    expect(requireEnv(KEY)).toBe('second');
  });
});

describe('isPlaceholder', () => {
  it.each(['placeholder', 'PLACEHOLDER', 'whsec_placeholder', 're_placeholder', 'placeholder-openai-key', 'xxx', '...', 'your-anon-key', 'sk-ant-...', 'changeme'])(
    'flags %s',
    (v) => expect(isPlaceholder(v)).toBe(true),
  );

  it.each(['re_9XkAbcDefGhij1234567890', 'whsec_A1b2C3d4E5', 'a-real-secret-value'])(
    'accepts %s',
    (v) => expect(isPlaceholder(v)).toBe(false),
  );
});

describe('requireSecret', () => {
  it('returns real secrets', () => {
    process.env[KEY] = 'whsec_A1b2C3d4E5';
    expect(requireSecret(KEY)).toBe('whsec_A1b2C3d4E5');
  });

  it('rejects placeholder values with a message that says so', () => {
    process.env[KEY] = 'placeholder';
    expect(() => requireSecret(KEY)).toThrow(EnvError);
    expect(() => requireSecret(KEY)).toThrow(/placeholder/i);
  });

  it('rejects missing values', () => {
    expect(() => requireSecret(KEY)).toThrow(EnvError);
  });
});

describe('optionalEnv', () => {
  it('returns undefined when missing or empty', () => {
    expect(optionalEnv(KEY)).toBeUndefined();
    process.env[KEY] = '';
    expect(optionalEnv(KEY)).toBeUndefined();
  });

  it('returns the value when set', () => {
    process.env[KEY] = 'x';
    expect(optionalEnv(KEY)).toBe('x');
  });

  it('returns the fallback when provided and value missing', () => {
    expect(optionalEnv(KEY, 'fallback')).toBe('fallback');
  });
});

describe('EnvError', () => {
  it('is an Error with name EnvError and the variable name', () => {
    const err = new EnvError(KEY, 'is required');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('EnvError');
    expect(err.variable).toBe(KEY);
    expect(err.message).toContain(KEY);
  });
});
