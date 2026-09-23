import { describe, it, expect } from 'vitest';
import { uploadAttachment, type AttachmentUploader } from '@m544/ui/requests/attachments/upload';

function fakeUploader() {
  const uploaded: string[] = [];
  const uploader: AttachmentUploader = {
    userId: async () => 'u1',
    upload: async (path) => {
      uploaded.push(path);
    },
  };
  return { uploader, uploaded };
}

const pdf = (name = 'doc.pdf') => new File([new TextEncoder().encode('%PDF-1.4')], name, { type: 'application/pdf' });

describe('uploadAttachment', () => {
  it('urcă fişierul sub folderul utilizatorului şi întoarce referinţa', async () => {
    const { uploader, uploaded } = fakeUploader();
    const att = await uploadAttachment(pdf('Răspuns 544.pdf'), { uploader, newId: () => 'id1' });
    expect(uploaded).toEqual(['u1/outgoing/id1/Răspuns 544.pdf']);
    expect(att).toEqual({ path: 'u1/outgoing/id1/Răspuns 544.pdf', name: 'Răspuns 544.pdf', type: 'application/pdf', size: 8 });
  });

  it('dă căi distincte aceluiaşi fişier ataşat de două ori (Review Focus 5)', async () => {
    const { uploader, uploaded } = fakeUploader();
    let n = 0;
    const newId = () => `id${++n}`;
    await uploadAttachment(pdf(), { uploader, newId });
    await uploadAttachment(pdf(), { uploader, newId });
    expect(new Set(uploaded).size).toBe(2);
  });

  it('propagă eroarea de storage, ca interfaţa s-o poată arăta', async () => {
    const uploader: AttachmentUploader = {
      userId: async () => 'u1',
      upload: async () => {
        throw new Error('rețea');
      },
    };
    await expect(uploadAttachment(pdf(), { uploader, newId: () => 'x' })).rejects.toThrow('rețea');
  });
});
