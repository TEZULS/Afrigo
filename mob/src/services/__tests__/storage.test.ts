import AsyncStorage from '@react-native-async-storage/async-storage';
import { kv } from '../storage';

const setItem = AsyncStorage.setItem as jest.Mock;

describe('kv.flush — écritures disque terminées avant la fin d’une tâche', () => {
  it('la valeur est lisible tout de suite, et flush attend que le disque l’ait écrite', async () => {
    let release!: () => void;
    setItem.mockImplementationOnce(() => new Promise<void>((r) => (release = r)));
    kv.set('flush_test', ['n1', 'n2']);
    expect(kv.get('flush_test')).toEqual(['n1', 'n2']);

    let done = false;
    const flushed = kv.flush().then(() => {
      done = true;
    });
    await new Promise((r) => setTimeout(r, 10));
    expect(done).toBe(false);
    release();
    await flushed;
    expect(done).toBe(true);
  });

  it('attend aussi une écriture lancée pendant l’attente', async () => {
    const releases: (() => void)[] = [];
    setItem.mockImplementation(() => new Promise<void>((r) => releases.push(r)));
    try {
      kv.set('flush_a', 1);
      let done = false;
      const flushed = kv.flush().then(() => {
        done = true;
      });
      kv.set('flush_b', 2);
      releases[0]();
      await new Promise((r) => setTimeout(r, 10));
      expect(done).toBe(false);
      releases[1]();
      await flushed;
      expect(done).toBe(true);
    } finally {
      setItem.mockReset();
    }
  });

  it('une écriture en échec ne bloque pas la tâche', async () => {
    setItem.mockImplementationOnce(() => Promise.reject(new Error('disque plein')));
    kv.set('flush_fail', 'x');
    await expect(kv.flush()).resolves.toBeUndefined();
  });
});
