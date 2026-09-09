/**
 * The 544 assistant end to end (real Anthropic): STEP_1 collects the problem,
 * the summary appears, STEP_2 identifies an institution and shows the
 * institution card, whose "Pregătește cererile" opens the request wizard for
 * the conversation (step 2 with the generated questions when the profile is
 * complete, else step 1 pre-filled). Model output varies, so assertions are
 * structural.
 */
import { test, expect, type Page } from '@playwright/test';
import { CITIZEN } from './helpers/accounts';
import { db } from './helpers/db';
import { login } from './helpers/login';

const INPUT = 'textarea[placeholder="Scrie-ți întrebarea aici..."]';

async function say(page: Page, text: string): Promise<void> {
  const input = page.locator(INPUT);
  await input.fill(text);
  await page.getByRole('button', { name: 'Trimite mesajul' }).click();
  // the input is disabled while the model answers; the reply is there once it is enabled again
  await expect(input).toBeDisabled({ timeout: 10_000 }).catch(() => undefined);
  await expect(input).toBeEnabled({ timeout: 120_000 });
  await expect(input).toHaveValue('');
}

test.describe('asistentul 544', () => {
  test.setTimeout(300_000);

  test('STEP_1 → rezumat → STEP_2 identifică instituția', async ({ page }) => {
    await login(page, CITIZEN, '/chat');
    await expect(page.locator(INPUT)).toBeVisible();

    await say(page, 'Pe strada mea sunt gropi mari în asfalt de luni de zile și nimeni nu le repară.');
    // STEP_1: the assistant asks for the missing details (where / since when)
    await expect(page.getByText(/unde|adres|strad|c[âa]nd|de c[âa]nd/i).last()).toBeVisible();

    await say(
      page,
      'Strada Lalelelor nr. 5, Pitești, Argeș. Gropile au apărut în martie 2026 și s-au adâncit după ploi.',
    );
    await expect(page.getByText(/✅|PROBLEMA_DEFINIT|Confirm/i).last()).toBeVisible();

    await say(page, 'Da, confirm.');
    // STEP_2: the institution card (name, email, source) with the hand-off button
    const card = page.getByRole('region', { name: 'Instituție identificată' });
    await expect(card).toBeVisible({ timeout: 120_000 });
    await expect(card.getByText(/@[a-z0-9.-]+\.ro/i).or(card.getByText(/Nu am găsit o adresă oficială/))).toBeVisible();
  });

  test('"Pregătește cererile" opens the wizard for the conversation with the data pre-filled', async ({ page }) => {
    // The hand-off lives in conversations.handoff (migration 018); without it the wizard cannot be pre-filled.
    const { error } = await db().from('conversations').select('handoff').limit(1);
    expect(error, 'migrarea 018_conversation_handoff.sql nu este aplicată în Supabase').toBeNull();

    await login(page, CITIZEN, '/chat');
    await say(page, 'Pe strada mea sunt gropi mari în asfalt de luni de zile și nimeni nu le repară.');
    await say(
      page,
      'Strada Lalelelor nr. 5, Pitești, Argeș. Gropile au apărut în martie 2026 și s-au adâncit după ploi.',
    );
    await say(page, 'Da, confirm.');
    const card = page.getByRole('region', { name: 'Instituție identificată' });
    await expect(card).toBeVisible({ timeout: 120_000 });

    const prepare = card.getByRole('button', { name: 'Pregătește cererile' });
    if (!(await prepare.isEnabled())) {
      // the model could not confirm an official address online: the hand-off is blocked by design
      await expect(card.getByText(/Nu am găsit o adresă oficială/)).toBeVisible();
      test.skip(true, 'the assistant found no official email for this run; nothing to hand off');
      return;
    }

    await prepare.click();
    await expect(page).toHaveURL(/\/requests\/new\?conversation=/, { timeout: 30_000 });

    const step2 = page.getByText('Selectează întrebările');
    const step1 = page.getByText('Date cerere', { exact: true });
    await expect(step2.or(step1).first()).toBeVisible({ timeout: 30_000 });

    if (await page.getByRole('region', { name: 'Rezumat cerere' }).isVisible().catch(() => false)) {
      // profile complete → step 2: recap + the generated set (the chat model needs a while)
      const recap = page.getByRole('region', { name: 'Rezumat cerere' });
      await expect(recap).toContainText(CITIZEN.displayName);
      await expect(recap.getByText(/@[a-z0-9.-]+\.ro/i).first()).toBeVisible();
      // generated questions arrive unselected: a category badge like "0/5"
      await expect(page.getByText(/^0\/[1-5]$/).first()).toBeVisible({ timeout: 180_000 });
      await expect(page.getByText(/Recomandăm cel mult 10/)).toBeVisible();
    } else {
      // profile incomplete (no address) → step 1 with the institution pre-filled
      await expect(page.getByPlaceholder('Primăria Pitești')).not.toHaveValue('');
      await expect(page.getByPlaceholder('registratura@institutie.ro')).not.toHaveValue('');
      await expect(page.getByPlaceholder('ex: Transparența cheltuielilor publice')).not.toHaveValue('');
    }
  });

  test('mesajele în afara subiectului primesc răspunsul standard fără a apela modelul', async ({ page }) => {
    await login(page, CITIZEN, '/chat');
    await say(page, 'Spune-mi o rețetă de ciorbă de burtă.');
    await expect(page.getByText(/specializat doar pe Legea 544/i).last()).toBeVisible();
  });
});
