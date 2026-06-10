import type {
  GiftConverseResponse,
  GiftMode,
  GiftSessionState,
  Product,
} from "@oreli/shared";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useMemo, useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";

import { Button } from "../components/Button";
import { ConversationBubble } from "../components/ConversationBubble";
import { ProductCard } from "../components/ProductCard";
import { createAnalytics, resolveAnalyticsConfig } from "../features/analytics/client";
import {
  giftSelectedEvent,
  giftSessionStartedEvent,
  oreliSuggestedEvent,
  orderCompletedEvent,
} from "../features/analytics/events";
import { CheckoutApiError, createOrderRequest } from "../features/checkout/api";
import {
  buildOrderRequest,
  type DeliveryForm,
  formatAmount,
  INITIAL_DELIVERY_FORM,
} from "../features/checkout/form";
import { converseRequest, GiftApiError } from "../features/gift/api";
import {
  appendMessage,
  buildSessionState,
  createGuestToken,
  type GiftSetupForm,
} from "../features/gift/session";
import { encodeThankYouParams } from "../features/thankyou/summary";

/**
 * Écran du parcours cadeau acheteur (SPEC-001 · T5 + T6 + T7).
 *
 * Quatre temps : configuration (budget, occasion, date, mode, profil non
 * identifiant), dialogue avec Oreli, choix final (T5), puis paiement de test
 * Stripe (T6). Une commande aboutie redirige vers la page de remerciement
 * `/merci` (T7). L'état de session vit côté client (la conversation est sans état
 * côté serveur dans cette tranche) et est renvoyé à chaque tour ; les coordonnées
 * de livraison saisies à l'étape paiement peuvent être identifiantes mais ne
 * transitent jamais par le modèle produit ni par la mesure (T7).
 */

const INITIAL_FORM: GiftSetupForm = {
  budgetMin: "20",
  budgetMax: "60",
  occasion: "",
  eventDate: "",
  mode: "selection",
  relationship: "",
  tastes: "",
  tone: "",
};

const INPUT_CLASS =
  "rounded-2xl border border-navy/20 bg-white px-4 py-3 font-functional text-base text-navy";

function FieldLabel({ children }: { children: string }) {
  return (
    <Text className="font-functional text-sm font-semibold text-navy/80">
      {children}
    </Text>
  );
}

