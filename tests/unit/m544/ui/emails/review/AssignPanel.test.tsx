// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import AssignPanel, { REVIEW_BANNER, NO_REQUESTS } from '@m544/ui/emails/review/AssignPanel';
import type { ReviewApi } from '@m544/ui/emails/review/useReview';
import type { AssignableRequest } from '@m544/requests/queries.client';
import { makeEmail } from '../_fixtures';

afterEach(cleanup);

function request(over: Partial<AssignableRequest> = {}): AssignableRequest {
  return {
    id: 'r1',
    subject: 'Cheltuieli cultură',
    institution_name: 'Primăria Cluj',
    institution_email: 'registratura@primariacluj.ro',
    status: 'pending',
    registration_number: null,
    deadline_date: null,
    extension_date: null,
    session_id: 's1',
    session_label: 'Buget 2026',
    ...over,
  };
}

const requests: AssignableRequest[] = [
  request({ id: 'r1', registration_number: '4521', subject: 'Cheltuieli cultură' }),
  request({ id: 'r2', registration_number: '4522', subject: 'Lista contractelor' }),
  request({
    id: 'r3',
    session_id: 's2',
    session_label: 'Achiziții',
    institution_email: 'contact@cjcluj.ro',
    subject: 'Licitații',
  }),
];

function api(over: Partial<ReviewApi> = {}): ReviewApi {
  return {
    assign: vi.fn(async () => null),
    reclassify: vi.fn(async () => null),
    dismiss: vi.fn(async () => null),
    busy: false,
    error: null,
    ...over,
  };
}

const email = makeEmail({ id: 'e1', needs_review: true, from_email: 'registratura@primariacluj.ro', category: 'raspunse' });

describe('AssignPanel', () => {
  it('assigns the chosen question together with what the email does to it', async () => {
    const review = api();
    render(<AssignPanel email={email} review={review} loadRequests={async () => requests} />);

    const button = () => screen.getByRole('button', { name: 'Atribuie' }) as HTMLButtonElement;
    await waitFor(() => expect(button().disabled).toBe(false));

    fireEvent.change(screen.getByLabelText('Întrebarea'), { target: { value: 'r2' } });
    fireEvent.change(screen.getByLabelText('Emailul este'), { target: { value: 'amanate' } });
    fireEvent.click(button());

    expect(review.assign).toHaveBeenCalledWith('e1', 'r2', 'amanate');
  });

  it('suggests the session of the sender and lists only its questions', async () => {
    render(<AssignPanel email={email} review={api()} loadRequests={async () => requests} />);

    await waitFor(() => expect((screen.getByLabelText('Sesiunea') as HTMLSelectElement).value).toBe('s1'));
    const questions = screen.getByLabelText('Întrebarea') as HTMLSelectElement;
    expect([...questions.options].map((o) => o.value)).toEqual(['r1', 'r2']);
    expect(questions.textContent).toContain('nr. 4521');
    expect(questions.textContent).not.toContain('Licitații');
  });

  it('switching the session switches the questions', async () => {
    render(<AssignPanel email={email} review={api()} loadRequests={async () => requests} />);
    await waitFor(() => expect(screen.getByLabelText('Întrebarea')).toBeTruthy());

    fireEvent.change(screen.getByLabelText('Sesiunea'), { target: { value: 's2' } });
    const questions = screen.getByLabelText('Întrebarea') as HTMLSelectElement;
    expect([...questions.options].map((o) => o.value)).toEqual(['r3']);
    expect(questions.value).toBe('r3');
  });

  it('starts from the classifier category, and can be left on it', async () => {
    const review = api();
    render(<AssignPanel email={email} review={review} loadRequests={async () => requests} />);
    await waitFor(() => expect((screen.getByLabelText('Emailul este') as HTMLSelectElement).value).toBe('raspunse'));

    fireEvent.click(screen.getByRole('button', { name: 'Atribuie' }));
    expect(review.assign).toHaveBeenCalledWith('e1', 'r1', 'raspunse');
  });

  it('offers no category for an email the classifier called irrelevant, and assigns without one', async () => {
    const review = api();
    const irrelevant = makeEmail({ id: 'e2', from_email: 'registratura@primariacluj.ro', category: 'irelevant' });
    render(<AssignPanel email={irrelevant} review={review} loadRequests={async () => requests} />);
    await waitFor(() => expect((screen.getByLabelText('Emailul este') as HTMLSelectElement).value).toBe(''));

    fireEvent.click(screen.getByRole('button', { name: 'Atribuie' }));
    expect(review.assign).toHaveBeenCalledWith('e2', 'r1', undefined);
  });

  it('shows the review banner only for a flagged email', async () => {
    render(<AssignPanel email={email} review={api()} loadRequests={async () => requests} />);
    expect(screen.getByText(REVIEW_BANNER)).toBeTruthy();
    cleanup();

    render(<AssignPanel email={makeEmail({ id: 'e3' })} review={api()} loadRequests={async () => requests} />);
    expect(screen.queryByText(REVIEW_BANNER)).toBeNull();
  });

  it('dismisses without any selection', async () => {
    const review = api();
    render(<AssignPanel email={email} review={review} loadRequests={async () => []} />);
    await waitFor(() => expect(screen.getByText(NO_REQUESTS)).toBeTruthy());
    expect((screen.getByRole('button', { name: 'Atribuie' }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Marchează ca revizuit' }));
    expect(review.dismiss).toHaveBeenCalledWith('e1');
  });

  it('does not claim there is nothing to assign while the requests are still loading', async () => {
    let release: (rows: AssignableRequest[]) => void = () => {};
    const pending = new Promise<AssignableRequest[]>((resolve) => {
      release = resolve;
    });
    render(<AssignPanel email={email} review={api()} loadRequests={() => pending} />);

    expect(screen.queryByText(NO_REQUESTS)).toBeNull();
    expect(screen.getByRole('button', { name: 'Atribuie' })).toBeTruthy();

    release([]);
    await waitFor(() => expect(screen.getByText(NO_REQUESTS)).toBeTruthy());
  });

  it('surfaces the hook error and the load error; disables the buttons while busy', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <AssignPanel
        email={email}
        review={api({ busy: true, error: 'Cererea nu a fost găsită' })}
        loadRequests={async () => requests}
      />,
    );
    expect(screen.getByRole('alert').textContent).toBe('Cererea nu a fost găsită');
    expect((screen.getByRole('button', { name: 'Marchează ca revizuit' }) as HTMLButtonElement).disabled).toBe(true);
    cleanup();

    render(
      <AssignPanel
        email={email}
        review={api()}
        loadRequests={async () => {
          throw new Error('offline');
        }}
      />,
    );
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Nu am putut încărca cererile.'));
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
