/**
 * CustomerMessages — version "lecture" pour le client (équivalent du
 * src/pages/CustomerMessages.jsx web). En réalité le flux principal de chat
 * se fait via `MessagesScreen`. Cet écran affiche les conversations
 * groupées (utile si plusieurs équipes).
 *
 * Pour un MVP mobile, on redirige simplement vers MessagesScreen.
 */
import React, { useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Screen } from '@/components/ui/Screen';
import { Loader } from '@/components/ui/Loader';
import type { RootStackParamList } from '@/navigation/types';

export const CustomerMessagesScreen: React.FC = () => {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  useEffect(() => {
    nav.replace('Messages');
  }, [nav]);
  return (
    <Screen>
      <Loader />
    </Screen>
  );
};
