/**
 * requests/export-csv — pure CSV rendering of a session (BOM, quoting, dates,
 * answer flattening) and the download file name.
 */
import { describe, it, expect } from 'vitest';
import { sessionToCsv, csvFilename, CSV_HEADERS } from '@m544/requests/export-csv';
import type { RequestSessionWithRequests } from '@m544/shared/types/session';
import type { Request } from '@m544/shared/types/request';

const local = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).toISOString();
const NOW = new Date(2026, 8, 8, 10);
const BOM = '\uFEFF';
const HEADER = 'Instituție,Subiect,Întrebare,Status,Nr. înregistrare,Data trimiterii,Data primirii,Termen limită,Zile rămase,Răspuns';

const request = (partial: Partial<Request> = {}): Request => ({
  id: 'r1',
  user_id: 'u1',
  institution_name: 'Primăria Pitești',
  subject: 'Cerere informații publice - Legea 544/2001',
  status: 'received',
  date_initiated: local(2026, 9, 1),
  created_at: local(2026, 9, 1),
  updated_at: local(2026, 9, 1),
  ...partial,
});

const session = (requests: Request[]): RequestSessionWithRequests => ({
  id: 's1',
  user_id: 'u1',
  subject: 'Cerere informații publice - Legea 544/2001',
  institution_name: 'Primăria Pitești',
  cached_status: 'in_progress',
  total_requests: requests.length,
  answered_requests: 0,
  created_at: local(2026, 9, 1),
  updated_at: local(2026, 9, 1),
  requests,
});

describe('sessionToCsv', () => {
  it('starts with the UTF-8 BOM and the header; rows are CRLF separated', () => {
    const csv = sessionToCsv(session([]), NOW);
    expect(csv).toBe(BOM + HEADER);
    expect(CSV_HEADERS).toHaveLength(10);
    expect(sessionToCsv(session([request(), request()]), NOW).split('\r\n')).toHaveLength(3);
  });

  it('renders a full row: quoting, ro-RO dates, days left, list answers', () => {
    const csv = sessionToCsv(
      session([
        request({
          subject: 'Cerere, cu virgulă',
          request_body: 'Câte autorizații "de construire" ați emis?',
          registration_number: '1234/01.09.2026',
          date_sent: local(2026, 9, 1),
          date_received: local(2026, 9, 2),
          deadline_date: local(2026, 9, 11),
          answer_summary: { type: 'list', content: ['a', 'b'] },
        }),
      ]),
      NOW,
    );
    expect(csv.split('\r\n')[1]).toBe(
      'Primăria Pitești,"Cerere, cu virgulă","Câte autorizații ""de construire"" ați emis?",Înregistrată,1234/01.09.2026,01.09.2026,02.09.2026,11.09.2026,3,a; b',
    );
  });

  it('uses extension_date as the deadline and response_received_date as fallback receipt date', () => {
    const row = sessionToCsv(
      session([
        request({
          status: 'extension',
          deadline_date: local(2026, 9, 11),
          extension_date: local(2026, 10, 11),
          response_received_date: local(2026, 9, 5),
        }),
      ]),
      NOW,
    ).split('\r\n')[1];
    const cols = row.split(',');
    expect(cols[3]).toBe('Prelungită');
    expect(cols[6]).toBe('05.09.2026');
    expect(cols[7]).toBe('11.10.2026');
    expect(cols[8]).toBe('33');
  });

  it('flattens text, table and legacy string answers; empty fields stay empty', () => {
    const rows = sessionToCsv(
      session([
        request({ answer_summary: { type: 'text', content: 'Da' } }),
        request({ answer_summary: { type: 'table', headers: ['h'], rows: [['1', '2'], ['3']] } }),
        request({ answer_summary: 'item1; item2' }),
        request(),
      ]),
      NOW,
    ).split('\r\n');
    expect(rows[1].endsWith(',Da')).toBe(true);
    expect(rows[2].endsWith(',1 | 2; 3')).toBe(true);
    expect(rows[3].endsWith(',item1; item2')).toBe(true);
    expect(rows[4]).toBe('Primăria Pitești,Cerere informații publice - Legea 544/2001,,Înregistrată,,,,,,');
  });

  it('quotes fields containing newlines', () => {
    const row = sessionToCsv(session([request({ answer_summary: 'linia 1\nlinia 2' })]), NOW).split('\r\n');
    // a bare LF inside a quoted field does not split CRLF rows
    expect(row[1].endsWith(',"linia 1\nlinia 2"')).toBe(true);
  });
});

describe('csvFilename', () => {
  it('slugifies the institution (keeping diacritics) and appends the date', () => {
    expect(csvFilename(session([]), NOW)).toBe('sesiune-primăria-pitești-2026-09-08.csv');
    const s = session([]);
    s.institution_name = 'S.C. "Apă & Canal" Târgu-Jiu SA cu un nume foarte lung care depășește limita';
    const name = csvFilename(s, NOW);
    expect(name.startsWith('sesiune-sc-apă-canal-târgu-jiu-sa-cu-un-nume')).toBe(true);
    expect(name.length).toBeLessThanOrEqual('sesiune-'.length + 40 + '-2026-09-08.csv'.length);
  });
});
