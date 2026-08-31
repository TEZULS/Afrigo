/**
 * Upload de fichiers vers l'intégration Base44 `Core/UploadFile` depuis React
 * Native.
 *
 * Pourquoi ne pas passer par `base44.integrations.Core.UploadFile()` ?
 * Le SDK ne bascule en `multipart/form-data` que si l'une des valeurs passées
 * est une instance de `File` (API navigateur) :
 *
 *   if (data instanceof FormData || Object.values(data).some(v => v instanceof File))
 *
 * En React Native on ne dispose pas d'un vrai `File` construit depuis un URI
 * local — l'objet `{ uri, name, type }` (le format attendu par le `FormData`
 * de RN) n'en est pas une instance. Le SDK sérialisait donc la photo en JSON,
 * le backend ne recevait aucun fichier et l'appel remontait une erreur : c'est
 * la cause du message « erreur » lors de la recherche par image.
 *
 * On construit donc nous-mêmes la requête multipart avec le `FormData` de RN,
 * qui sait streamer un fichier depuis son URI.
 */

import { env } from '@/config/env';
import { tokenStore } from '@/api/base44Client';

export interface UploadedFile {
  file_url: string;
}

interface UploadAssetInput {
  uri: string;
  /** Nom de fichier renvoyé par expo-image-picker (`asset.fileName`). */
  fileName?: string | null;
  /** Type MIME renvoyé par expo-image-picker (`asset.mimeType`). */
  mimeType?: string | null;
}

const MIME_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  heic: 'image/heic',
  heif: 'image/heif',
  webp: 'image/webp',
  gif: 'image/gif',
};

/** Déduit un couple (nom, type MIME) exploitable par le backend. */
export const describeAsset = ({ uri, fileName, mimeType }: UploadAssetInput) => {
  const fromUri = uri.split('?')[0].split('/').pop() ?? '';
  const name = fileName?.trim() || (fromUri.includes('.') ? fromUri : 'photo.jpg');
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  const type = mimeType?.trim() || MIME_BY_EXT[ext] || 'image/jpeg';
  return { name, type };
};

const uploadEndpoint = () =>
  `${env.base44.serverUrl}/api/apps/${env.base44.appId}/integration-endpoints/Core/UploadFile`;

/**
 * Extrait l'URL publique du fichier, quelle que soit la forme de la réponse
 * (`file_url`, `url`, ou imbriquée dans `data`).
 */
export const pickFileUrl = (payload: unknown): string | null => {
  if (!payload || typeof payload !== 'object') return null;
  const o = payload as Record<string, unknown>;
  const direct = o.file_url ?? o.url ?? o.fileUrl;
  if (typeof direct === 'string' && direct) return direct;
  if (o.data && typeof o.data === 'object') return pickFileUrl(o.data);
  return null;
};

/**
 * Envoie une image locale (`file://`, `ph://`, `content://`) et retourne son
 * URL publique côté Base44.
 */
export const uploadAsset = async (asset: UploadAssetInput): Promise<string> => {
  const { name, type } = describeAsset(asset);

  const form = new FormData();
  // Format spécifique React Native : le bridge lit le fichier depuis l'URI.
  form.append('file', { uri: asset.uri, name, type } as unknown as Blob);

  const token = await tokenStore.load();
  const res = await fetch(uploadEndpoint(), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'X-App-Id': env.base44.appId,
      ...(env.base44.apiKey ? { api_key: env.base44.apiKey } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      // Surtout NE PAS fixer Content-Type : RN doit générer le `boundary`.
    },
    body: form,
  });

  const raw = await res.text();
  let parsed: unknown = null;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    parsed = null;
  }

  if (!res.ok) {
    const message =
      (parsed && typeof parsed === 'object'
        ? ((parsed as Record<string, unknown>).message as string | undefined) ??
          ((parsed as Record<string, unknown>).detail as string | undefined)
        : undefined) ?? `Échec de l'envoi de la photo (${res.status}).`;
    throw new Error(message);
  }

  const fileUrl = pickFileUrl(parsed);
  if (!fileUrl) {
    throw new Error("Le serveur n'a pas retourné d'URL pour la photo.");
  }
  return fileUrl;
};
