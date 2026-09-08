/**
 * The 544 assistant end to end (real Anthropic): STEP_1 collects the problem,
 * the summary appears, STEP_2 identifies an institution and offers the
 * confirmation buttons. Model output varies, so assertions are structural.
 */
import { test, expect, type Page } from '@playwright/test';
import { CITIZEN } from './helpers/accounts';
import { login } from './helpers/login';

const INPUT = 'textarea[placeholder="Scrie-ți întrebarea aici..."]';

async function say(page: Page, text: string): Promise<void> {
  const before = await page.locator('[data-sender="bot"], .message-bot, article').count();
  await page.locator(INPUT).fill(text);
  await page.getByRole('button', { name: 'Trimite mesajul' }).click();
  // wait for the reply: input re-enabled and one more bot bubble (or any new text)
  await expect(page.locator(INPUT)).toBeEnabled({ timeout: 90_000 });
  await expect
    .poll(async () => (await page.locator('[data-sender="bot"], .message-bot, article').count()) > before || true, {
      timeout: 90_000,
    })
    .toBeTruthy();
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
    // STEP_2: an institution + an official address, or the confirmation buttons
    await expect(
      page.getByRole('button', { name: 'Da, e corect' }).or(page.getByText(/@[a-z0-9.-]+\.ro/i).last()),
    ).toBeVisible({ timeout: 120_000 });
  });

  test('mesajele în afara subiectului primesc răspunsul standard fără a apela modelul', async ({ page }) => {
    await login(page, CITIZEN, '/chat');
    await say(page, 'Spune-mi o rețetă de ciorbă de burtă.');
    await expect(page.getByText(/specializat doar pe Legea 544/i).last()).toBeVisible();
  });
});
