// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createElement } from 'react';
import { renderHook, act, render, screen, cleanup, fireEvent } from '@testing-library/react';
import { useStepFormProfile } from '@m544/ui/requests/wizard/useStepFormProfile';
import { StepFormData } from '@m544/ui/requests/wizard/StepFormData';
import { useRequestWizard } from '@m544/ui/requests/wizard/useRequestWizard';
import type { WizardFormData } from '@m544/ui/requests/wizard/types';

const PROFILE = { display_name: 'Ion Popescu', mailcow_email: 'ion@cereri544.ro', address: 'Str. Lungă 1' };

const FILLED: WizardFormData = {
  solicitantName: 'Ion',
  solicitantEmail: 'ion@mail.ro',
  solicitantAddress: '  Str. Lungă 1  ',
  saveAddress: true,
  institutionName: 'Prim',
  institutionEmail: 'a@b.ro',
  sessionName: 'S',
};

function fakeWizard(overrides: Partial<{ formData: WizardFormData; canProceedToStep2: boolean }> = {}) {
  return {
    formData: FILLED,
    canProceedToStep2: true,
    initFormFromProfile: vi.fn(),
    setStep: vi.fn(),
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('useStepFormProfile', () => {
  it('loads the profile once and pre-fills the wizard', async () => {
    const wizard = fakeWizard();
    const getProfile = vi.fn(async () => PROFILE);
    const { result } = renderHook(() => useStepFormProfile(wizard, { getProfile }));
    expect(result.current.profileLoaded).toBe(false);
    await act(async () => {});
    expect(result.current.profileLoaded).toBe(true);
    expect(getProfile).toHaveBeenCalledTimes(1);
    expect(wizard.initFormFromProfile).toHaveBeenCalledWith(PROFILE);
  });

  it('marks loaded without touching the form when there is no profile', async () => {
    const wizard = fakeWizard();
    const { result } = renderHook(() => useStepFormProfile(wizard, { getProfile: async () => null }));
    await act(async () => {});
    expect(result.current.profileLoaded).toBe(true);
    expect(wizard.initFormFromProfile).not.toHaveBeenCalled();
  });

  it('logs and still unblocks the form when loading fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const wizard = fakeWizard();
    const { result } = renderHook(() =>
      useStepFormProfile(wizard, { getProfile: async () => { throw new Error('db'); } }),
    );
    await act(async () => {});
    expect(result.current.profileLoaded).toBe(true);
    expect(console.error).toHaveBeenCalledWith('Failed to load profile:', expect.any(Error));
  });

  it('handleContinue saves the trimmed address when the checkbox is on, then goes to step 2', async () => {
    const wizard = fakeWizard();
    const updateProfile = vi.fn(async () => ({}));
    const { result } = renderHook(() => useStepFormProfile(wizard, { getProfile: async () => null, updateProfile }));
    await act(async () => result.current.handleContinue());
    expect(updateProfile).toHaveBeenCalledWith({ address: 'Str. Lungă 1' });
    expect(wizard.setStep).toHaveBeenCalledWith(2);
  });

  it('handleContinue skips saving when the checkbox is off or the address is blank', async () => {
    const updateProfile = vi.fn(async () => ({}));
    const off = fakeWizard({ formData: { ...FILLED, saveAddress: false } });
    const a = renderHook(() => useStepFormProfile(off, { getProfile: async () => null, updateProfile }));
    await act(async () => a.result.current.handleContinue());
    expect(updateProfile).not.toHaveBeenCalled();
    expect(off.setStep).toHaveBeenCalledWith(2);

    const blank = fakeWizard({ formData: { ...FILLED, solicitantAddress: '   ' } });
    const b = renderHook(() => useStepFormProfile(blank, { getProfile: async () => null, updateProfile }));
    await act(async () => b.result.current.handleContinue());
    expect(updateProfile).not.toHaveBeenCalled();
  });

  it('handleContinue still advances if saving the address fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const wizard = fakeWizard();
    const { result } = renderHook(() =>
      useStepFormProfile(wizard, { getProfile: async () => null, updateProfile: async () => { throw new Error('rls'); } }),
    );
    await act(async () => result.current.handleContinue());
    expect(console.error).toHaveBeenCalledWith('Failed to save address:', expect.any(Error));
    expect(wizard.setStep).toHaveBeenCalledWith(2);
  });

  it('handleContinue does nothing when the form is invalid', async () => {
    const wizard = fakeWizard({ canProceedToStep2: false });
    const updateProfile = vi.fn(async () => ({}));
    const { result } = renderHook(() => useStepFormProfile(wizard, { getProfile: async () => null, updateProfile }));
    await act(async () => result.current.handleContinue());
    expect(updateProfile).not.toHaveBeenCalled();
    expect(wizard.setStep).not.toHaveBeenCalled();
  });
});

describe('StepFormData (render)', () => {
  it('shows a skeleton until the profile loads, then the form pre-filled from the profile', async () => {
    const hook = renderHook(() => useRequestWizard());
    let resolve!: (p: typeof PROFILE) => void;
    const getProfile = () => new Promise<typeof PROFILE>((r) => { resolve = r; });

    const view = render(createElement(StepFormData, { wizard: hook.result.current, profileDeps: { getProfile } }));
    expect(screen.queryByText('Date cerere')).toBeNull();

    await act(async () => resolve(PROFILE));
    view.rerender(createElement(StepFormData, { wizard: hook.result.current, profileDeps: { getProfile } }));
    expect(screen.getByText('Date cerere')).toBeTruthy();
    expect((screen.getByPlaceholderText('Ion Popescu') as HTMLInputElement).value).toBe('Ion Popescu');
    expect(hook.result.current.formData.solicitantEmail).toBe('ion@cereri544.ro');
    expect((screen.getByRole('button', { name: /Continuă/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('flags a malformed institution email with the red border class', async () => {
    const hook = renderHook(() => useRequestWizard());
    const deps = { getProfile: async () => null };
    const view = render(createElement(StepFormData, { wizard: hook.result.current, profileDeps: deps }));
    await act(async () => {});
    view.rerender(createElement(StepFormData, { wizard: hook.result.current, profileDeps: deps }));

    const email = screen.getByPlaceholderText('registratura@institutie.ro');
    act(() => { fireEvent.change(email, { target: { value: 'nu-e-email' } }); });
    view.rerender(createElement(StepFormData, { wizard: hook.result.current, profileDeps: deps }));
    expect(screen.getByPlaceholderText('registratura@institutie.ro').className).toContain('border-protest-red-500');
  });
});
