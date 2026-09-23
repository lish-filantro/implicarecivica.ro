'use client';

/**
 * Explică de ce previzualizarea e blocată din cauza ataşamentelor, nu din lipsă de selecţie.
 * Folosit atât în wizard-ul de creare (StepSelectQuestions), cât şi în /requests/add
 * (AddRequestsQuestions) — o singură sursă, ca cele două să nu se dezacordeze.
 */
interface AttachmentsBusyHintProps {
  show: boolean;
}

export function AttachmentsBusyHint({ show }: AttachmentsBusyHintProps) {
  if (!show) return null;
  return (
    <p className="text-xs text-activist-orange-600 dark:text-activist-orange-400 text-center">
      Așteaptă încărcarea atașamentelor sau scoate fișierele cu eroare.
    </p>
  );
}
