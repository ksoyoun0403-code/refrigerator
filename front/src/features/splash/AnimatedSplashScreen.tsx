import { useEffect, useRef } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Image,
  StyleSheet,
  View,
} from 'react-native';

const tomato = require('../../../assets/splash/tomato.png');
const leaf = require('../../../assets/splash/leaf.png');
const wordmark = require('../../../assets/splash/mydish-wordmark-chef.png');

export function AnimatedSplashScreen({ onFinished }: { onFinished(): void }) {
  const merge = useRef(new Animated.Value(0)).current;
  const ingredientsOpacity = useRef(new Animated.Value(1)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.9)).current;
  const screenOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let cancelled = false;
    let animation: Animated.CompositeAnimation | undefined;

    void AccessibilityInfo.isReduceMotionEnabled().then((reduceMotion) => {
      if (cancelled) return;
      if (reduceMotion) {
        ingredientsOpacity.setValue(0);
        logoOpacity.setValue(1);
        logoScale.setValue(1);
      }

      animation = Animated.sequence([
        ...(reduceMotion ? [] : [
          Animated.timing(merge, {
            duration: 900,
            easing: Easing.out(Easing.cubic),
            toValue: 1,
            useNativeDriver: true,
          }),
          Animated.parallel([
            Animated.timing(ingredientsOpacity, {
              duration: 260,
              toValue: 0,
              useNativeDriver: true,
            }),
            Animated.timing(logoOpacity, {
              delay: 100,
              duration: 520,
              toValue: 1,
              useNativeDriver: true,
            }),
            Animated.spring(logoScale, {
              damping: 13,
              mass: 0.7,
              stiffness: 120,
              toValue: 1,
              useNativeDriver: true,
            }),
          ]),
        ]),
        Animated.delay(reduceMotion ? 500 : 650),
        Animated.timing(screenOpacity, {
          duration: 260,
          toValue: 0,
          useNativeDriver: true,
        }),
      ]);
      animation.start(({ finished }) => {
        if (finished && !cancelled) onFinished();
      });
    });

    return () => {
      cancelled = true;
      animation?.stop();
    };
  }, [ingredientsOpacity, logoOpacity, logoScale, merge, onFinished, screenOpacity]);

  return (
    <Animated.View accessibilityLabel="MYDISH 시작 화면" style={[styles.screen, { opacity: screenOpacity }]}>
      <View style={styles.animationArea}>
        <Animated.View style={[styles.ingredient, {
          opacity: ingredientsOpacity,
          transform: [{ translateX: merge.interpolate({ inputRange: [0, 1], outputRange: [-92, 0] }) }],
        }]}>
          <Image resizeMode="contain" source={tomato} style={styles.ingredientImage} />
        </Animated.View>
        <Animated.View style={[styles.ingredient, {
          opacity: ingredientsOpacity,
          transform: [{ translateX: merge.interpolate({ inputRange: [0, 1], outputRange: [92, 0] }) }],
        }]}>
          <Image resizeMode="contain" source={leaf} style={styles.ingredientImage} />
        </Animated.View>
        <Animated.View style={[styles.logo, { opacity: logoOpacity, transform: [{ scale: logoScale }] }]}>
          <Image resizeMode="contain" source={wordmark} style={styles.logoImage} />
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: { alignItems: 'center', backgroundColor: '#FFFFFF', flex: 1, justifyContent: 'center' },
  animationArea: { alignItems: 'center', height: 260, justifyContent: 'center', width: '100%' },
  ingredient: { height: 138, position: 'absolute', width: 138 },
  ingredientImage: { height: '100%', width: '100%' },
  logo: { alignItems: 'center', height: 90, justifyContent: 'center', overflow: 'hidden', position: 'absolute', width: '72%' },
  logoImage: { height: 210, width: 420 },
});
