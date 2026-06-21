import 'react-native-get-random-values';
import './src/shims/windowLocation';
import 'react-native-gesture-handler';
import * as WebBrowser from 'expo-web-browser';
import { registerRootComponent } from 'expo';

import App from './App';

WebBrowser.maybeCompleteAuthSession();

registerRootComponent(App);
