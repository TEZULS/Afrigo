import * as Location from 'expo-location';
import { getNearbyPosition, __resetNearbyPosition } from '@/services/nearbyPosition';

const mocked = Location as jest.Mocked<typeof Location>;

describe('getNearbyPosition', () => {
  beforeEach(() => {
    __resetNearbyPosition();
    jest.clearAllMocks();
  });

  it('demande la localisation puis arrondit la position à ~1 km', async () => {
    mocked.getForegroundPermissionsAsync.mockResolvedValueOnce({ status: 'undetermined' } as never);
    mocked.requestForegroundPermissionsAsync.mockResolvedValueOnce({ status: 'granted' } as never);
    mocked.getCurrentPositionAsync.mockResolvedValueOnce({
      coords: { latitude: 48.95712, longitude: 4.36389 },
    } as never);

    await expect(getNearbyPosition()).resolves.toEqual({ lat: 48.96, lon: 4.36 });
    // Mémorisée : pas de nouvelle demande au champ suivant.
    await getNearbyPosition();
    expect(mocked.getCurrentPositionAsync).toHaveBeenCalledTimes(1);
  });

  it('renvoie null si le client refuse la localisation', async () => {
    mocked.getForegroundPermissionsAsync.mockResolvedValueOnce({ status: 'denied' } as never);
    await expect(getNearbyPosition()).resolves.toBeNull();
    expect(mocked.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
  });
});
