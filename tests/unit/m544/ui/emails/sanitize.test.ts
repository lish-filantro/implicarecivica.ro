import { describe, it, expect } from 'vitest';
import { sanitizeEmailHtml } from '@m544/ui/emails/sanitize';

describe('sanitizeEmailHtml', () => {
  it('strips script blocks including their content', () => {
    expect(sanitizeEmailHtml('<p>a</p><script>alert(1)</script><p>b</p>')).toBe('<p>a</p><p>b</p>');
  });

  it('strips style, iframe and form blocks', () => {
    expect(sanitizeEmailHtml('<style>p{color:red}</style><p>x</p>')).toBe('<p>x</p>');
    expect(sanitizeEmailHtml('<iframe src="http://evil"></iframe><p>x</p>')).toBe('<p>x</p>');
    expect(sanitizeEmailHtml('<form action="/steal"><input name="a" /></form><p>x</p>')).toBe('<p>x</p>');
  });

  it('strips on* event handlers with double or single quotes', () => {
    expect(sanitizeEmailHtml('<a href="#" onclick="hack()">x</a>')).toBe('<a href="#" >x</a>');
    expect(sanitizeEmailHtml("<img src='a.png' onerror='hack()' />")).toBe("<img src='a.png'  />");
  });

  it('is case-insensitive', () => {
    expect(sanitizeEmailHtml('<SCRIPT>1</SCRIPT><div ONLOAD="x()">ok</div>')).toBe('<div >ok</div>');
  });

  it('leaves ordinary markup untouched', () => {
    const html = '<p>Bună <strong>ziua</strong>,<br/>text</p>';
    expect(sanitizeEmailHtml(html)).toBe(html);
  });
});
