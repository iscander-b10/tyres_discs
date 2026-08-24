import { isIkonBrand } from './isIkonBrand';

describe('isIkonBrand', () => {
  test('принимает бренд Ikon', () => {
    expect(isIkonBrand({ brand: 'Ikon', title: 'Character Eco 91H' })).toBe(
      true
    );
  });

  test('нормализует Ikon Tyres', () => {
    expect(isIkonBrand({ brand: 'Ikon Tyres', title: 'Autograph Eco 3 91V' })).toBe(
      true
    );
    expect(isIkonBrand({ brand: 'IKON TYRES', title: 'Autograph Aqua 3' })).toBe(
      true
    );
  });

  test('fallback по title, если brand пустой или чужой', () => {
    expect(isIkonBrand({ brand: '', title: 'Ikon Character Eco 91H' })).toBe(
      true
    );
    expect(isIkonBrand({ title: 'Ikon Tyres Autograph Eco 3 91V' })).toBe(true);
  });

  test('отсекает не-Ikon', () => {
    expect(isIkonBrand(null)).toBe(false);
    expect(
      isIkonBrand({ brand: 'Michelin', title: 'Michelin Primacy 4 91V' })
    ).toBe(false);
    expect(isIkonBrand({ brand: 'Ikonova', title: 'Ikonova Winter 95T' })).toBe(
      false
    );
  });
});
