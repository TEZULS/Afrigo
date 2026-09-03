import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import * as Updates from 'expo-updates';

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    if (__DEV__) console.error('AfriGo crash', error, info);
  }

  handleReload = async () => {
    if (!__DEV__) {
      try {
        await Updates.reloadAsync();
      } catch {
        /* noop */
      }
    }
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Une erreur inattendue s'est produite</Text>
          <Text style={styles.message}>{this.state.error.message}</Text>
          {__DEV__ && this.state.error.stack ? (
            <ScrollView style={styles.stack}>
              <Text style={styles.stackText}>{this.state.error.stack}</Text>
            </ScrollView>
          ) : null}
          <Pressable onPress={this.handleReload} style={styles.button}>
            <Text style={styles.buttonText}>Recharger l'application</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#FFFFFF', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '700', color: '#0F172A', marginBottom: 12 },
  message: { fontSize: 14, color: '#64748B', marginBottom: 16 },
  stack: { maxHeight: 200, backgroundColor: '#F1F5F9', padding: 12, borderRadius: 8 },
  stackText: { fontSize: 11, fontFamily: 'Courier', color: '#334155' },
  button: { marginTop: 24, padding: 14, backgroundColor: '#F97316', borderRadius: 12, alignItems: 'center' },
  buttonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
});
