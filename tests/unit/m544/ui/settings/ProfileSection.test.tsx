// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import ProfileSection from '@m544/ui/settings/ProfileSection';

afterEach(cleanup);

describe('ProfileSection — forma de adresare', () => {
  it('arată genul salvat şi raportează alegerea nouă', () => {
    const onGenderChange = vi.fn();
    render(
      <ProfileSection
        displayName="Ion"
        onDisplayNameChange={() => {}}
        gender="m"
        onGenderChange={onGenderChange}
        email="ion@example.com"
      />,
    );
    const select = screen.getByLabelText('Formă de adresare') as HTMLSelectElement;
    expect(select.value).toBe('m');
    fireEvent.change(select, { target: { value: 'f' } });
    expect(onGenderChange).toHaveBeenCalledWith('f');
  });
});
