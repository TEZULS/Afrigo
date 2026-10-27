/**
 * Thème Android compatible Material Components (2026-10-27).
 *
 * Le formulaire de carte Stripe affiché dans la page de validation
 * (`CardForm`) est construit avec des composants Material (MaterialCardView,
 * TextInputLayout) : avec le thème AppCompat du modèle Expo, Android ferme
 * l'app dès l'affichage du formulaire (« requires your app theme to be
 * Theme.MaterialComponents »). On passe le thème de l'app à sa variante
 * « Bridge » : le reste de l'app garde ses styles AppCompat, Stripe trouve
 * les attributs Material dont il a besoin.
 */
const { withAndroidStyles } = require('expo/config-plugins');

/** Thèmes AppCompat possibles du modèle Expo → leur équivalent Material « Bridge ». */
const BRIDGES = {
  'Theme.AppCompat.DayNight.NoActionBar': 'Theme.MaterialComponents.DayNight.NoActionBar.Bridge',
  'Theme.AppCompat.Light.NoActionBar': 'Theme.MaterialComponents.Light.NoActionBar.Bridge',
  'Theme.AppCompat.NoActionBar': 'Theme.MaterialComponents.NoActionBar.Bridge',
};

/** styles.xml (lu par Expo) → `AppTheme` hérite d'un thème Material. */
const setMaterialThemeParent = (styles) => {
  const appTheme = (styles.resources.style ?? []).find((s) => s.$ && s.$.name === 'AppTheme');
  if (!appTheme) throw new Error('withMaterialComponentsTheme : style AppTheme introuvable dans styles.xml');
  const parent = appTheme.$.parent ?? '';
  if (parent.startsWith('Theme.MaterialComponents') || parent.startsWith('Theme.Material3')) return styles;
  const bridge = BRIDGES[parent];
  // Modèle Expo modifié : mieux vaut un build en échec qu'une app qui se ferme au paiement.
  if (!bridge) throw new Error(`withMaterialComponentsTheme : thème parent inattendu « ${parent} »`);
  appTheme.$.parent = bridge;
  return styles;
};

const withMaterialComponentsTheme = (config) =>
  withAndroidStyles(config, (cfg) => {
    cfg.modResults = setMaterialThemeParent(cfg.modResults);
    return cfg;
  });

module.exports = withMaterialComponentsTheme;
module.exports.setMaterialThemeParent = setMaterialThemeParent;
