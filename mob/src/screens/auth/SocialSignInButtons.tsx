import React, { useCallback, useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { GoogleSigninButton } from '@react-native-google-signin/google-signin';
import { Button } from '@/components/ui/Button';
import {
  configureGoogleSignIn,
  isAppleSignInAvailable,
  isGoogleSignInConfigured,
} from '@/services/socialAuth';

type Props = {
  busy: boolean;
  onApplePress: () => void;
  onGooglePress: () => void;
};

export const SocialSignInButtons: React.FC<Props> = ({ busy, onApplePress, onGooglePress }) => {
  const [appleAvailable, setAppleAvailable] = useState(false);
  const googleConfigured = isGoogleSignInConfigured();

  useEffect(() => {
    void isAppleSignInAvailable().then(setAppleAvailable);
    configureGoogleSignIn();
  }, []);

  if (!appleAvailable && !googleConfigured) {
    return null;
  }

  return (
    <View style={styles.wrap}>
      {appleAvailable ? (
        <View pointerEvents={busy ? 'none' : 'auto'} style={busy ? styles.busy : undefined}>
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
            cornerRadius={10}
            style={[styles.appleBtn, busy ? styles.dimmed : undefined]}
            onPress={onApplePress}
          />
        </View>
      ) : null}

      {googleConfigured ? (
        Platform.OS === 'ios' ? (
          <Button
            title="Continuer avec Google"
            variant="outline"
            size="lg"
            fullWidth
            loading={busy}
            disabled={busy}
            onPress={onGooglePress}
            style={styles.googleBtn}
          />
        ) : (
          <GoogleSigninButton
            size={GoogleSigninButton.Size.Wide}
            color={GoogleSigninButton.Color.Dark}
            onPress={onGooglePress}
            disabled={busy}
            style={styles.googleNativeBtn}
          />
        )
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    gap: 12,
    marginTop: 4,
  },
  appleBtn: {
    width: '100%',
    height: 52,
  },
  googleBtn: {
    borderRadius: 10,
    minHeight: 52,
  },
  googleNativeBtn: {
    width: '100%',
    height: 52,
  },
  busy: {
    opacity: 0.6,
  },
  dimmed: {
    opacity: 0.6,
  },
});
