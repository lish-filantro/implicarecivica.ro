import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/emails/attachments?path=userId/emailId/filename.pdf
 * Returns a signed URL for downloading an attachment from Supabase Storage.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Neautorizat' }, { status: 401 });
    }

    const path = request.nextUrl.searchParams.get('path');
    if (!path) {
      return NextResponse.json({ error: 'Lipsă parametru path' }, { status: 400 });
    }

    // Security: ensure the path starts with the user's own ID
    if (!path.startsWith(user.id)) {
      return NextResponse.json({ error: 'Acces interzis' }, { status: 403 });
    }

    const { data, error } = await supabase.storage
      .from('email-attachments')
      .createSignedUrl(path, 3600); // 1 hour

    if (error) {
      console.error('Signed URL error:', error);
      return NextResponse.json({ error: 'Nu s-a putut genera link-ul' }, { status: 500 });
    }

    return NextResponse.json({ url: data.signedUrl });
  } catch (error) {
    console.error('Attachment download error:', error);
    return NextResponse.json({ error: 'Eroare internă' }, { status: 500 });
  }
}
