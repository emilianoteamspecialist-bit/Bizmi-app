import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const submissionId = params.id;
    const { sender_id, message, is_revision_request } = await req.json();

    if (!submissionId || !sender_id || !message) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    // 1. Insert the comment
    const { data: comment, error: commentError } = await supabase
      .from('submission_comments')
      .insert({
        submission_id: submissionId,
        sender_id,
        message
      })
      .select(`
        *,
        sender:profiles(full_name)
      `)
      .single();

    if (commentError) throw commentError;

    // 2. If it's a revision request, update the submission status
    if (is_revision_request) {
      await supabase
        .from('project_submissions')
        .update({ status: 'changes_requested', updated_at: new Date().toISOString() })
        .eq('id', submissionId);
    }

    return NextResponse.json({ success: true, comment });
  } catch (error) {
    console.error('Server error posting comment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const submissionId = params.id;

    const { data, error } = await supabase
      .from('submission_comments')
      .select(`
        *,
        sender:profiles(full_name)
      `)
      .eq('submission_id', submissionId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    return NextResponse.json({ comments: data });
  } catch (error) {
    console.error('Server error fetching comments:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
