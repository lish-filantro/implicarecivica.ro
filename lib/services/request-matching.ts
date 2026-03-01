/**
 * Request Matching Service — Links received emails to existing requests
 *
 * 3-tier matching strategy:
 * 1. Thread Matching — via parent_email_id → request_id chain
 * 2. Registration Number Matching — exact + fuzzy
 * 3. Context Matching — subject normalization, institution, sender
 *
 * Does NOT create fallback requests (avoids duplicates).
 */

import { createServerClient } from '@supabase/ssr';
import type { AnalysisResult } from './analysis-service';

function getServiceClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } },
  );
}

/**
 * Extract the numeric core from a registration number.
 * "29702/14.11.2025" → "29702"
 * "Nr. 31884 / 01.12.2025" → "31884"
 * "4500/2024" → "4500"
 */
export function extractRegNumberCore(reg: string): string | null {
  const cleaned = reg.replace(/^nr\.?\s*/i, '').trim();
  const match = cleaned.match(/^(\d+)/);
  return match && match[1].length >= 3 ? match[1] : null;
}

/**
 * Normalize email subject — strip Re:/Fwd:/Fw: prefixes for comparison.
 */
export function normalizeSubject(subject: string): string {
  return subject
    .replace(/^(re|fwd?|răspuns)\s*:\s*/gi, '')
    .replace(/^(re|fwd?|răspuns)\s*:\s*/gi, '') // Handle nested Re: Re:
    .trim()
    .toLowerCase();
}

/**
 * Extract raw email address from RFC 5322 format.
 * "Ion Popescu <ion@domain.ro>" → "ion@domain.ro"
 */
export function extractEmailAddr(raw: string): string {
  const match = raw.match(/<([^>]+)>/);
  return (match ? match[1] : raw).trim().toLowerCase();
}

export interface MatchResult {
  requestId: string;
  strategy: 'thread' | 'registration' | 'context';
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Match an email to an existing request using 3-tier strategy.
 *
 * @param email - The received email record from DB
 * @param analysis - The AI analysis result
 * @returns MatchResult or null if no match found
 */
export async function matchEmailToRequest(
  email: {
    id: string;
    user_id: string;
    parent_email_id: string | null;
    from_email: string;
    subject: string;
  },
  analysis: AnalysisResult,
): Promise<MatchResult | null> {
  const supabase = getServiceClient();

  // ═══ STRATEGY 1: Thread Matching ═══
  if (email.parent_email_id) {
    const { data: parentEmail } = await supabase
      .from('emails')
      .select('request_id')
      .eq('id', email.parent_email_id)
      .single();

    if (parentEmail?.request_id) {
      console.log(`[Match] Thread: found request ${parentEmail.request_id} via parent email`);
      return {
        requestId: parentEmail.request_id,
        strategy: 'thread',
        confidence: 'high',
      };
    }
  }

  // ═══ STRATEGY 2: Registration Number Matching ═══
  if (analysis.registration_number) {
    const reg = analysis.registration_number;

    // 2a. Exact match
    const { data: exactMatch } = await supabase
      .from('requests')
      .select('id')
      .eq('user_id', email.user_id)
      .eq('registration_number', reg)
      .limit(1);

    if (exactMatch && exactMatch.length > 0) {
      console.log(`[Match] Registration exact: found request ${exactMatch[0].id}`);
      return {
        requestId: exactMatch[0].id,
        strategy: 'registration',
        confidence: 'high',
      };
    }

    // 2b. Fuzzy + core match
    const { data: candidates } = await supabase
      .from('requests')
      .select('id, registration_number')
      .eq('user_id', email.user_id)
      .not('registration_number', 'is', null);

    if (candidates) {
      // 2b-i. Substring match
      for (const cand of candidates) {
        if (!cand.registration_number) continue;
        if (
          cand.registration_number.includes(reg) ||
          reg.includes(cand.registration_number)
        ) {
          console.log(`[Match] Registration fuzzy: found request ${cand.id}`);
          return {
            requestId: cand.id,
            strategy: 'registration',
            confidence: 'medium',
          };
        }
      }

      // 2b-ii. Core numeric match — same base number, different dates
      // e.g. DB: "29702/14.11.2025", extracted: "29702/22.11.2025" → core "29702" matches
      const extractedCore = extractRegNumberCore(reg);
      if (extractedCore) {
        for (const cand of candidates) {
          if (!cand.registration_number) continue;
          const candCore = extractRegNumberCore(cand.registration_number);
          if (candCore && candCore === extractedCore) {
            console.log(`[Match] Registration core: found request ${cand.id} (core: ${extractedCore})`);
            return {
              requestId: cand.id,
              strategy: 'registration',
              confidence: 'high',
            };
          }
        }
      }
    }
  }

  // ═══ STRATEGY 3: Context Matching ═══
  const normalizedSubject = normalizeSubject(email.subject);
  const senderEmail = extractEmailAddr(email.from_email);

  // Get user's pending/active requests
  const { data: activeRequests } = await supabase
    .from('requests')
    .select('id, subject, institution_name, institution_email')
    .eq('user_id', email.user_id)
    .not('status', 'eq', 'answered')
    .order('date_initiated', { ascending: false });

  if (activeRequests) {
    for (const req of activeRequests) {
      // 3a. Subject match
      const reqSubjectNorm = normalizeSubject(req.subject || '');
      if (normalizedSubject && reqSubjectNorm && normalizedSubject === reqSubjectNorm) {
        console.log(`[Match] Context (subject): found request ${req.id}`);
        return {
          requestId: req.id,
          strategy: 'context',
          confidence: 'medium',
        };
      }

      // 3b. Institution email match — sender is the institution we sent to
      if (req.institution_email && senderEmail) {
        const reqInstEmail = extractEmailAddr(req.institution_email);
        if (senderEmail === reqInstEmail) {
          console.log(`[Match] Context (institution email): found request ${req.id}`);
          return {
            requestId: req.id,
            strategy: 'context',
            confidence: 'medium',
          };
        }
      }

      // 3c. Check if user sent an email to this sender's address, linked to this request
      const { data: sentMatch } = await supabase
        .from('emails')
        .select('id')
        .eq('request_id', req.id)
        .eq('type', 'sent')
        .ilike('to_email', `%${senderEmail}%`)
        .limit(1);

      if (sentMatch && sentMatch.length > 0) {
        console.log(`[Match] Context (sent-to match): found request ${req.id}`);
        return {
          requestId: req.id,
          strategy: 'context',
          confidence: 'medium',
        };
      }
    }
  }

  // No match found
  console.log(`[Match] No match found for email ${email.id}`);
  return null;
}

/**
 * Auto-heal: if a request was matched but doesn't have a registration number,
 * and the analysis extracted one, set it on the request.
 */
export async function autoHealRegistrationNumber(
  requestId: string,
  registrationNumber: string,
): Promise<void> {
  const supabase = getServiceClient();

  const { data: request } = await supabase
    .from('requests')
    .select('registration_number')
    .eq('id', requestId)
    .single();

  if (request && !request.registration_number) {
    console.log(`[AutoHeal] Setting registration number ${registrationNumber} on request ${requestId}`);
    await supabase
      .from('requests')
      .update({ registration_number: registrationNumber })
      .eq('id', requestId);
  }
}
