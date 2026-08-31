import { describeAsset, pickFileUrl, uploadAsset } from '../fileUpload';

jest.mock('@/api/base44Client', () => ({
  tokenStore: { load: jest.fn(async () => 'tok-123') },
}));

describe('describeAsset', () => {
  it("privilégie le nom et le type fournis par l'image picker", () => {
    expect(
      describeAsset({ uri: 'file:///tmp/abc', fileName: 'IMG_0042.HEIC', mimeType: 'image/heic' }),
    ).toEqual({ name: 'IMG_0042.HEIC', type: 'image/heic' });
  });

  it("déduit le type MIME de l'extension quand le picker ne le fournit pas", () => {
    expect(describeAsset({ uri: 'file:///tmp/photo.png' })).toEqual({
      name: 'photo.png',
      type: 'image/png',
    });
  });

  it('retombe sur photo.jpg / image/jpeg pour un URI sans extension', () => {
    expect(describeAsset({ uri: 'ph://1234-5678' })).toEqual({
      name: 'photo.jpg',
      type: 'image/jpeg',
    });
  });

  it('ignore la query string dans l’URI', () => {
    expect(describeAsset({ uri: 'file:///tmp/a.jpeg?width=100' }).type).toBe('image/jpeg');
  });
});

describe('pickFileUrl', () => {
  it('lit file_url, url ou fileUrl', () => {
    expect(pickFileUrl({ file_url: 'https://a/1.jpg' })).toBe('https://a/1.jpg');
    expect(pickFileUrl({ url: 'https://a/2.jpg' })).toBe('https://a/2.jpg');
    expect(pickFileUrl({ fileUrl: 'https://a/3.jpg' })).toBe('https://a/3.jpg');
  });

  it('descend dans `data` quand la réponse est enveloppée', () => {
    expect(pickFileUrl({ data: { file_url: 'https://a/4.jpg' } })).toBe('https://a/4.jpg');
  });

  it('retourne null quand aucune URL n’est présente', () => {
    expect(pickFileUrl({ ok: true })).toBeNull();
    expect(pickFileUrl(null)).toBeNull();
  });
});

describe('uploadAsset', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('envoie un multipart avec la partie fichier RN et retourne l’URL', async () => {
    const fetchMock = jest.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ file_url: 'https://cdn/afrigo/photo.jpg' }),
    }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const url = await uploadAsset({ uri: 'file:///tmp/photo.jpg', mimeType: 'image/jpeg' });

    expect(url).toBe('https://cdn/afrigo/photo.jpg');
    const [endpoint, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(endpoint).toContain('/integration-endpoints/Core/UploadFile');
    expect(init.method).toBe('POST');
    // Le corps est bien un multipart (FormData) et non du JSON — c'est ce que
    // le SDK Base44 ne faisait pas en React Native.
    expect(init.body).toBeInstanceOf(FormData);
    // Content-Type doit rester non défini : RN génère le boundary.
    expect(Object.keys(init.headers as Record<string, string>)).not.toContain('Content-Type');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok-123');
  });

  it('remonte le message d’erreur du serveur', async () => {
    global.fetch = jest.fn(async () => ({
      ok: false,
      status: 413,
      text: async () => JSON.stringify({ message: 'Fichier trop volumineux' }),
    })) as unknown as typeof fetch;

    await expect(uploadAsset({ uri: 'file:///tmp/photo.jpg' })).rejects.toThrow(
      'Fichier trop volumineux',
    );
  });

  it('échoue explicitement si le serveur ne renvoie pas d’URL', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ ok: true }),
    })) as unknown as typeof fetch;

    await expect(uploadAsset({ uri: 'file:///tmp/photo.jpg' })).rejects.toThrow(
      /n'a pas retourné d'URL/,
    );
  });
});
