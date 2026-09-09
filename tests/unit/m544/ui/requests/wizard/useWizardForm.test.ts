// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWizardForm, canProceedFromForm, initialFormData } from '@m544/ui/requests/wizard/useWizardForm';
import { isValidInstitutionEmail } from '@m544/ui/requests/wizard/types';
import type { WizardFormData } from '@m544/ui/requests/wizard/types';

const VALID: WizardFormData = {
  solicitantName: 'Ion Popescu',
  solicitantEmail: 'ion@mail.ro',
  solicitantAddress: 'Str. Victoriei 10',
  saveAddress: false,
  institutionName: 'Primăria Pitești',
  institutionEmail: 'registratura@primaria.ro',
  sessionName: 'Transparență',
};

describe('isValidInstitutionEmail', () => {
  it.each(['a@b.ro', 'x.y@sub.domain.org'])('accepts %s', (e) => expect(isValidInstitutionEmail(e)).toBe(true));
  it.each(['', 'abc', 'a@b', 'a b@c.ro', '@c.ro'])('rejects "%s"', (e) => expect(isValidInstitutionEmail(e)).toBe(false));
});

describe('canProceedFromForm — validation matrix', () => {
  it('passes with every field filled and a valid email', () => {
    expect(canProceedFromForm(VALID)).toBe(true);
  });

  const textFields: (keyof WizardFormData)[] = [
    'solicitantName',
    'solicitantEmail',
    'solicitantAddress',
    'institutionName',
    'institutionEmail',
    'sessionName',
  ];
  it.each(textFields)('fails when %s is empty', (field) => {
    expect(canProceedFromForm({ ...VALID, [field]: '' })).toBe(false);
  });
  it.each(textFields)('fails when %s is whitespace only', (field) => {
    expect(canProceedFromForm({ ...VALID, [field]: '   ' })).toBe(false);
  });

  it('fails when the institution email is malformed', () => {
    expect(canProceedFromForm({ ...VALID, institutionEmail: 'registratura' })).toBe(false);
  });

  it('ignores the saveAddress checkbox', () => {
    expect(canProceedFromForm({ ...VALID, saveAddress: true })).toBe(true);
  });
});

describe('initialFormData', () => {
  it('starts empty without chat data', () => {
    expect(initialFormData(null)).toEqual({
      solicitantName: '',
      solicitantEmail: '',
      solicitantAddress: '',
      saveAddress: false,
      institutionName: '',
      institutionEmail: '',
      sessionName: '',
    });
  });

  it('pre-fills the institution from chat data, treating null as empty', () => {
    const data = initialFormData({ institutionName: 'Primăria X', institutionEmail: null });
    expect(data.institutionName).toBe('Primăria X');
    expect(data.institutionEmail).toBe('');
    expect(data.sessionName).toBe('');
  });

  it('pre-fills the session name proposed by the hand-off', () => {
    expect(initialFormData({ sessionName: 'Groapă, Primăria X' }).sessionName).toBe('Groapă, Primăria X');
  });
});

describe('useWizardForm', () => {
  it('updates one field at a time and recomputes canProceedToStep2', () => {
    const { result } = renderHook(() => useWizardForm());
    expect(result.current.canProceedToStep2).toBe(false);

    act(() => {
      for (const [k, v] of Object.entries(VALID)) {
        result.current.updateFormField(k as keyof WizardFormData, v as never);
      }
    });
    expect(result.current.formData).toEqual(VALID);
    expect(result.current.canProceedToStep2).toBe(true);

    act(() => result.current.updateFormField('institutionEmail', 'broken'));
    expect(result.current.canProceedToStep2).toBe(false);
  });

  it('initFormFromProfile keeps a typed name/address but always takes the profile email', () => {
    const { result } = renderHook(() => useWizardForm());
    act(() => {
      result.current.updateFormField('solicitantName', 'Typed Name');
      result.current.updateFormField('solicitantEmail', 'typed@mail.ro');
    });
    act(() =>
      result.current.initFormFromProfile({ display_name: 'Profile Name', mailcow_email: 'p@m.ro', address: 'Adresa' }),
    );
    expect(result.current.formData.solicitantName).toBe('Typed Name');
    expect(result.current.formData.solicitantEmail).toBe('p@m.ro');
    expect(result.current.formData.solicitantAddress).toBe('Adresa');
  });

  it('initFormFromProfile fills empty fields and tolerates nulls', () => {
    const { result } = renderHook(() => useWizardForm());
    act(() => result.current.initFormFromProfile({ display_name: 'Profile Name', mailcow_email: null, address: null }));
    expect(result.current.formData.solicitantName).toBe('Profile Name');
    expect(result.current.formData.solicitantEmail).toBe('');
    expect(result.current.formData.solicitantAddress).toBe('');
  });

  it('seeds the institution from chat data', () => {
    const { result } = renderHook(() => useWizardForm({ institutionName: 'Prim', institutionEmail: 'a@b.ro' }));
    expect(result.current.formData.institutionName).toBe('Prim');
    expect(result.current.formData.institutionEmail).toBe('a@b.ro');
  });

  it('keeps callbacks referentially stable across renders', () => {
    const { result, rerender } = renderHook(() => useWizardForm());
    const { updateFormField, initFormFromProfile } = result.current;
    rerender();
    expect(result.current.updateFormField).toBe(updateFormField);
    expect(result.current.initFormFromProfile).toBe(initFormFromProfile);
  });
});
