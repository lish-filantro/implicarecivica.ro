// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useProfileSettings, type ProfileSettingsDeps } from '@m544/ui/settings/useProfileSettings';
import type { Profile, ProfileUpdate } from '@m544/shared/types/profile';

const profile: Profile = {
  id: 'u1',
  first_name: null,
  last_name: null,
  display_name: 'Ion',
  mailcow_email: 'ion@544.ro',
  address: null,
  avatar_url: null,
  notification_email: false,
  notification_deadline_days: 5,
  theme: 'dark',
  approved: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const user = { email: 'ion.popescu@example.com' };

function deps(overrides: Partial<ProfileSettingsDeps> = {}): ProfileSettingsDeps {
  return {
    getProfile: vi.fn(async () => profile),
    updateProfile: vi.fn(async (u: ProfileUpdate) => ({ ...profile, ...u }) as Profile),
    ...overrides,
  };
}

describe('useProfileSettings', () => {
  it('loads the profile into the form', async () => {
    const { result } = renderHook(() => useProfileSettings(user, deps()));
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.form).toEqual({
      displayName: 'Ion',
      notificationEmail: false,
      notificationDays: 5,
      theme: 'dark',
    });
  });

  it('falls back to the email local part when there is no profile yet', async () => {
    const d = deps({ getProfile: vi.fn(async () => null) });
    const { result } = renderHook(() => useProfileSettings(user, d));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.form.displayName).toBe('ion.popescu');
    expect(result.current.form.theme).toBe('system');
  });

  it('does not load without a user', () => {
    const d = deps();
    const { result } = renderHook(() => useProfileSettings(null, d));
    expect(result.current.loading).toBe(true);
    expect(d.getProfile).not.toHaveBeenCalled();
  });

  it('save sends the trimmed form and shows a success message', async () => {
    const d = deps();
    const { result } = renderHook(() => useProfileSettings(user, d));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.setField('displayName', '  Ionel  ');
      result.current.setField('notificationEmail', true);
      result.current.setField('notificationDays', 2);
      result.current.setField('theme', 'light');
    });
    await act(() => result.current.save());

    expect(d.updateProfile).toHaveBeenCalledWith({
      display_name: 'Ionel',
      notification_email: true,
      notification_deadline_days: 2,
      theme: 'light',
    });
    expect(result.current.message).toEqual({ type: 'success', text: 'Setarile au fost salvate.' });
    expect(result.current.saving).toBe(false);
  });

  it('save sends null for an empty display name', async () => {
    const d = deps();
    const { result } = renderHook(() => useProfileSettings(user, d));
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.setField('displayName', '   '));
    await act(() => result.current.save());
    expect(d.updateProfile).toHaveBeenCalledWith(expect.objectContaining({ display_name: null }));
  });

  it('save shows an error message when the update fails', async () => {
    const d = deps({ updateProfile: vi.fn(async () => { throw new Error('boom'); }) });
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { result } = renderHook(() => useProfileSettings(user, d));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(() => result.current.save());
    expect(result.current.message).toEqual({
      type: 'error',
      text: 'Nu am putut salva setarile. Incearca din nou.',
    });
    spy.mockRestore();
  });
});
