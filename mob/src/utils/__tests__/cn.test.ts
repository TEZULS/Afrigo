import { cn } from '../cn';

describe('cn (clsx + tailwind-merge)', () => {
  it("concatène les classes simples", () => {
    expect(cn('a', 'b')).toBe('a b');
  });

  it('ignore les valeurs falsy', () => {
    expect(cn('a', false, undefined, null, '', 'b')).toBe('a b');
  });

  it('résout les conflits Tailwind (le dernier gagne)', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
  });

  it('supporte les objets conditionnels', () => {
    expect(cn('a', { b: true, c: false })).toContain('a');
    expect(cn('a', { b: true, c: false })).toContain('b');
    expect(cn('a', { b: true, c: false })).not.toContain('c');
  });
});
