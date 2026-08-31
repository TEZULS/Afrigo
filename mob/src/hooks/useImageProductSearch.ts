import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { InvokeLLM } from '@/api/entities';
import { uploadAsset } from '@/services/fileUpload';
import { useToast } from '@/hooks/useToast';
import { userErrorMessage } from '@/lib/userErrors';

/**
 * Recherche par image : upload la photo vers Base44 puis demande à l'IA
 * Vision d'identifier le(s) produit(s) visible(s). Le résultat (ex.
 * « Nestlé Pure Life ») est renvoyé à l'appelant via `onDetected`, qui
 * l'injecte dans sa barre de recherche.
 *
 * L'upload passe par `uploadAsset` (multipart natif RN) et non par
 * `integrations.Core.UploadFile` : le SDK n'active le mode fichier que pour
 * une instance `File` du navigateur, inexistante en RN — la photo partait
 * donc en JSON et l'appel échouait systématiquement.
 *
 * Partagé par l'accueil et l'écran de recherche plein écran ; `onDetected`
 * doit être mémoïsé par l'appelant.
 */
export function useImageProductSearch(onDetected: (keywords: string) => void) {
  const toast = useToast();
  const [scanning, setScanning] = useState(false);

  const analyzeProductImage = useCallback(
    async (asset: ImagePicker.ImagePickerAsset) => {
      setScanning(true);
      toast.info('Analyse en cours…', 'Identification du produit sur la photo');
      try {
        const fileUrl = await uploadAsset({
          uri: asset.uri,
          fileName: asset.fileName,
          mimeType: asset.mimeType,
        });

        const llm = (await InvokeLLM({
          prompt:
            "Analyse cette image et identifie le produit alimentaire ou cosmétique principal visible (marque + nom de produit). " +
            "Retourne UNIQUEMENT le ou les mots-clés à chercher dans un catalogue, séparés par des espaces. " +
            "Sois bref (1 à 4 mots), précis. Exemples: \"Nestlé Pure Life\", \"tomate\", \"Nutella\", \"savon karité\". " +
            "Si rien n'est identifiable, retourne une chaîne vide.",
          file_urls: [fileUrl],
          response_json_schema: {
            type: 'object',
            properties: {
              products: {
                type: 'string',
                description: 'Noms du/des produits détectés, séparés par des espaces',
              },
            },
          },
        } as Parameters<typeof InvokeLLM>[0])) as
          | { products?: string; data?: { products?: string } }
          | string
          | undefined;

        const detected = (
          typeof llm === 'string' ? llm : (llm?.products ?? llm?.data?.products ?? '')
        ).trim();

        if (!detected) {
          toast.error('Aucun produit identifié', 'Réessayez avec une photo plus nette.');
          return;
        }

        toast.success('Produit identifié', detected);
        onDetected(detected);
      } catch (e) {
        toast.error(
          'Recherche par image impossible',
          userErrorMessage(e, 'Réessayez dans un instant, ou saisissez le nom du produit.'),
        );
      } finally {
        setScanning(false);
      }
    },
    [toast, onDetected],
  );

  /** Sélection de la source (appareil photo / galerie) puis analyse. */
  const startImageSearch = useCallback(() => {
    if (scanning) return;
    Alert.alert('Recherche par image', 'Comment souhaitez-vous fournir la photo ?', [
      {
        text: 'Prendre une photo',
        onPress: async () => {
          const perms = await ImagePicker.requestCameraPermissionsAsync();
          if (!perms.granted) {
            Alert.alert(
              'Caméra refusée',
              "L'accès à l'appareil photo est requis pour la recherche par image.",
            );
            return;
          }
          const r = await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            quality: 0.7,
          });
          if (!r.canceled && r.assets[0]) await analyzeProductImage(r.assets[0]);
        },
      },
      {
        text: 'Choisir dans la galerie',
        onPress: async () => {
          const perms = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!perms.granted) {
            Alert.alert(
              'Galerie refusée',
              "L'accès à la galerie est requis pour la recherche par image.",
            );
            return;
          }
          const r = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 0.7,
          });
          if (!r.canceled && r.assets[0]) await analyzeProductImage(r.assets[0]);
        },
      },
      { text: 'Annuler', style: 'cancel' },
    ]);
  }, [analyzeProductImage, scanning]);

  return { scanning, startImageSearch };
}
