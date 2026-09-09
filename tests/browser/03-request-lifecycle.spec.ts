/**
 * The whole life of a request, through the browser and the real mail path:
 *
 *   wizard (2 questions) → Resend → Cloudflare → institution inbox
 *   → institution confirms #1 on the thread (ambiguous: 2 open requests) → "De revizuit" → assign in UI
 *   → institution sends the final answer as a SEPARATE email carrying the registration number → answered
 *   → the user corrects a classification from the email detail.
 *
 * Serial: every test depends on the previous one. Budget ~8 minutes.
 */
import { test, expect, type Page } from '@playwright/test';
import { CITIZEN, INSTITUTION, INSTITUTION_NAME } from './helpers/accounts';
import { getEmail, listEmails, listRequests, waitFor, type EmailRow, type RequestRow } from './helpers/db';
import { confirmationHtml, finalAnswerHtml, replyAsInstitution, waitForRequestsInInbox } from './helpers/institution';
import { login } from './helpers/login';

test.describe.configure({ mode: 'serial' });

const REG_NUMBER = `4521/${new Date().toISOString().slice(0, 10).split('-').reverse().join('.')}`;
const QUESTIONS = [
  'Care este valoarea totală a contractelor de reparații stradale încheiate în 2025?',
  'Care este calendarul lucrărilor de asfaltare planificate pentru 2026?',
];

let startedAt: string;
let requests: RequestRow[] = [];
let inbox: EmailRow[] = [];

async function openEmailsFolder(page: Page, folder: string): Promise<void> {
  await page.goto('/emails');
  await page.getByRole('button', { name: new RegExp(folder) }).first().click();
}

