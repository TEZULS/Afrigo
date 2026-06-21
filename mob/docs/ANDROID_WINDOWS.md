# Build Android sous Windows — JDK et Gradle

## Erreur : « No Java compiler found »

`expo run:android` lance Gradle, qui **exige un JDK** (avec `javac`), pas une simple **JRE** Java 8.

Pour **React Native / Expo SDK 52**, utilise un **JDK 17** ou **JDK 21** recommandés par Gradle et la toolchain React Native.

## 1. Installer un JDK

Avec Winget :

```powershell
winget install --id EclipseAdoptium.Temurin.17.JDK -e --accept-source-agreements --accept-package-agreements
```

Ou télécharge depuis [Adoptium Temurin 17](https://adoptium.net/temurin/releases/?version=17).

## 2. Définir `JAVA_HOME` (obligatoire)

Le dossier attendu après installation :

`C:\Program Files\Eclipse Adoptium\jdk-17.<version>-hotspot`

### Méthode A — Permanent (recommandé)

1. Touche Windows → **Variables d’environnement** → **Modifier les variables d’environnement système**.
2. **Variables d’environnement…** → **Nouvelle** (utilisateur ou système) :
   - Nom : `JAVA_HOME`
   - Valeur : `C:\Program Files\Eclipse Adoptium\jdk-17.0.18.8-hotspot` (adapte le numéro de version si différent).
3. Éditer la variable `Path` → **Nouvelle** ligne : `%JAVA_HOME%\bin`.
4. Ferme **tous** les terminaux et rouvre Git Bash ou PowerShell.

Vérification :

```bash
java -version
# doit afficher openjdk version "17..." (Temurin)
javac -version
# doit fonctionner sans erreur
echo $JAVA_HOME   # Git Bash ou : echo %JAVA_HOME% sous cmd
```

### Méthode B — Pour une session Git Bash uniquement

```bash
export JAVA_HOME="/c/Program Files/Eclipse Adoptium/jdk-17.0.18.8-hotspot"
export PATH="$JAVA_HOME/bin:$PATH"
cd mob
npm run android
```

(Adapte le nom exact du dossier `jdk-17.*` après installation.)

### Méthode C — Une commande depuis la racine du projet mobile

```bash
JAVA_HOME="$(ls -d '/c/Program Files/Eclipse Adoptium/'jdk-* 2>/dev/null | tail -1)" PATH="$JAVA_HOME/bin:$PATH" npm run android
```

## Erreur : « SDK location not found » / `Define a valid SDK location with ANDROID_HOME`

Gradle ne trouve pas le **Android SDK** (ce n’est pas le JDK). Il faut :

1. Installer **[Android Studio](https://developer.android.com/studio)**.
2. Au premier lancement, laisser l’assistant télécharger le **Android SDK**.
3. Ouvrir **More Actions → SDK Manager** (ou **File → Settings → Languages & Frameworks → Android SDK**) et noter **Android SDK Location**, en général :
   - `C:\Users\<ton_compte>\AppData\Local\Android\Sdk`

Ensuite, **au choix** :

- Définir la variable d’environnement **`ANDROID_HOME`** (ou `ANDROID_SDK_ROOT`) sur ce chemin exact, puis rouvrir le terminal ; **ou**
- Lancer **`npm run android:winjdk`** : le script détecte souvent ce chemin par défaut, définit `ANDROID_HOME` pour la commande et crée / met à jour **`android/local.properties`** avec `sdk.dir=...` (recommandé par Gradle).

Vérification rapide : le dossier SDK doit contenir au moins `platform-tools`, `platforms` et `build-tools`.

## 3. Android SDK (résumé)

**Android Studio** installe le SDK. Sans ce SDK, `expo run:android` échoue même si le JDK est correct.

Emplacement typique sous Windows :

- `%LOCALAPPDATA%\Android\Sdk`  
  → souvent `C:\Users\<toi>\AppData\Local\Android\Sdk`

Dans Android Studio : **Settings** → **Android SDK** → **Android SDK Location**.

## 4. Après ces réglages

```bash
cd mob
npm run android:winjdk   # Windows : JDK + SDK + local.properties
# ou, si JAVA_HOME et ANDROID_HOME sont déjà définis dans Windows :
npm run android
```

La première compilation peut prendre plusieurs minutes (téléchargement Gradle, caches).

---

## Erreur : `ninja: error: mkdir(... C_/Users/.../react-native-reanimated): No such file or directory`

Sous Windows, **CMake + Ninja** (utilisés par **react-native-reanimated**, surtout avec la **New Architecture**) produisent des chemins d’objets très longs dans **`.cxx`**. À partir d’un dossier façon **`C:\Users\…\Desktop\…\mob`** on dépasse souvent la limite **`CMAKE_OBJECT_PATH_MAX` (~250)** ou **`MAX_PATH` (~260)**, ce qui fait échouer **`mkdir`** dans Ninja (`C_/Users/…` correspond au lecteur **`C:`** encodé pour les dossiers de build).

**Pourquoi `SUBST` ne suffit en général pas**  
Même avec une lettre **`Z:`** mappée sur le dossier projet, Gradle/Expo peuvent très bien être lancés depuis **`Z:\`**. En revanche CMake enregistre en pratique le **chemin canonique réel** (souvent toujours **`C:\Users\…\Desktop\…`** dans les règles Ninja). Une lettre **`SUBST` ne remplace pas** ce chemin : l’erreur ci-dessus peut donc persister tant que ton **chemins projet réel reste trop long**.

```bash
npm run android:clean-native   # conseillé après un changement (registre, déplacement du dossier)
```

### Solution recommandée A — Chemins longs Windows (sans déplacer le projet)

À faire **une fois** (admin puis redémarrage) :

```powershell
New-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem" `
  -Name "LongPathsEnabled" -Value 1 -PropertyType DWORD -Force
```

Vérifier (PowerShell ou **cmd**) :

```cmd
reg query HKLM\SYSTEM\CurrentControlSet\Control\FileSystem /v LongPathsEnabled
```

`0x1` = activé. Le script **`android:winjdk`** affiche aussi une alerte si cette valeur est `0`.

Ensuite **redémarre** le PC ; depuis **`mob/`** :

```bash
npm run android:clean-native
npm run android:winjdk
```

### Solution recommandée B — Préfixe court **physique** (`C:\dev\mob`)

Si un chemin façon **`…\Desktop\…\mob`** reste trop long pour Ninja, **copie ou clone** à nouveau **`mob/`** tout près du lecteur :

- `C:\mob` ou `C:\dev\mob` (uniquement trois segments après `C:\`)

Une simple **jonction** vers `Desktop` n’aide pas : Node / Gradle / CMake résolvent en général le **chemin cible réel**, qui reste long.

Travaille **uniquement** depuis ce dossier pour **`npm install`**, **`npm run android:clean-native`** et **`npm run android:winjdk`**.

### Option expérimentale — `SUBST` manuel depuis le script

Si tu veux quand même tenter **`SUBST`** depuis le launcher (souvent insuffisant pour Reanimated) :

```bash
set AFRI_ANDROID_SUBST=1
npm run android:winjdk
```

Diagnostic par lettre : **`AFRI_ANDROID_SUBST_DEBUG=1`** (Git Bash : **`export`** avant la commande).

### Nettoyage

Après **LongPaths**, **changement de chemin**, ou mise à jour Gradle/NDK :

```bash
npm run android:clean-native
npm run android:winjdk
```

Les avertissements **`maximum full path to an object file is 250`** vont avec le même problème ; **`LongPaths`** ou un dossier projet **court** les corrigent en pratique.
