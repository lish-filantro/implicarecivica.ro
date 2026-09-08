// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AnswerRenderer } from '@m544/ui/dashboard/AnswerRenderer';

describe('AnswerRenderer', () => {
  it('shows a placeholder without a summary', () => {
    render(<AnswerRenderer summary={undefined} />);
    expect(screen.getByText('Nu există rezumat disponibil')).toBeTruthy();
  });

  it('renders the text format as a paragraph', () => {
    render(<AnswerRenderer summary={{ type: 'text', content: 'Bugetul este 10 lei.' }} />);
    expect(screen.getByText('Bugetul este 10 lei.').tagName).toBe('P');
  });

  it('renders the list format as bullets', () => {
    render(<AnswerRenderer summary={{ type: 'list', content: ['Prima', 'A doua'] }} />);
    expect(screen.getByText('Prima')).toBeTruthy();
    expect(screen.getByText('A doua')).toBeTruthy();
  });

  it('renders the table format with headers and cells', () => {
    const { container } = render(
      <AnswerRenderer
        summary={{ type: 'table', headers: ['An', 'Suma'], rows: [['2024', '10'], ['2025', '20']] }}
      />,
    );
    expect(screen.getByText('An')).toBeTruthy();
    expect(screen.getByText('20')).toBeTruthy();
    const grid = container.querySelector('.grid') as HTMLElement;
    expect(grid.style.gridTemplateColumns).toBe('repeat(2, minmax(0, 1fr))');
  });

  it('renders a legacy single-line string as a paragraph', () => {
    render(<AnswerRenderer summary="Un singur rând" />);
    expect(screen.getByText('Un singur rând').tagName).toBe('P');
  });

  it('splits a legacy string on ; and newlines into bullets', () => {
    render(<AnswerRenderer summary={'primul; al doilea\nal treilea'} />);
    expect(screen.getByText('primul')).toBeTruthy();
    expect(screen.getByText('al doilea')).toBeTruthy();
    expect(screen.getByText('al treilea')).toBeTruthy();
  });
});
