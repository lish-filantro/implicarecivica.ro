// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { CazuriUtilizare } from '@/components/public/institutie/CazuriUtilizare';
import { getAllInstitutii } from '@/lib/institutii';

afterEach(cleanup);

const inst = getAllInstitutii().find((i) => !i.is_template && i.nume_scurt && i.cazuri_utilizare_544.length >= 2)!;

describe('CazuriUtilizare', () => {
  it('renders one card per use case under the institution heading', () => {
    render(<CazuriUtilizare inst={inst} />);
    expect(screen.getByText(`Ce poți cere de la ${inst.nume_scurt}`)).toBeTruthy();
    for (const caz of inst.cazuri_utilizare_544) expect(screen.getByText(caz)).toBeTruthy();
  });

  it('renders nothing without use cases', () => {
    const { container } = render(<CazuriUtilizare inst={{ ...inst, cazuri_utilizare_544: [] }} />);
    expect(container.innerHTML).toBe('');
  });
});
