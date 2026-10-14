import { renderHook, act } from '@testing-library/react-native';

const mockListeners: Record<string, ((e: unknown) => void)[]> = {};
const mockEmit = (name: string, e: unknown = {}) => (mockListeners[name] ?? []).forEach((l) => l(e));
const mockStart = jest.fn();
const mockStop = jest.fn();

jest.mock('expo-speech-recognition', () => ({
  ExpoSpeechRecognitionModule: {
    requestPermissionsAsync: jest.fn(async () => ({ granted: true })),
    getPermissionsAsync: jest.fn(async () => ({ granted: true, canAskAgain: true })),
    isRecognitionAvailable: jest.fn(() => true),
    getSpeechRecognitionServices: jest.fn(() => [] as string[]),
    getDefaultRecognitionService: jest.fn(() => ({ packageName: '' })),
    start: (...args: unknown[]) => mockStart(...args),
    stop: () => mockStop(),
    abort: jest.fn(),
    addListener: (name: string, l: (e: unknown) => void) => {
      (mockListeners[name] ??= []).push(l);
      return {
        remove: () => {
          mockListeners[name] = (mockListeners[name] ?? []).filter((x) => x !== l);
        },
      };
    },
  },
}));

jest.mock('@/hooks/useToast', () => ({
  useToast: () => ({ info: jest.fn(), error: jest.fn(), success: jest.fn() }),
}));

import { useVoiceProductSearch, NO_SPEECH_MS } from '../useVoiceProductSearch';

describe('useVoiceProductSearch', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });
  afterEach(() => jest.useRealTimers());

  it('laisse parler le client et ne coupe qu’après 2 s de silence', async () => {
    const onDetected = jest.fn();
    const { result } = renderHook(() => useVoiceProductSearch(onDetected));
    await act(async () => {
      await result.current.startVoiceSearch();
    });
    expect(result.current.listening).toBe(true);

    act(() => {
      mockEmit('result', { isFinal: false, results: [{ transcript: 'pâte' }] });
      jest.advanceTimersByTime(1500);
    });
    act(() => {
      mockEmit('result', { isFinal: false, results: [{ transcript: 'pâte de graine' }] });
      jest.advanceTimersByTime(1500);
    });
    expect(mockStop).not.toHaveBeenCalled();
    expect(result.current.transcript).toBe('pâte de graine');

    act(() => {
      jest.advanceTimersByTime(600);
    });
    expect(mockStop).toHaveBeenCalledTimes(1);

    act(() => mockEmit('end'));
    expect(result.current.listening).toBe(false);
    expect(onDetected).toHaveBeenCalledWith('pâte de graine');
  });

  it('s’arrête si le client ne dit rien', async () => {
    const onDetected = jest.fn();
    const { result } = renderHook(() => useVoiceProductSearch(onDetected));
    await act(async () => {
      await result.current.startVoiceSearch();
    });
    act(() => {
      jest.advanceTimersByTime(NO_SPEECH_MS);
    });
    expect(mockStop).toHaveBeenCalledTimes(1);
    act(() => mockEmit('end'));
    expect(onDetected).not.toHaveBeenCalled();
  });
});

