import { useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthGate } from './src/features/auth/AuthGate';
import { AnimatedSplashScreen } from './src/features/splash/AnimatedSplashScreen';

export default function App() {
  const [splashFinished, setSplashFinished] = useState(false);

  return (
    <SafeAreaProvider>
      {splashFinished ? <AuthGate /> : <AnimatedSplashScreen onFinished={() => setSplashFinished(true)} />}
    </SafeAreaProvider>
  );
}
