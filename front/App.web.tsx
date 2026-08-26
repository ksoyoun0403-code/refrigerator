import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthGate } from './src/features/auth/AuthGate';
import { AnimatedSplashScreen } from './src/features/splash/AnimatedSplashScreen';

const MOBILE_VIEWPORT_WIDTH = 430;

export default function App() {
  const [splashFinished, setSplashFinished] = useState(false);

  return (
    <View style={styles.browserViewport}>
      <SafeAreaProvider style={styles.mobileFrame}>
        {splashFinished ? <AuthGate /> : <AnimatedSplashScreen onFinished={() => setSplashFinished(true)} />}
      </SafeAreaProvider>
    </View>
  );
}

const styles = StyleSheet.create({
  browserViewport: {
    alignItems: 'center',
    backgroundColor: '#EDE7DF',
    flex: 1,
  },
  mobileFrame: {
    backgroundColor: '#FFF8EE',
    flex: 1,
    maxWidth: MOBILE_VIEWPORT_WIDTH,
    width: '100%',
  },
});
