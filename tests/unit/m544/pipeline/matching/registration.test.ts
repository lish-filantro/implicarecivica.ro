/**
 * pipeline/matching/registration — strategy 2: exact → substring (fuzzy) → numeric core.
 */
import { describe, it, expect } from 'vitest';
import { matchByRegistration } from '@m544/pipeline/matching';
import { FakeRequestsRepo } from '../../_fakes/fake-repos';

const USER = 'user-1';

describe('matchByRegistration', () => {
  it('exact match → high confidence', async () => {
    const requests = new FakeRequestsRepo();
    const req = requests.seed({ user_id: USER, registration_number: '29702/14.11.2025' });
    const result = await matchByRegistration(USER, '29702/14.11.2025', requests);
    expect(result).toEqual({ requestId: req.id, strategy: 'registration', confidence: 'high' });
  });

  it('substring match (DB value contained in extracted) → medium confidence', async () => {
    const requests = new FakeRequestsRepo();
    const req = requests.seed({ user_id: USER, registration_number: '31884' });
    const result = await matchByRegistration(USER, 'Nr. 31884 / 01.12.2025', requests);
    expect(result).toEqual({ requestId: req.id, strategy: 'registration', confidence: 'medium' });
  });

  it('substring match (extracted contained in DB value) → medium confidence', async () => {
    const requests = new FakeRequestsRepo();
    const req = requests.seed({ user_id: USER, registration_number: '31884/01.12.2025' });
    const result = await matchByRegistration(USER, '31884', requests);
    expect(result).toEqual({ requestId: req.id, strategy: 'registration', confidence: 'medium' });
  });

  it('core match (same base number, different dates) → high confidence', async () => {
    const requests = new FakeRequestsRepo();
    const req = requests.seed({ user_id: USER, registration_number: '29702/14.11.2025' });
    const result = await matchByRegistration(USER, '29702/22.11.2025', requests);
    expect(result).toEqual({ requestId: req.id, strategy: 'registration', confidence: 'high' });
  });

  it('prefers exact over fuzzy when both exist', async () => {
    const requests = new FakeRequestsRepo();
    requests.seed({ user_id: USER, registration_number: '4500' });
    const exact = requests.seed({ user_id: USER, registration_number: '4500/2024' });
    const result = await matchByRegistration(USER, '4500/2024', requests);
    expect(result?.requestId).toBe(exact.id);
    expect(result?.confidence).toBe('high');
  });

  it('does not match requests of another user', async () => {
    const requests = new FakeRequestsRepo();
    requests.seed({ user_id: 'other', registration_number: '29702/14.11.2025' });
    expect(await matchByRegistration(USER, '29702/14.11.2025', requests)).toBeNull();
  });

  it('returns null when nothing matches', async () => {
    const requests = new FakeRequestsRepo();
    requests.seed({ user_id: USER, registration_number: '11111/2025' });
    requests.seed({ user_id: USER });
    expect(await matchByRegistration(USER, '99999/2025', requests)).toBeNull();
  });

  it('short numbers cannot core-match (core requires >= 3 digits)', async () => {
    const requests = new FakeRequestsRepo();
    requests.seed({ user_id: USER, registration_number: '12/A/2025' });
    expect(await matchByRegistration(USER, '12/B/2025', requests)).toBeNull();
  });
});
