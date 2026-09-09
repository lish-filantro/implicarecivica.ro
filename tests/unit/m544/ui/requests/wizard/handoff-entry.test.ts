/**
 * wizard/handoff-entry — the wizard entry from a conversation: session name,
 * form seed and the start-step decision.
 */
import { describe, it, expect } from 'vitest';
import {
  sessionNameFrom,
  formFromHandoff,
  decideStartStep,
  missingFormFields,
  DEFAULT_SESSION_NAME,
} from '@m544/ui/requests/wizard/handoff-entry';
import type { ConversationHandoff } from '@m544/shared/types/chat';
import type { WizardFormData } from '@m544/ui/requests/wizard/types';

const handoff: ConversationHandoff = {
  institutionName: 'Primăria Sector 3',
  institutionEmail: 'relatii@primarie3.ro',
  emailConfidence: 'medium',
  sourceUrl: 'https://primarie3.ro/contact',
  problemContext: { ce: 'groapă mare în asfalt pe strada Mioriței la numărul 12', unde: 'Str. Mioriței 12, Sector 3, București', cand: 'martie 2026' },
  identifiedAt: '2026-09-09T10:00:00.000Z',
  confirmedAt: '2026-09-09T10:01:00.000Z',
  sessionId: null,
  questions: null,
  questionsModel: null,
};

const profile = { display_name: 'Ion Popescu', mailcow_email: 'ion@implicarecivica.ro', address: 'Str. Lalelelor 5, Pitești' };

describe('sessionNameFrom', () => {
  it('cuts the problem at 40 characters on a word boundary and appends the institution', () => {
    expect(sessionNameFrom(handoff.problemContext.ce, 'Primăria Sector 3')).toBe(
      'Groapă mare în asfalt pe strada Mioriței, Primăria Sector 3',
    );
  });

  it('does not cut in the middle of a word', () => {
    const name = sessionNameFrom('Iluminat public nefuncțional pe bulevardul Independenței', 'Primăria X');
    expect(name).toBe('Iluminat public nefuncțional pe, Primăria X');
  });

  it('keeps a short problem whole and capitalises it', () => {
    expect(sessionNameFrom('gunoi neridicat', 'Primăria X')).toBe('Gunoi neridicat, Primăria X');
  });

  it('falls back to the institution, then to the default name', () => {
    expect(sessionNameFrom('', 'Primăria X')).toBe('Primăria X');
    expect(sessionNameFrom('   ', '')).toBe(DEFAULT_SESSION_NAME);
  });
});

describe('formFromHandoff', () => {
  it('maps institution, email, conversation and the proposed session name', () => {
    expect(formFromHandoff(handoff, 'conv-1')).toEqual({
      institutionName: 'Primăria Sector 3',
      institutionEmail: 'relatii@primarie3.ro',
      conversationId: 'conv-1',
      sessionName: 'Groapă mare în asfalt pe strada Mioriței, Primăria Sector 3',
    });
  });
});

describe('decideStartStep', () => {
  it('is 2 only with a complete profile and a valid institution email', () => {
    expect(decideStartStep(handoff, profile)).toBe(2);
  });

  it('is 1 without a hand-off or a profile', () => {
    expect(decideStartStep(null, profile)).toBe(1);
    expect(decideStartStep(handoff, null)).toBe(1);
  });

  it('is 1 when the profile misses the name or the address', () => {
    expect(decideStartStep(handoff, { ...profile, address: null })).toBe(1);
    expect(decideStartStep(handoff, { ...profile, address: '   ' })).toBe(1);
    expect(decideStartStep(handoff, { ...profile, display_name: '' })).toBe(1);
  });

  it('is 1 when the institution email is missing or malformed', () => {
    expect(decideStartStep({ ...handoff, institutionEmail: null }, profile)).toBe(1);
    expect(decideStartStep({ ...handoff, institutionEmail: 'registratura' }, profile)).toBe(1);
  });
});

describe('missingFormFields', () => {
  const full: WizardFormData = {
    solicitantName: 'Ion',
    solicitantEmail: 'ion@mail.ro',
    solicitantAddress: 'Str. X 1',
    saveAddress: false,
    institutionName: 'Primăria',
    institutionEmail: 'a@b.ro',
    sessionName: 'Sesiune',
  };

  it('is empty for a complete form', () => {
    expect(missingFormFields(full)).toEqual([]);
  });

  it('lists empty required fields and a malformed institution email', () => {
    expect(missingFormFields({ ...full, solicitantAddress: ' ', institutionEmail: 'nope', sessionName: '' })).toEqual([
      'solicitantAddress',
      'sessionName',
      'institutionEmail',
    ]);
  });
});
