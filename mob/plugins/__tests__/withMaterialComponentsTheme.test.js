const { setMaterialThemeParent } = require('../withMaterialComponentsTheme');

/** styles.xml du modèle Expo SDK 55, tel que lu par `withAndroidStyles`. */
const template = () => ({
  resources: {
    style: [
      {
        $: { name: 'AppTheme', parent: 'Theme.AppCompat.DayNight.NoActionBar' },
        item: [
          { _: '@drawable/rn_edit_text_material', $: { name: 'android:editTextBackground' } },
          { _: '@color/colorPrimary', $: { name: 'colorPrimary' } },
        ],
      },
      {
        $: { name: 'Theme.App.SplashScreen', parent: 'Theme.SplashScreen' },
        item: [{ _: '@style/AppTheme', $: { name: 'postSplashScreenTheme' } }],
      },
    ],
  },
});

const appTheme = (styles) => styles.resources.style.find((s) => s.$.name === 'AppTheme');

describe('withMaterialComponentsTheme — formulaire de carte Stripe sur Android', () => {
  it('passe AppTheme à la variante Material « Bridge », sans toucher à ses réglages', () => {
    const out = setMaterialThemeParent(template());
    expect(appTheme(out).$.parent).toBe('Theme.MaterialComponents.DayNight.NoActionBar.Bridge');
    expect(appTheme(out).item).toEqual(appTheme(template()).item);
    // L'écran de démarrage garde son thème.
    expect(out.resources.style[1]).toEqual(template().resources.style[1]);
  });

  it('appliqué une seule fois, même si le build relance la configuration', () => {
    const once = setMaterialThemeParent(template());
    expect(appTheme(setMaterialThemeParent(once)).$.parent).toBe(
      'Theme.MaterialComponents.DayNight.NoActionBar.Bridge',
    );
  });

  it('thème parent inconnu : erreur claire plutôt qu’une app qui se ferme au paiement', () => {
    const styles = template();
    appTheme(styles).$.parent = 'Theme.EdgeToEdge';
    expect(() => setMaterialThemeParent(styles)).toThrow(/Theme.EdgeToEdge/);
  });
});
