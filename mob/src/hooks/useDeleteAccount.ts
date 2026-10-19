import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { invokeFunction } from '@/api/entities';
import { useAuth } from '@/lib/AuthContext';
import { useToast } from '@/hooks/useToast';
import { userErrorMessage } from '@/lib/userErrors';
import type { RootStackParamList } from '@/navigation/types';

/**
 * Suppression du compte, après confirmation. Apple impose qu'un compte créé
 * dans l'app puisse y être supprimé (règle 5.1.1(v)) : l'action a quitté le
 * profil mais reste dans « Paramètres ».
 */
export const useDeleteAccount = () => {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { logout } = useAuth();
  const toast = useToast();
  const [deleting, setDeleting] = useState(false);

  const deleteAccount = useCallback(() => {
    Alert.alert(
      'Supprimer mon compte',
      'Cette action est irréversible. Toutes vos données seront supprimées.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await invokeFunction('handleCustomAuth', { action: 'delete_account' });
              await logout();
              nav.navigate('ClientTabs', { screen: 'HomeTab' });
            } catch (e) {
              toast.error(
                'Suppression impossible',
                userErrorMessage(e, 'Votre compte n’a pas pu être supprimé. Contactez le service client.'),
              );
            } finally {
              setDeleting(false);
            }
          },
        },
      ],
    );
  }, [logout, nav, toast]);

  return { deleteAccount, deleting };
};
