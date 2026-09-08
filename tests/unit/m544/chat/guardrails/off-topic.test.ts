/**
 * chat/guardrails/off-topic — only very clear off-topic requests are flagged.
 */
import { describe, it, expect } from 'vitest';
import { isOffTopic } from '@m544/chat/guardrails/off-topic';

describe('isOffTopic', () => {
  it.each([
    'Scrie-mi un poem despre toamnă',
    'scrie o poveste scurtă',
    'scrie o glumă',
    'Write a poem about cats',
    'write a story',
    'traduce în engleză',
    'translate this',
    'rezolvă această problemă matematică',
    'calculează 2+2',
    'rețetă de gătit sarmale',
    'rețetă mâncare',
    'Ce zice horoscopul azi?',
    'Cine a câștigat alegerile?',
    'scorul la meci',
    'fotbal',
    'generează cod',
    'scrie cod python',
  ])('flags: %s', (m) => {
    expect(isOffTopic(m)).toBe(true);
  });

  it.each([
    'Am o groapă pe Strada Libertății nr. 45, Pitești, Argeș',
    'Vreau informații despre bugetul primăriei',
    'Care instituție răspunde de drumul județean?',
    'da, confirm',
  ])('allows: %s', (m) => {
    expect(isOffTopic(m)).toBe(false);
  });
});
