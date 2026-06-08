import { Pressable, Text } from "react-native";

import {
  buttonContainerClassName,
  buttonLabelClassName,
  type ButtonVariant,
} from "./variants";

export type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
};

/**
 * Bouton de base Oreli (NativeWind). La variante `primary` (corail) porte
 * l'action principale, `celebration` (or) les moments de fête, `secondary`
 * les actions discrètes. Voir .claude/SYSTEM.md § Design.
 */
export function Button({
  label,
  onPress,
  variant = "primary",
  disabled = false,
}: ButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      className={buttonContainerClassName(variant, disabled)}
    >
      <Text className={buttonLabelClassName(variant)}>{label}</Text>
    </Pressable>
  );
}