describe('useVoiceProductSearch — micro et service de reconnaissance (Android)', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { ExpoSpeechRecognitionModule: speech } = require('expo-speech-recognition');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Alert, Platform } = require('react-native');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { voiceErrorMessage } = require('../useVoiceProductSearch');
  const realOS = Platform.OS;

  beforeEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    speech.getPermissionsAsync.mockResolvedValue({ granted: true, canAskAgain: true });
    speech.requestPermissionsAsync.mockResolvedValue({ granted: true });
    speech.isRecognitionAvailable.mockReturnValue(true);
    speech.getSpeechRecognitionServices.mockReturnValue([]);
    speech.getDefaultRecognitionService.mockReturnValue({ packageName: '' });
  });
  afterEach(() => {
    Platform.OS = realOS;
  });

  it('micro refusé pour de bon : pas de nouvelle demande, renvoi vers les réglages', async () => {
    speech.getPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: false });
    const { result } = renderHook(() => useVoiceProductSearch(jest.fn()));
    await act(async () => {
      await result.current.startVoiceSearch();
    });
    expect(speech.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith('Micro non autorisé', expect.any(String), expect.any(Array));
    expect(mockStart).not.toHaveBeenCalled();
  });

  it('première fois : demande la permission puis écoute', async () => {
    speech.getPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: true });
    const { result } = renderHook(() => useVoiceProductSearch(jest.fn()));
    await act(async () => {
      await result.current.startVoiceSearch();
    });
    expect(speech.requestPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(mockStart).toHaveBeenCalledTimes(1);
  });

  it('service de reconnaissance absent : message clair, pas d’écoute', async () => {
    speech.isRecognitionAvailable.mockReturnValue(false);
    const { result } = renderHook(() => useVoiceProductSearch(jest.fn()));
    await act(async () => {
      await result.current.startVoiceSearch();
    });
    expect(Alert.alert).toHaveBeenCalledWith('Reconnaissance vocale indisponible', expect.any(String));
    expect(mockStart).not.toHaveBeenCalled();
  });

  it('Android, moteur Samsung par défaut : passe sur le moteur de Google installé', async () => {
    Platform.OS = 'android';
    speech.getDefaultRecognitionService.mockReturnValue({ packageName: 'com.samsung.android.bixby.agent' });
    speech.getSpeechRecognitionServices.mockReturnValue(['com.samsung.android.bixby.agent', 'com.google.android.googlequicksearchbox']);
    const { result } = renderHook(() => useVoiceProductSearch(jest.fn()));
    await act(async () => {
      await result.current.startVoiceSearch();
    });
    expect(mockStart.mock.calls[0][0]).toMatchObject({
      lang: 'fr-FR',
      androidRecognitionServicePackage: 'com.google.android.googlequicksearchbox',
    });
  });

  it('Android, moteur Google déjà par défaut : le moteur du téléphone est gardé', async () => {
    Platform.OS = 'android';
    speech.getDefaultRecognitionService.mockReturnValue({ packageName: 'com.google.android.tts' });
    speech.getSpeechRecognitionServices.mockReturnValue(['com.google.android.as', 'com.google.android.tts']);
    const { result } = renderHook(() => useVoiceProductSearch(jest.fn()));
    await act(async () => {
      await result.current.startVoiceSearch();
    });
    expect(mockStart.mock.calls[0][0]).toMatchObject({ lang: 'fr-FR' });
    expect(mockStart.mock.calls[0][0]).not.toHaveProperty('androidRecognitionServicePackage');
  });

  it('Android : jamais le moteur hors ligne (sans pack français, il n’entend rien)', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { pickAndroidRecognizer } = require('../useVoiceProductSearch');
    expect(pickAndroidRecognizer('com.google.android.as', ['com.google.android.as', 'com.google.android.tts'])).toBe(
      'com.google.android.tts',
    );
    expect(pickAndroidRecognizer('com.google.android.as', ['com.google.android.as'])).toBeUndefined();
    expect(pickAndroidRecognizer('', ['com.google.android.googlequicksearchbox'])).toBe('com.google.android.googlequicksearchbox');
    expect(pickAndroidRecognizer('com.huawei.vassistant', [])).toBeUndefined();
  });

  it('messages par erreur, code compris quand il est inconnu', () => {
    expect(voiceErrorMessage('network').title).toBe('Pas de connexion');
    expect(voiceErrorMessage('language-not-supported').title).toBe('Français indisponible');
    expect(voiceErrorMessage('not-allowed').openSettings).toBe(true);
    expect(voiceErrorMessage('client').message).toMatch(/\(client\)/);
  });
});
