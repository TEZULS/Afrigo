# Assets graphiques

Les fichiers `icon.png`, `splash.png`, `adaptive-icon.png`, `notification-icon.png`
sont des placeholders à remplacer avant la première build TestFlight / Play Console.

Spécifications :

| Fichier                  | Format | Dimension recommandée  | Usage                                   |
| ------------------------ | ------ | ---------------------- | --------------------------------------- |
| `icon.png`               | PNG    | 1024 × 1024 (sans alpha) | Icône iOS + Android                     |
| `adaptive-icon.png`      | PNG    | 1024 × 1024 (logo seul) | Foreground icône adaptative Android     |
| `splash.png`             | PNG    | 1242 × 2436            | Splash Android + iOS (`resizeMode: contain`) |
| `notification-icon.png`  | PNG    | 96 × 96 monochrome     | Icône notification push Android         |

Charte AfriGo :

- Couleur principale : **#F97316** (orange)
- Couleur secondaire : **#008000** (vert)
- Fond splash : **#FFFFFF**

Pour générer les variantes Android adaptatives automatiquement :

```bash
npx expo install @expo/configure-splash-screen
npx expo configure
```
