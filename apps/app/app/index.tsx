import { semanticColors, spacing, typography } from "@oreli/design-tokens";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View } from "react-native";

export default function Home() {
  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <Text style={styles.title}>Oreli</Text>
      <Text style={styles.subtitle}>
        Le cadeau juste, sans la charge mentale.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: semanticColors.background,
    padding: spacing.lg,
  },
  title: {
    fontFamily: typography.emotional,
    fontSize: 48,
    color: semanticColors.foreground,
  },
  subtitle: {
    fontFamily: typography.functional,
    fontSize: 16,
    color: semanticColors.foreground,
    marginTop: spacing.sm,
  },
});
