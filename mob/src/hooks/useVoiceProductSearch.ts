import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Linking, Platform } from 'react-native';
import type {
  ExpoSpeechRecognitionErrorEvent,
  ExpoSpeechRecognitionResultEvent,
} from 'expo-speech-recognition';
import { useToast } from '@/hooks/useToast';

type SpeechModule = typeof import('expo-speech-recognition').ExpoSpeechRecognitionModule;
type Subscription = { remove: () => void };

/**
 * Durées d'écoute (2026-10-03 : la dictée se coupait à la première hésitation).
 * La reconnaissance tourne en continu et c'est l'app qui l'arrête : après
 * `SILENCE_MS` sans nouveau mot, ou `NO_SPEECH_MS` si le client n'a rien dit.
 */
export const SILENCE_MS = 2000;
export const NO_SPEECH_MS = 8000;

/**
 * Module natif chargé à la demande : un binaire antérieur à son ajout (ou
 * Jest) n'a pas `ExpoSpeechRecognition`, et l'import direct planterait l'écran.
 */
const loadSpeechModule = (): SpeechModule | null => {
  try {
    return (require('expo-speech-recognition') as typeof import('expo-speech-recognition'))
      .ExpoSpeechRecognitionModule;
  } catch {
    return null;
  }
};

/**
 * Moteurs de reconnaissance Google en ligne (Android), par ordre de préférence :
 * « Speech Recognition & Synthesis » (Android 13+), puis l'app Google (≤ 12).
 * `com.google.android.as` (reconnaissance sur l'appareil) est écarté : sans le
 * pack français téléchargé, il s'arrête aussitôt sans rien entendre.
 */
const GOOGLE_RECOGNIZERS = ['com.google.android.tts', 'com.google.android.googlequicksearchbox'];

/**
 * Moteur à imposer sur Android, `undefined` pour garder celui du téléphone :
 * rien ne change quand le moteur par défaut est déjà un moteur Google en ligne ;
 * sinon (Samsung, reconnaissance sur l'appareil, aucun) un moteur Google installé.
 */
export const pickAndroidRecognizer = (defaultService: string, services: string[]): string | undefined =>
  GOOGLE_RECOGNIZERS.includes(defaultService) ? undefined : GOOGLE_RECOGNIZERS.find((p) => services.includes(p));

/** Message clair pour chaque erreur de dictée (le code aide au diagnostic). */
export const voiceErrorMessage = (code: string): { title: string; message: string; openSettings?: boolean } => {
  switch (code) {
    case 'not-allowed':
      return {
        title: 'Micro non autorisé',
        message:
          Platform.OS === 'android'
            ? 'Autorisez le micro : Réglages du téléphone → Applications → AfriGo → Autorisations → Micro.'
            : 'Autorisez le micro et la reconnaissance vocale dans les réglages.',
        openSettings: true,
      };
    case 'service-not-allowed':
      return {
        title: 'Reconnaissance vocale indisponible',
        message:
          Platform.OS === 'android'
            ? 'La reconnaissance vocale de Google est absente, désactivée ou n’a pas accès au micro. Installez ou mettez à jour « Services vocaux de Google » depuis le Play Store, puis réessayez.'
            : 'La dictée est désactivée : Réglages → Général → Clavier → Activer la dictée.',
      };
    case 'language-not-supported':
      return { title: 'Français indisponible', message: 'La reconnaissance vocale de ce téléphone ne propose pas le français.' };
    case 'network':
      return { title: 'Pas de connexion', message: 'La recherche vocale a besoin d’internet. Vérifiez votre connexion.' };
    case 'busy':
    case 'audio-capture':
      return { title: 'Micro occupé', message: 'Le micro est utilisé par une autre application. Réessayez dans un instant.' };
    default:
      return {
        title: 'Recherche vocale',
        message: `La dictée n’a pas fonctionné (${code || 'erreur'}). Réessayez ou tapez le nom du produit.`,
      };
  }
};

