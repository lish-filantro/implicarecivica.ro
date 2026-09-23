'use client';

/**
 * „📎 Ataşează" pentru o întrebare: alege fişiere, le verifică pe loc, le urcă unul câte unul şi
 * le afişează cu mărime şi „✕". Un fişier refuzat sau eşuat rămâne vizibil, cu motivul, şi ţine
 * întrebarea „ocupată" până e scos sau reîncercat — ca omul să nu ajungă la previzualizare
 * crezând că a ataşat ceva ce nu s-a urcat. Spec: docs/plans/2026-09-23-atasamente-design.md §4.3.
 */
import { useEffect, useRef, useState } from 'react';
import { Paperclip, X, Loader2, AlertCircle } from 'lucide-react';
import { ATTACHMENT_ACCEPT, checkNewAttachment, formatMb, type OutgoingAttachment } from '@m544/requests/attachments';
import { uploadAttachment } from './upload';

interface Pending {
  key: string;
  name: string;
  status: 'uploading' | 'error';
  error?: string;
  /** Prezent doar la eşecurile de încărcare — refuzurile de validare nu se pot reîncerca. */
  file?: File;
}

interface AttachmentPickerProps {
  attachments: OutgoingAttachment[];
  onChange: (next: OutgoingAttachment[]) => void;
  onBusyChange?: (busy: boolean) => void;
  upload?: (file: File) => Promise<OutgoingAttachment>;
}

let pendingSeq = 0;

export function AttachmentPicker({ attachments, onChange, onBusyChange, upload = (f) => uploadAttachment(f) }: AttachmentPickerProps) {
  const [pending, setPending] = useState<Pending[]>([]);
  // Ultima listă cunoscută: încărcările durează, iar între timp părintele poate re-randa.
  const latest = useRef(attachments);
  latest.current = attachments;
  // Oglinda sincronă a lui `pending`, pentru bugetul din `onFiles`: `pending` din closure-ul unei
  // selecţii anterioare poate fi învechit dacă o încărcare se termină cât timp o altă selecţie
  // e încă în buclă — starea din React nu se actualizează sincron.
  const pendingRef = useRef<Pending[]>([]);
  const updatePending = (fn: (p: Pending[]) => Pending[]) => {
    pendingRef.current = fn(pendingRef.current);
    setPending(pendingRef.current);
  };

  const busy = pending.length > 0;
  // `onBusyChange` ţinut într-un ref: un părinte fără `useCallback` creează o funcţie nouă la
  // fiecare randare, iar efectul de mai jos nu trebuie să retrigger-uiască pentru asta.
  const onBusyRef = useRef(onBusyChange);
  onBusyRef.current = onBusyChange;

  useEffect(() => {
    onBusyRef.current?.(busy);
  }, [busy]);

  // Cleanup separat, doar la demontare: dacă întrebarea e ascunsă (ex. deselectată în chat) cât
  // timp are un fişier eşuat, „ocupat” trebuie eliberat — altfel butonul de previzualizare rămâne
  // blocat fără nicio cauză vizibilă.
  useEffect(() => {
    return () => {
      onBusyRef.current?.(false);
    };
  }, []);

  const runUpload = async (key: string, file: File) => {
    updatePending((p) => p.map((x) => (x.key === key ? { ...x, status: 'uploading', error: undefined } : x)));
    try {
      const att = await upload(file);
      latest.current = [...latest.current, att];
      onChange(latest.current);
      updatePending((p) => p.filter((x) => x.key !== key));
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Încărcarea a eșuat.';
      updatePending((p) => p.map((x) => (x.key === key ? { ...x, status: 'error', error, file } : x)));
    }
  };

  const onFiles = async (files: FileList | File[] | null) => {
    for (const file of Array.from(files ?? [])) {
      const key = `p${++pendingSeq}`;
      const inFlight = pendingRef.current.filter((x) => x.status === 'uploading' && x.file).map((x) => ({ size: x.file!.size }));
      const reason = checkNewAttachment([...latest.current, ...inFlight], file);
      if (reason) {
        updatePending((p) => [...p, { key, name: file.name, status: 'error', error: reason }]);
        continue;
      }
      updatePending((p) => [...p, { key, name: file.name, status: 'uploading', file }]);
      await runUpload(key, file);
    }
  };

  return (
    <div className="mt-2 space-y-1.5">
      {attachments.map((a) => (
        <div key={a.path} className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
          <Paperclip className="h-3.5 w-3.5 text-gray-400 shrink-0" />
          <span className="truncate">{a.name}</span>
          <span className="text-gray-400">{formatMb(a.size)}</span>
          <button
            type="button"
            aria-label={`Elimină ${a.name}`}
            onClick={() => onChange(latest.current.filter((x) => x.path !== a.path))}
            className="p-0.5 text-gray-400 hover:text-protest-red-600"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}

      {pending.map((p) => (
        <div key={p.key} className="flex items-start gap-2 text-xs">
          {p.status === 'uploading' ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-civic-blue-500 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="h-3.5 w-3.5 text-protest-red-600 shrink-0 mt-0.5" />
          )}
          <div className="min-w-0">
            <span className="truncate text-gray-700 dark:text-gray-300">{p.name}</span>{' '}
            {p.status === 'uploading' ? (
              <span className="text-gray-400">se încarcă…</span>
            ) : (
              <span className="text-protest-red-700 dark:text-protest-red-300">{p.error}</span>
            )}
          </div>
          {p.status === 'error' && p.file && (
            <button type="button" onClick={() => runUpload(p.key, p.file!)} className="text-civic-blue-600 dark:text-civic-blue-400 hover:underline shrink-0">
              Reîncearcă
            </button>
          )}
          {p.status === 'error' && (
            <button
              type="button"
              aria-label={`Elimină ${p.name}`}
              onClick={() => updatePending((all) => all.filter((x) => x.key !== p.key))}
              className="p-0.5 text-gray-400 hover:text-protest-red-600 shrink-0"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      ))}

      <label className="inline-flex items-center gap-1.5 text-xs font-medium text-civic-blue-600 dark:text-civic-blue-400 cursor-pointer hover:underline">
        <Paperclip className="h-3.5 w-3.5" />
        Atașează
        <input
          type="file"
          multiple
          accept={ATTACHMENT_ACCEPT}
          className="sr-only"
          onChange={(e) => {
            void onFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </label>
    </div>
  );
}
