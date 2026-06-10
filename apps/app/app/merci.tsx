import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ScrollView, Text, View } from "react-native";

import { Button } from "../components/Button";
import { formatAmount } from "../features/checkout/form";
import { decodeThankYouParams } from "../features/thankyou/summary";

/**
 * Page de remerciement (SPEC-001 · T7).
 *
 * Affichée après une commande aboutie : un moment d'émotion (typographie
 * Playfair, palette or de la célébration) qui referme le parcours acheteur. Le
 * résumé provient des paramètres de route non identifiants (cf. `summary.ts`) :
 * l'URL ne porte ni nom ni adresse. Un accès direct sans commande retombe sur un
 * message neutre plutôt qu'une erreur.
 */
export default function ThankYou() {
  const params = useLocalSearchParams();
  const summary = decodeThankYouParams(params);

  return (
    <ScrollView
      className="flex-1 bg-ivory"
      contentContainerClassName="items-center gap-6 p-6"
    >
      <StatusBar style="dark" />

      <View className="w-full max-w-md items-center gap-3 rounded-2xl bg-gold/20 p-8">
        <Text className="font-emotional text-5xl text-navy">Merci ✦</Text>
        <Text className="text-center font-functional text-base text-navy/80">
          Votre cadeau est commandé. Un paiement de test Stripe a abouti — le
          geste est parti, sans la charge mentale.
        </Text>
      </View>

      {summary !== null ? (
        <View className="w-full max-w-md gap-1 rounded-2xl border border-navy/15 bg-white p-4">
          <Text className="font-functional text-sm text-navy/70">
            Commande {summary.orderId}
          </Text>
          <Text className="font-emotional text-xl text-navy">
            {formatAmount(summary.amountCents, summary.currency)}
          </Text>
          <Text className="font-functional text-sm text-navy/70">
            Statut : {summary.status === "paid" ? "payé (test)" : summary.status}
          </Text>
          <Text className="font-functional text-xs text-navy/50">
            PaymentIntent {summary.paymentIntentId}
          </Text>
        </View>
      ) : (
        <Text className="w-full max-w-md text-center font-functional text-sm text-navy/60">
          Aucun détail de commande à afficher.
        </Text>
      )}

      <View className="w-full max-w-md">
        <Button
          label="Offrir un autre cadeau"
          variant="celebration"
          onPress={() => router.replace("/")}
        />
      </View>
    </ScrollView>
  );
}
