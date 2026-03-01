/**
 * Test Cleanup — Removes all test data from DB and Storage
 *
 * Operates on TEST_USER_ID only — never touches real user data.
 */
import { getTestSupabase, TEST_USER_ID } from './supabase-test-client';

/**
 * Delete all test data for the test user.
 * Order matters due to foreign key constraints:
 *   emails → requests → request_sessions
 */
export async function cleanupAllTestData(): Promise<void> {
  const supabase = getTestSupabase();

  // 1. Delete emails
  await supabase.from('emails').delete().eq('user_id', TEST_USER_ID);

  // 2. Delete requests
  await supabase.from('requests').delete().eq('user_id', TEST_USER_ID);

  // 3. Delete sessions
  await supabase.from('request_sessions').delete().eq('user_id', TEST_USER_ID);

  // 4. Clean up storage files
  const { data: files } = await supabase.storage
    .from('email-attachments')
    .list(TEST_USER_ID, { limit: 1000 });

  if (files && files.length > 0) {
    // List subdirectories (each email has its own folder)
    for (const folder of files) {
      const { data: subFiles } = await supabase.storage
        .from('email-attachments')
        .list(`${TEST_USER_ID}/${folder.name}`, { limit: 100 });

      if (subFiles && subFiles.length > 0) {
        const paths = subFiles.map((f) => `${TEST_USER_ID}/${folder.name}/${f.name}`);
        await supabase.storage.from('email-attachments').remove(paths);
      }
    }
  }

  console.log('[Cleanup] All test data removed for TEST_USER_ID');
}

/**
 * Delete emails + request data for a specific session only.
 * More surgical than cleanupAllTestData.
 */
export async function cleanupSession(sessionId: string): Promise<void> {
  const supabase = getTestSupabase();

  // Get request IDs for this session
  const { data: requests } = await supabase
    .from('requests')
    .select('id')
    .eq('session_id', sessionId);

  if (requests) {
    const requestIds = requests.map((r) => r.id);

    // Delete emails linked to these requests
    if (requestIds.length > 0) {
      await supabase.from('emails').delete().in('request_id', requestIds);
    }
  }

  // Delete unlinked test emails for this user
  await supabase
    .from('emails')
    .delete()
    .eq('user_id', TEST_USER_ID)
    .is('request_id', null);

  // Delete requests
  await supabase.from('requests').delete().eq('session_id', sessionId);

  // Delete session
  await supabase.from('request_sessions').delete().eq('id', sessionId);
}

/**
 * Ensure the test user profile exists in the profiles table.
 * Creates it if missing (idempotent).
 */
export async function ensureTestUserProfile(): Promise<void> {
  const supabase = getTestSupabase();

  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', TEST_USER_ID)
    .single();

  if (!existing) {
    // Create test user in auth.users first (required for FK)
    // This uses the admin API via service role
    const { error: authError } = await supabase.auth.admin.createUser({
      id: TEST_USER_ID,
      email: 'test-e2e@implicarecivica.ro',
      email_confirm: true,
      password: 'test-password-e2e-only',
    });

    // Ignore "already exists" errors
    if (authError && !authError.message.includes('already')) {
      throw new Error(`Failed to create test auth user: ${authError.message}`);
    }

    // Create profile
    const { error: profileError } = await supabase.from('profiles').upsert({
      id: TEST_USER_ID,
      display_name: 'Test E2E Cetățean',
      mailcow_email: 'test-cetatean@implicarecivica.ro',
    });

    if (profileError) {
      throw new Error(`Failed to create test profile: ${profileError.message}`);
    }

    console.log('[Setup] Test user profile created');
  }
}

/**
 * Create a test session with N requests. Returns session + request IDs.
 */
export async function createTestSession(opts: {
  subject: string;
  institutionName: string;
  institutionEmail: string;
  questions: string[];
}): Promise<{ sessionId: string; requestIds: string[] }> {
  const supabase = getTestSupabase();

  // Create session
  const { data: session, error: sessionError } = await supabase
    .from('request_sessions')
    .insert({
      user_id: TEST_USER_ID,
      subject: opts.subject,
      institution_name: opts.institutionName,
      institution_email: opts.institutionEmail,
      total_requests: opts.questions.length,
    })
    .select()
    .single();

  if (sessionError) throw new Error(`Session create failed: ${sessionError.message}`);

  // Create requests
  const requestInserts = opts.questions.map((q) => ({
    user_id: TEST_USER_ID,
    session_id: session.id,
    institution_name: opts.institutionName,
    institution_email: opts.institutionEmail,
    subject: opts.subject,
    request_body: q,
    status: 'pending',
    date_initiated: new Date().toISOString(),
  }));

  const { data: requests, error: reqError } = await supabase
    .from('requests')
    .insert(requestInserts)
    .select('id');

  if (reqError) throw new Error(`Requests create failed: ${reqError.message}`);

  return {
    sessionId: session.id,
    requestIds: requests.map((r) => r.id),
  };
}

/**
 * Helper: create a "sent" email record (simulates what /api/emails/send does).
 * Links the sent email to a request for thread/context matching.
 */
export async function createSentEmail(opts: {
  requestId: string;
  toEmail: string;
  subject: string;
  body: string;
}): Promise<string> {
  const supabase = getTestSupabase();
  const emailId = crypto.randomUUID();

  const { error } = await supabase.from('emails').insert({
    id: emailId,
    user_id: TEST_USER_ID,
    request_id: opts.requestId,
    message_id: `<sent-${emailId}@implicarecivica.ro>`,
    type: 'sent',
    category: 'trimise',
    from_email: 'test-cetatean@implicarecivica.ro',
    to_email: opts.toEmail,
    subject: opts.subject,
    body: opts.body,
    processing_status: 'completed',
    is_read: true,
  });

  if (error) throw new Error(`Sent email insert failed: ${error.message}`);
  return emailId;
}
