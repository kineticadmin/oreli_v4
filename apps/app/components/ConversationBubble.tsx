import { Text, View } from "react-native";

import {
  bubbleContainerClassName,
  bubbleTextClassName,
  type BubbleAuthor,
} from "./variants";

export type ConversationBubbleProps = {
  author: BubbleAuthor;
  message: string;
};

/**
 * Bulle de conversation du dialogue avec Oreli (NativeWind). Les messages
 * d'Oreli adoptent la lavande (moment d'IA) et s'alignent à gauche ; ceux de
 * l'invité s'alignent à droite sur fond navy. Voir .claude/SYSTEM.md § Design.
 */
export function ConversationBubble({
  author,
  message,
}: ConversationBubbleProps) {
  return (
    <View className={bubbleContainerClassName(author)}>
      <Text className={bubbleTextClassName(author)}>{message}</Text>
    </View>
  );
}
