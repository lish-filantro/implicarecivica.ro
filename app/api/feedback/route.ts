import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { FeedbackCategory } from '@/lib/types/feedback';

const VALID_CATEGORIES: FeedbackCategory[] = ['bug', 'sugestie', 'utilizare', 'altele'];

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Neautorizat' }, { status: 401 });
    }

    const { category, message, page_url } = await request.json();

    if (!category || !message) {
      return NextResponse.json(
        { error: 'Câmpuri lipsă: category și message sunt obligatorii' },
        { status: 400 },
      );
    }

    if (!VALID_CATEGORIES.includes(category)) {
      return NextResponse.json(
        { error: 'Categorie invalidă' },
        { status: 400 },
      );
    }

    if (typeof message !== 'string' || message.trim().length < 5) {
      return NextResponse.json(
        { error: 'Mesajul trebuie să aibă cel puțin 5 caractere' },
        { status: 400 },
      );
    }

    const { data, error: dbError } = await supabase
      .from('feedback')
      .insert({
        user_id: user.id,
        category,
        message: message.trim(),
        page_url: page_url || null,
      })
      .select()
      .single();

    if (dbError) {
      console.error('Feedback insert error:', dbError);
      return NextResponse.json(
        { error: 'Eroare la salvarea feedbackului' },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, feedback: data });
  } catch (error) {
    console.error('Feedback error:', error);
    return NextResponse.json(
      { error: 'Eroare internă' },
      { status: 500 },
    );
  }
}
