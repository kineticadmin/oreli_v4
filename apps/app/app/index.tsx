import { StatusBar } from "expo-status-bar";
import { ScrollView, Text, View } from "react-native";

import { Button } from "../components/Button";
import { ConversationBubble } from "../components/ConversationBubble";
import { ProductCard } from "../components/ProductCard";

// Produit de démonstration pour la vitrine des composants de base (T2).
// Le catalogue réel est servi par l'API (T1) et branché dans une tâche
// ultérieure (écran conversationnel, T5).
const DEMO_PRODUCT = {
  title: "Bougie parfumée, cire de soja",
  description:
    "Façonnée à la main dans un atelier bruxellois, parfum cèdre et figue.",
  priceCents: 2900,
  currency: "EUR",
  imageUrl: "https://placehold.co/600x400/png",
  inStock: true,
} as const;

export default function Home() {
  return (
    <ScrollView
      className="flex-1 bg-ivory"
      contentContainerClassName="items-center gap-6 p-6"
    >
      <StatusBar style="dark" />
      <View className="items-center gap-2">
        <Text className="font-emotional text-5xl text-navy">Oreli</Text>
        <Text className="font-functional text-base text-navy">
          Le cadeau juste, sans la charge mentale.
        </Text>
      </View>

      <View className="w-full max-w-md gap-3">
        <ConversationBubble
          author="oreli"
          message="Pour quelle occasion cherchez-vous un cadeau ?"
        />
        <ConversationBubble author="guest" message="Un anniversaire." />
      </View>

      <View className="w-full max-w-md">
        <ProductCard product={DEMO_PRODUCT} />
      </View>

      <View className="w-full max-w-md gap-3">
        <Button label="Voir la sélection" variant="primary" />
        <Button label="Tenter la surprise" variant="celebration" />
      </View>
    </ScrollView>
  );
}