/** « Nutella. » → « Nutella » : la dictée ajoute parfois une ponctuation finale. */
export const cleanTranscript = (text: string) =>
  text.replace(/[.,;:!?…]+/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * Recherche vocale (demande du 2026-10-01, remplace la recherche par photo) :
 * le client appuie sur le micro, dit le nom du produit, et le texte reconnu
 * part dans la recherche par titre. `transcript` donne la dictée en direct
 * (affichée dans la fenêtre « Parlez »), `onDetected` reçoit la phrase finale
 * et doit être mémoïsé. `hints` (titres du catalogue) aide iOS à reconnaître
 * les noms de marque.
 */
export function useVoiceProductSearch(onDetected: (text: string) => void, hints: string[] = []) {
  const toast = useToast();
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const subs = useRef<Subscription[]>([]);
  const lastText = useRef('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const detach = useCallback(() => {
    clearTimer();
    subs.current.forEach((s) => s.remove());
    subs.current = [];
  }, [clearTimer]);

  /** (Re)lance le compte à rebours au bout duquel l'écoute s'arrête d'elle-même. */
  const armTimer = useCallback(
    (ms: number) => {
      clearTimer();
      timer.current = setTimeout(() => loadSpeechModule()?.stop(), ms);
    },
    [clearTimer],
  );

  useEffect(
    () => () => {
      if (subs.current.length) loadSpeechModule()?.abort();
      detach();
    },
    [detach],
  );

  /** Bouton « Arrêter » : garde ce qui a déjà été dit et lance la recherche. */
  const stopVoiceSearch = useCallback(() => {
    clearTimer();
    loadSpeechModule()?.stop();
  }, [clearTimer]);

  /** Fermeture sans chercher. */
  const cancelVoiceSearch = useCallback(() => {
    lastText.current = '';
    clearTimer();
    loadSpeechModule()?.abort();
  }, [clearTimer]);

  const startVoiceSearch = useCallback(async () => {
    const speech = loadSpeechModule();
    if (listening) {
      stopVoiceSearch();
      return;
    }
    if (!speech) {
      Alert.alert(
        'Recherche vocale indisponible',
        'Mettez AfriGo à jour depuis l’App Store pour rechercher un produit à la voix.',
      );
      return;
    }

    // Permission : demandée seulement si le système le permet encore, sinon
    // renvoi vers les réglages (Android n'affiche plus la demande après deux refus).
    let perm = await speech.getPermissionsAsync();
    if (!perm.granted && perm.canAskAgain !== false) perm = await speech.requestPermissionsAsync();
    if (!perm.granted) {
      const { title, message } = voiceErrorMessage('not-allowed');
      Alert.alert(title, message, [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Ouvrir les réglages', onPress: () => void Linking.openSettings() },
      ]);
      return;
    }
    // Service de reconnaissance absent ou désactivé (Android sans Google, dictée iOS coupée).
    if (speech.isRecognitionAvailable?.() === false) {
      const { title, message } = voiceErrorMessage('service-not-allowed');
      Alert.alert(title, message);
      return;
    }
    // Android : un moteur Google en ligne quand celui du téléphone n'en est pas
    // un (celui du fabricant gère mal le français sur certains téléphones).
    let androidService: string | undefined;
    if (Platform.OS === 'android') {
      try {
        androidService = pickAndroidRecognizer(
          speech.getDefaultRecognitionService?.().packageName ?? '',
          speech.getSpeechRecognitionServices?.() ?? [],
        );
      } catch {
        androidService = undefined;
      }
    }

    detach();
    lastText.current = '';
    setTranscript('');
    subs.current = [
      speech.addListener('result', (e: ExpoSpeechRecognitionResultEvent) => {
        const text = cleanTranscript(e.results[0]?.transcript ?? '');
        if (!text) return;
        lastText.current = text;
        setTranscript(text);
        armTimer(SILENCE_MS);
      }),
      speech.addListener('error', (e: ExpoSpeechRecognitionErrorEvent) => {
        if (e.error === 'aborted') return;
        if (e.error === 'no-speech' || e.error === 'speech-timeout') {
          if (!lastText.current) {
            toast.info('Aucun mot entendu', 'Appuyez sur le micro puis dites le nom du produit.');
          }
          return;
        }
        const { title, message, openSettings } = voiceErrorMessage(e.error);
        if (openSettings) {
          Alert.alert(title, message, [
            { text: 'Annuler', style: 'cancel' },
            { text: 'Ouvrir les réglages', onPress: () => void Linking.openSettings() },
          ]);
        } else {
          toast.error(title, message);
        }
      }),
      speech.addListener('end', () => {
        setListening(false);
        detach();
        if (lastText.current) onDetected(lastText.current);
      }),
    ];

    setListening(true);
    try {
      speech.start({
        lang: 'fr-FR',
        interimResults: true,
        // iOS coupe à la première pause sans `continuous` ; l'arrêt est géré ici.
        continuous: Platform.OS === 'ios',
        maxAlternatives: 1,
        contextualStrings: hints.filter(Boolean).slice(0, 100),
        androidIntentOptions: {
          EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS: SILENCE_MS,
          EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS: SILENCE_MS,
        },
        ...(androidService ? { androidRecognitionServicePackage: androidService } : {}),
      });
      armTimer(NO_SPEECH_MS);
    } catch {
      setListening(false);
      detach();
      toast.error('Recherche vocale', 'Le micro n’a pas pu démarrer. Réessayez dans un instant.');
    }
  }, [armTimer, detach, hints, listening, onDetected, stopVoiceSearch, toast]);

  return { listening, transcript, startVoiceSearch, stopVoiceSearch, cancelVoiceSearch };
}
