import 'react-native-get-random-values';
import './src/shims/windowLocation';
import 'react-native-gesture-handler';
// Tâche « notifications app fermée » : doit être définie dès le chargement du bundle.
import './src/services/backgroundNotifications';
import * as WebBrowser from 'expo-web-browser';
import { registerRootComponent } from 'expo';

import App from './App';

WebBrowser.maybeCompleteAuthSession();

registerRootComponent(App);