export default function Home() {
  const [guestToken] = useState(createGuestToken);
  const [form, setForm] = useState<GiftSetupForm>(INITIAL_FORM);
  const [firstMessage, setFirstMessage] = useState("");
  const [session, setSession] = useState<GiftSessionState | null>(null);
  const [response, setResponse] = useState<GiftConverseResponse | null>(null);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [selected, setSelected] = useState<Product | null>(null);
  const [delivery, setDelivery] = useState<DeliveryForm>(INITIAL_DELIVERY_FORM);
  const [paying, setPaying] = useState(false);

  // Client de mesure PostHog (T7), résolu une fois depuis l'environnement public.
  // No-op silencieux tant que `EXPO_PUBLIC_POSTHOG_KEY` n'est pas configurée.
  const analytics = useMemo(() => createAnalytics(resolveAnalyticsConfig()), []);

  const setField = (key: keyof GiftSetupForm, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  const setDeliveryField = (key: keyof DeliveryForm, value: string) =>
    setDelivery((current) => ({ ...current, [key]: value }));

  // Règle le paiement de test et crée la commande. Le montant fait autorité
  // côté serveur (lu depuis le produit) ; ici on n'envoie que le produit, le
  // jeton de session et les coordonnées de livraison.
  const payAndOrder = async () => {
    if (selected === null) {
      return;
    }
    const built = buildOrderRequest(delivery, guestToken, selected.id);
    if (!built.ok) {
      setErrors(built.errors);
      return;
    }
    setPaying(true);
    setErrors([]);
    try {
      const result = await createOrderRequest(built.request);
      void analytics.capture(orderCompletedEvent(guestToken, result.order));
      router.push({
        pathname: "/merci",
        params: encodeThankYouParams(result.order),
      });
    } catch (err) {
      setErrors([
        err instanceof CheckoutApiError
          ? err.message
          : "Le paiement n'a pas pu aboutir.",
      ]);
    } finally {
      setPaying(false);
    }
  };

  // Un tour de dialogue : envoie l'état à l'API, puis archive la réponse
  // d'Oreli dans l'historique. En cas d'échec, l'état utilisateur est conservé.
  const runTurn = async (nextState: GiftSessionState) => {
    setLoading(true);
    setErrors([]);
    try {
      const result = await converseRequest(nextState);
      setSession(appendMessage(nextState, "oreli", result.reply));
      setResponse(result);
      if (result.readyToSuggest) {
        void analytics.capture(oreliSuggestedEvent(guestToken, result));
      }
    } catch (err) {
      setSession(nextState);
      setResponse(null);
      setErrors([
        err instanceof GiftApiError
          ? err.message
          : "Une erreur inattendue est survenue.",
      ]);
    } finally {
      setLoading(false);
    }
  };

  const startConversation = async () => {
    const built = buildSessionState(form, guestToken, firstMessage);
    if (!built.ok) {
      setErrors(built.errors);
      return;
    }
    setSelected(null);
    void analytics.capture(giftSessionStartedEvent(built.state));
    await runTurn(built.state);
  };

  const sendMessage = async () => {
    if (session === null || draft.trim().length === 0) {
      return;
    }
    const nextState = appendMessage(session, "user", draft.trim());
    setDraft("");
    await runTurn(nextState);
  };

  const suggestions = useMemo<Product[]>(() => {
    if (response === null || !response.readyToSuggest) {
      return [];
    }
    if (response.mode === "surprise") {
      return response.surprise === null ? [] : [response.surprise];
    }
    return response.shortlist ?? [];
  }, [response]);

  return (
    <ScrollView
      className="flex-1 bg-ivory"
      contentContainerClassName="items-center gap-6 p-6"
      keyboardShouldPersistTaps="handled"
    >
      <StatusBar style="dark" />
      <View className="items-center gap-2">
        <Text className="font-emotional text-5xl text-navy">Oreli</Text>
        <Text className="font-functional text-base text-navy">
          Le cadeau juste, sans la charge mentale.
        </Text>
      </View>

      {session === null ? (
        <View className="w-full max-w-md gap-4">
          <View className="flex-row gap-3">
            <View className="flex-1 gap-1">
              <FieldLabel>Budget min (€)</FieldLabel>
              <TextInput
                className={INPUT_CLASS}
                value={form.budgetMin}
                onChangeText={(value) => setField("budgetMin", value)}
                keyboardType="numeric"
                placeholder="20"
                accessibilityLabel="Budget minimum en euros"
              />
            </View>
            <View className="flex-1 gap-1">
              <FieldLabel>Budget max (€)</FieldLabel>
              <TextInput
                className={INPUT_CLASS}
                value={form.budgetMax}
                onChangeText={(value) => setField("budgetMax", value)}
                keyboardType="numeric"
                placeholder="60"
                accessibilityLabel="Budget maximum en euros"
              />
            </View>
          </View>

          <View className="gap-1">
            <FieldLabel>Occasion</FieldLabel>
            <TextInput
              className={INPUT_CLASS}
              value={form.occasion}
              onChangeText={(value) => setField("occasion", value)}
              placeholder="anniversaire, crémaillère…"
              accessibilityLabel="Occasion"
            />
          </View>

          <View className="gap-1">
            <FieldLabel>Date (AAAA-MM-JJ)</FieldLabel>
            <TextInput
              className={INPUT_CLASS}
              value={form.eventDate}
              onChangeText={(value) => setField("eventDate", value)}
              placeholder="2026-12-24"
              accessibilityLabel="Date de l'événement"
            />
          </View>

          <View className="gap-1">
            <FieldLabel>Mode</FieldLabel>
            <View className="flex-row gap-3">
              {(["selection", "surprise"] as const).map((mode: GiftMode) => (
                <View key={mode} className="flex-1">
                  <Button
                    label={
                      mode === "selection"
                        ? "Sélection accompagnée"
                        : "Surprise"
                    }
                    variant={
                      form.mode === mode
                        ? mode === "surprise"
                          ? "celebration"
                          : "primary"
                        : "secondary"
                    }
                    onPress={() => setField("mode", mode)}
                  />
                </View>
              ))}
            </View>
          </View>

          <View className="gap-1">
            <FieldLabel>Pour qui ? (sans nom ni détail identifiant)</FieldLabel>
            <TextInput
              className={INPUT_CLASS}
              value={form.relationship}
              onChangeText={(value) => setField("relationship", value)}
              placeholder="une amie proche"
              accessibilityLabel="Type de relation"
            />
          </View>

          <View className="gap-1">
            <FieldLabel>Ses goûts (séparés par des virgules)</FieldLabel>
            <TextInput
              className={INPUT_CLASS}
              value={form.tastes}
              onChangeText={(value) => setField("tastes", value)}
              placeholder="thé, lecture, céramique"
              accessibilityLabel="Goûts"
            />
          </View>

          <View className="gap-1">
            <FieldLabel>Premier message à Oreli</FieldLabel>
            <TextInput
              className={INPUT_CLASS}
              value={firstMessage}
              onChangeText={setFirstMessage}
              placeholder="Je cherche un cadeau chaleureux et original."
              accessibilityLabel="Premier message à Oreli"
              multiline
            />
          </View>

          <Button
            label={loading ? "Oreli réfléchit…" : "Commencer avec Oreli"}
            variant="primary"
            disabled={loading}
            onPress={() => {
              void startConversation();
            }}
          />
        </View>
      ) : (
        <View className="w-full max-w-md gap-4">
          <View className="gap-3">
            {session.messages.map((message, index) => (
              <ConversationBubble
                key={`${message.role}-${index}`}
                author={message.role === "oreli" ? "oreli" : "guest"}
                message={message.content}
              />
            ))}
            {loading ? (
              <ConversationBubble author="oreli" message="Oreli réfléchit…" />
            ) : null}
          </View>

          {suggestions.length > 0 ? (
            <View className="gap-4">
              <Text className="font-emotional text-2xl text-navy">
                {response?.mode === "surprise"
                  ? "Votre surprise"
                  : "La sélection d'Oreli"}
              </Text>
              {suggestions.map((product) => (
                <View key={product.id} className="gap-2">
                  <ProductCard product={product} />
                  <Button
                    label={
                      selected?.id === product.id
                        ? "Choisi ✓"
                        : response?.mode === "surprise"
                          ? "Offrir cette surprise"
                          : "Choisir ce cadeau"
                    }
                    variant={
                      selected?.id === product.id ? "celebration" : "primary"
                    }
                    onPress={() => {
                      setSelected(product);
                      void analytics.capture(
                        giftSelectedEvent(guestToken, product),
                      );
                    }}
                  />
                </View>
              ))}
            </View>
          ) : null}

          {selected !== null ? (
            <View className="gap-3 rounded-2xl bg-gold/20 p-4">
              <Text className="font-emotional text-lg text-navy">
                Cadeau retenu : {selected.title}
              </Text>
              <Text className="font-functional text-sm text-navy/70">
                {formatAmount(selected.priceCents, selected.currency)} ·
                livraison où vous le souhaitez.
              </Text>

              <View className="gap-1">
                <FieldLabel>Nom du destinataire</FieldLabel>
                <TextInput
                  className={INPUT_CLASS}
                  value={delivery.name}
                  onChangeText={(value) => setDeliveryField("name", value)}
                  placeholder="Camille Dupont"
                  accessibilityLabel="Nom du destinataire"
                />
              </View>
              <View className="gap-1">
                <FieldLabel>Adresse</FieldLabel>
                <TextInput
                  className={INPUT_CLASS}
                  value={delivery.line1}
                  onChangeText={(value) => setDeliveryField("line1", value)}
                  placeholder="Rue des Brasseurs 12"
                  accessibilityLabel="Adresse de livraison"
                />
              </View>
              <View className="gap-1">
                <FieldLabel>Complément (optionnel)</FieldLabel>
                <TextInput
                  className={INPUT_CLASS}
                  value={delivery.line2}
                  onChangeText={(value) => setDeliveryField("line2", value)}
                  placeholder="Boîte 3"
                  accessibilityLabel="Complément d'adresse"
                />
              </View>
              <View className="flex-row gap-3">
                <View className="flex-1 gap-1">
                  <FieldLabel>Code postal</FieldLabel>
                  <TextInput
                    className={INPUT_CLASS}
                    value={delivery.postalCode}
                    onChangeText={(value) =>
                      setDeliveryField("postalCode", value)
                    }
                    placeholder="1000"
                    accessibilityLabel="Code postal"
                  />
                </View>
                <View className="flex-[2] gap-1">
                  <FieldLabel>Ville</FieldLabel>
                  <TextInput
                    className={INPUT_CLASS}
                    value={delivery.city}
                    onChangeText={(value) => setDeliveryField("city", value)}
                    placeholder="Bruxelles"
                    accessibilityLabel="Ville"
                  />
                </View>
              </View>
              <View className="gap-1">
                <FieldLabel>Date de livraison (AAAA-MM-JJ)</FieldLabel>
                <TextInput
                  className={INPUT_CLASS}
                  value={delivery.deliveryDate}
                  onChangeText={(value) =>
                    setDeliveryField("deliveryDate", value)
                  }
                  placeholder="2026-12-24"
                  accessibilityLabel="Date de livraison"
                />
              </View>

              <Button
                label={
                  paying
                    ? "Paiement en cours…"
                    : `Payer ${formatAmount(selected.priceCents, selected.currency)} (test)`
                }
                variant="celebration"
                disabled={paying}
                onPress={() => {
                  void payAndOrder();
                }}
              />
              <Text className="font-functional text-xs text-navy/50">
                Paiement Stripe en mode test : aucune carte réelle n'est débitée.
              </Text>
            </View>
          ) : null}

          {!loading ? (
            <View className="gap-2">
              <TextInput
                className={INPUT_CLASS}
                value={draft}
                onChangeText={setDraft}
                placeholder="Répondre à Oreli…"
                accessibilityLabel="Votre réponse à Oreli"
                multiline
              />
              <Button
                label="Envoyer"
                variant="primary"
                disabled={draft.trim().length === 0}
                onPress={() => {
                  void sendMessage();
                }}
              />
            </View>
          ) : null}
        </View>
      )}

      {errors.length > 0 ? (
        <View className="w-full max-w-md gap-1 rounded-2xl bg-coral/15 p-4">
          {errors.map((message, index) => (
            <Text
              key={`error-${index}`}
              className="font-functional text-sm text-coral"
            >
              {message}
            </Text>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}
