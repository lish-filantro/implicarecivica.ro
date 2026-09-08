import { describe, it, expect } from 'vitest';
import { readChatTransferData, CHAT_TRANSFER_KEY } from '@m544/ui/requests/wizard/chat-transfer';

function storageWith(value: string | null) {
  return { getItem: (key: string) => (key === CHAT_TRANSFER_KEY ? value : null) };
}

describe('readChatTransferData', () => {
  const payload = {
    institutionName: 'Primăria X',
    institutionEmail: 'a@b.ro',
    problemContext: { ce: 'c', unde: 'u', cand: 'k' },
    conversationId: 'conv',
  };

  it('returns null when not coming from chat, even if data is stored', () => {
    expect(readChatTransferData(false, storageWith(JSON.stringify(payload)))).toBeNull();
  });

  it('returns null without storage (SSR)', () => {
    expect(readChatTransferData(true, null)).toBeNull();
  });

  it('parses the stored payload', () => {
    expect(readChatTransferData(true, storageWith(JSON.stringify(payload)))).toEqual(payload);
  });

  it('returns null when nothing is stored', () => {
    expect(readChatTransferData(true, storageWith(null))).toBeNull();
  });

  it('swallows malformed JSON', () => {
    expect(readChatTransferData(true, storageWith('{not json'))).toBeNull();
  });

  it('swallows a throwing storage', () => {
    const throwing = { getItem: () => { throw new Error('denied'); } };
    expect(readChatTransferData(true, throwing)).toBeNull();
  });
});