test.describe('ciclul de viață al unei cereri', () => {
  test.setTimeout(600_000);

  test('wizard-ul creează sesiunea și trimite 2 emailuri', async ({ page }) => {
    startedAt = new Date().toISOString();
    await login(page, CITIZEN, '/requests/new');

    await expect(page.getByText('Date cerere')).toBeVisible();
    await page.getByPlaceholder('Ion Popescu').fill(CITIZEN.displayName);
    await page.getByPlaceholder(/Str\. Victoriei/).fill('Strada Lalelelor nr. 5, Pitești, Argeș');
    await page.getByPlaceholder('ex: Transparența cheltuielilor publice').fill('Test browser: reparații stradale');
    await page.getByPlaceholder('Primăria Pitești').fill(INSTITUTION_NAME);
    await page.getByPlaceholder('registratura@institutie.ro').fill(INSTITUTION.platformEmail);
    await page.getByRole('button', { name: 'Continuă' }).click();

    await expect(page.getByText('Selectează întrebările')).toBeVisible();
    // categories start collapsed; custom questions are added inside an expanded one
    await page.getByRole('button', { name: /^A\. Financiar/ }).click();
    for (const q of QUESTIONS) {
      await page.getByRole('button', { name: /Adaug[ăa] [îi]ntrebare/ }).first().click();
      await page.getByPlaceholder('Scrie întrebarea ta...').fill(q);
      await page.getByRole('button', { name: 'Adaugă', exact: true }).click();
    }
    await expect(page.getByText(/2\s+cereri selectate/)).toBeVisible();
    await page.getByRole('button', { name: /Previzualizare/ }).click();

    await expect(page.getByText('Previzualizare cereri')).toBeVisible();
    await page.getByRole('button', { name: /Trimite toate cele 2/ }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 120_000 });

    requests = await listRequests(CITIZEN.id);
    expect(requests).toHaveLength(2);
    expect(requests.every((r) => r.status === 'pending' && r.institution_email === INSTITUTION.platformEmail)).toBe(true);
    const sent = await listEmails(CITIZEN.id, 'sent', startedAt);
    expect(sent).toHaveLength(2);
    await expect(page.getByText(INSTITUTION_NAME).first()).toBeVisible();
  });

  test('emailurile ajung în registratura instituției prin drumul real', async () => {
    inbox = await waitForRequestsInInbox(2, startedAt);
    expect(inbox.map((e) => e.to_email)).toEqual([INSTITUTION.platformEmail, INSTITUTION.platformEmail]);
    expect(inbox[0].from_email).toBe(CITIZEN.platformEmail);
    expect(inbox[0].body ?? '').toContain('544');
  });

  test('confirmarea de înregistrare ambiguă ajunge în „De revizuit” și e asociată din UI', async ({ page }) => {
    // the registry confirms on the thread of the request
    await replyAsInstitution({ original: inbox[0], html: confirmationHtml(REG_NUMBER), inThread: true });

    const confirmation = await waitFor(
      async () => {
        const rows = await listEmails(CITIZEN.id, 'received', startedAt);
        return rows.find((r) => r.processing_status === 'completed') ?? null;
      },
      { label: 'the confirmation to be received and processed', timeoutMs: 300_000 },
    );
    expect(confirmation.from_email).toBe(INSTITUTION.platformEmail);
    expect(confirmation.category).toBe('inregistrate');
    expect(confirmation.registration_number).toBe(REG_NUMBER);
    // two open requests at the same institution → the matcher asks a human
    expect(confirmation.needs_review).toBe(true);
    expect(confirmation.request_id).toBeNull();

    await login(page, CITIZEN, '/emails');
    await openEmailsFolder(page, 'De revizuit');
    await page.getByText(confirmation.subject).first().click();
    const panel = page.getByRole('region', { name: 'Revizuire manuală' }).or(page.locator('[aria-label="Revizuire manuală"]'));
    await expect(panel).toBeVisible();
    await panel.locator('select').selectOption({ index: 1 });
    await panel.getByRole('button', { name: 'Asociază' }).click();

    const updated = await waitFor(async () => {
      const row = await getEmail(confirmation.id);
      return row && row.needs_review === false && row.request_id ? row : null;
    });
    const linked = (await listRequests(CITIZEN.id)).find((r) => r.id === updated.request_id);
    expect(linked?.status).toBe('received');
    expect(linked?.registration_number).toBe(REG_NUMBER);
    expect(linked?.deadline_date).toBeTruthy();
    requests = await listRequests(CITIZEN.id);
  });

  test('răspunsul final se potrivește după numărul de înregistrare și închide cererea', async ({ page }) => {
    const target = requests.find((r) => r.registration_number === REG_NUMBER);
    expect(target).toBeTruthy();
    // the answer comes days later as a SEPARATE email (new subject, no threading headers):
    // only the registration number in the text can tie it to the request
    await replyAsInstitution({
      original: inbox[0],
      html: finalAnswerHtml(REG_NUMBER),
      inThread: false,
      subject: `Răspuns la cererea nr. ${REG_NUMBER} – Legea 544/2001`,
    });

    const answered = await waitFor(
      async () => {
        const rows = await listRequests(CITIZEN.id);
        return rows.find((r) => r.id === target!.id && r.status === 'answered') ?? null;
      },
      { label: 'the request to become answered', timeoutMs: 300_000 },
    );
    expect(answered.response_received_date).toBeTruthy();

    await login(page, CITIZEN, '/dashboard');
    await expect(page.getByText(INSTITUTION_NAME).first()).toBeVisible();
    const expand = page.getByRole('button', { name: 'Expandează' }).first();
    if (await expand.isVisible().catch(() => false)) await expand.click();
    await expect(page.getByText('Răspuns primit').first()).toBeVisible();
    await expect(page.getByText(/Așteaptă nr\. înreg\./).first()).toBeVisible();
  });

  test('utilizatorul poate corecta clasificarea unui email primit', async ({ page }) => {
    const received = (await listEmails(CITIZEN.id, 'received', startedAt)).filter((e) => e.processing_status === 'completed');
    const email = received.find((e) => e.category === 'raspunse') ?? received[0];

    await login(page, CITIZEN, '/emails');
    await openEmailsFolder(page, 'Primite');
    await page.getByText(email.subject).first().click();
    await page.getByRole('button', { name: 'Clasificarea e greșită' }).click();
    const group = page.getByRole('group', { name: 'Corectează clasificarea' });
    await group.getByRole('button', { name: 'Răspuns întârziat' }).click();
    await group.getByPlaceholder('Notă (opțional)').fill('Test browser: corecție de clasificare');
    await group.getByRole('button', { name: 'Trimite corecția' }).click();

    const corrected = await waitFor(async () => {
      const row = await getEmail(email.id);
      return row?.category === 'intarziate' ? row : null;
    });
    expect(corrected.needs_review).toBe(false);
  });
});
