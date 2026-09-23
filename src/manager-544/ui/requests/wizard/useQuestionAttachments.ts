'use client';

/**
 * Fişierele aflate „în aşteptare" la întrebările wizard-ului: în curs de încărcare sau eşuate,
 * pe id-ul întrebării. Starea stă aici, nu în picker, pentru că picker-ul se demontează la lucruri
 * obişnuite — categorie strânsă, întrebare în editare, deselectare, întoarcerea la pasul 1 — iar
 * un fişier în zbor sau eşuat nu are voie să dispară odată cu el: cererea ar pleca fără fişierul
 * pe care omul crede că l-a ataşat (spec docs/plans/2026-09-23-atasamente-design.md §4.3, §4.4).
 *
 * Încărcarea terminată ADAUGĂ ataşamentul la întrebare printr-o actualizare funcţională, deci o
 * încărcare lentă nu poate suprascrie un fişier adăugat între timp.
 */
import { useCallback, useRef, useState } from 'react';
import { checkNewAttachment, type OutgoingAttachment } from '@m544/requests/attachments';

export interface PendingAttachment {
  key: string;
  name: string;
  status: 'uploading' | 'error';
  error?: string;
  /** Lipseşte doar la refuzurile de validare (tip, mărime): acelea nu au ce reîncerca. */
  file?: File;
}

export type PendingByQuestion = Record<string, PendingAttachment[]>;

/** Ce îi trebuie unui picker ca să afişeze şi să acţioneze pe o întrebare oarecare. */
export interface QuestionAttachmentsApi {
  pending: PendingByQuestion;
  add(questionId: string, files: readonly File[]): Promise<void>;
  retry(questionId: string, key: string): Promise<void>;
  dismiss(questionId: string, key: string): void;
  remove(questionId: string, path: string): void;
}

interface Options {
  /** Ataşamentele deja urcate ale întrebării, citite sincron (pentru buget); null dacă nu mai există. */
  attachmentsOf: (questionId: string) => readonly OutgoingAttachment[] | null;
  updateAttachments: (questionId: string, fn: (list: OutgoingAttachment[]) => OutgoingAttachment[]) => void;
  upload: (file: File) => Promise<OutgoingAttachment>;
}

const patch = (all: PendingByQuestion, qid: string, key: string, change: Partial<PendingAttachment>): PendingByQuestion => ({
  ...all,
  [qid]: (all[qid] ?? []).map((x) => (x.key === key ? { ...x, ...change } : x)),
});

function without(all: PendingByQuestion, qid: string, key: string): PendingByQuestion {
  const rest = (all[qid] ?? []).filter((x) => x.key !== key);
  if (rest.length) return { ...all, [qid]: rest };
  const next = { ...all };
  delete next[qid];
  return next;
}

const has = (all: PendingByQuestion, qid: string, key: string) => (all[qid] ?? []).some((x) => x.key === key);

/** Ce ocupă deja bugetul întrebării: fişierele urcate plus cele încă în zbor. */
const budget = (attachments: readonly OutgoingAttachment[] | null, list: readonly PendingAttachment[] = []) => [
  ...(attachments ?? []),
  ...list.filter((x) => x.status === 'uploading' && x.file).map((x) => ({ size: x.file!.size })),
];

export function useQuestionAttachments({ attachmentsOf, updateAttachments, upload }: Options) {
  const [pending, setPending] = useState<PendingByQuestion>({});
  // Oglinda sincronă a stării: bucla dintr-o selecţie cu mai multe fişiere citeşte bugetul între
  // două încărcări, înainte ca React să fi re-randat.
  const pendingRef = useRef<PendingByQuestion>({});
  const updatePending = useCallback((fn: (p: PendingByQuestion) => PendingByQuestion) => {
    pendingRef.current = fn(pendingRef.current);
    setPending(pendingRef.current);
  }, []);
  const seq = useRef(0);
  // Funcţiile venite de sus ţinute în ref, ca acţiunile de mai jos să rămână stabile.
  const deps = useRef({ attachmentsOf, updateAttachments, upload });
  deps.current = { attachmentsOf, updateAttachments, upload };

  const runUpload = useCallback(
    async (qid: string, key: string, file: File) => {
      updatePending((p) => patch(p, qid, key, { status: 'uploading', error: undefined }));
      try {
        const att = await deps.current.upload(file);
        // Întrebarea a fost ştearsă între timp: nu are unde ajunge.
        if (!has(pendingRef.current, qid, key)) return;
        deps.current.updateAttachments(qid, (list) => [...list, att]);
        updatePending((p) => without(p, qid, key));
      } catch (err) {
        if (!has(pendingRef.current, qid, key)) return;
        const error = err instanceof Error ? err.message : 'Încărcarea a eșuat.';
        updatePending((p) => patch(p, qid, key, { status: 'error', error, file }));
      }
    },
    [updatePending],
  );

  const add = useCallback(
    async (qid: string, files: readonly File[]) => {
      for (const file of files) {
        const key = `p${++seq.current}`;
        const reason = checkNewAttachment(budget(deps.current.attachmentsOf(qid), pendingRef.current[qid]), file);
        if (reason) {
          updatePending((p) => ({ ...p, [qid]: [...(p[qid] ?? []), { key, name: file.name, status: 'error', error: reason }] }));
          continue;
        }
        updatePending((p) => ({ ...p, [qid]: [...(p[qid] ?? []), { key, name: file.name, status: 'uploading', file }] }));
        await runUpload(qid, key, file);
      }
    },
    [runUpload, updatePending],
  );

  const retry = useCallback(
    async (qid: string, key: string) => {
      const entry = (pendingRef.current[qid] ?? []).find((x) => x.key === key);
      if (!entry?.file || entry.status !== 'error') return;
      // Între eşec şi reîncercare omul poate să fi adăugat alte fişiere: bugetul se verifică din nou.
      const reason = checkNewAttachment(budget(deps.current.attachmentsOf(qid), pendingRef.current[qid]), entry.file);
      if (reason) {
        updatePending((p) => patch(p, qid, key, { error: reason }));
        return;
      }
      await runUpload(qid, key, entry.file);
    },
    [runUpload, updatePending],
  );

  const dismiss = useCallback((qid: string, key: string) => updatePending((p) => without(p, qid, key)), [updatePending]);

  const remove = useCallback((qid: string, path: string) => {
    deps.current.updateAttachments(qid, (list) => list.filter((a) => a.path !== path));
  }, []);

  /** La ştergerea întrebării. */
  const clear = useCallback(
    (qid: string) =>
      updatePending((p) => {
        if (!(qid in p)) return p;
        const next = { ...p };
        delete next[qid];
        return next;
      }),
    [updatePending],
  );

  return { pending, add, retry, dismiss, remove, clear };
}
