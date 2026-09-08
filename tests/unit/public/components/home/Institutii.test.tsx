// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { Institutii } from '@/components/public/home/Institutii';

afterEach(cleanup);

describe('Institutii (home teaser)', () => {
  it('links to the institutions explorer', () => {
    render(<Institutii />);
    expect(screen.getByText('Instituții publice')).toBeTruthy();
    expect(screen.getByRole('link', { name: /Explorează instituțiile/ }).getAttribute('href')).toBe('/institutii');
  });
});
