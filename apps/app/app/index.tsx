import type {
  GiftConverseResponse,
  GiftMode,
  GiftSessionState,
  Product,
} from "@oreli/shared";
import { StatusBar } from "expo-status-bar";
import { useMemo, useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";

import { Button } from "../components/Button";
import { ConversationBubble } from "../components/ConversationBubble";
import { ProductCard } from "../components/ProductCard";
import { converseRequest, GiftApiError } from "../features/gift/api";
import {
  appendMessage,
  buildSessionState,
  createGuestToken,
  type GiftSetupForm,
} from "../features/gift/session";

/**
 * Écran conversationnel du parcours cadeau (SPEC-001 · T5).
 *
 * Trois temps : configuration (budget, occasion, date, mode, profil non
 * identifiant), dialogue avec Oreli, puis affichage de la short list ou de la
 * surprise et choix final. L'état de session vit côté client (la conversation
 * est sans état côté serveur dans cette tranche) et est renvoyé à chaque tour.
 *
 * Hors-scope T5 : le paiement (PaymentIntent Stripe) et la création de commande
 * relèvent de T6 ; ici, le « choix final » ne fait qu'enregistrer le produit
 * retenu et confirmer la sélection.
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

  const setField = (key: keyof GiftSetupForm, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  // Un tour de dialogue : envoie l'état à l'API, puis archive la réponse
  // d'Oreli dans l'historique. En cas d'échec, l'état utilisateur est conservé.
  const runTurn = async (nextState: GiftSessionState) => {
    setLoading(true);
    setErrors([]);
    try {
      const result = await converseRequest(nextState);
      setSession(appendMessage(nextState, "oreli", result.reply));
      setResponse(result);
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
                    onPress={() => setSelected(product)}
                  />
                </View>
              ))}
            </View>
          ) : null}

          {selected !== null ? (
            <View className="gap-1 rounded-2xl bg-gold/20 p-4">
              <Text className="font-emotional text-lg text-navy">
                Cadeau retenu : {selected.title}
              </Text>
              <Text className="font-functional text-sm text-navy/70">
                Le paiement sécurisé arrive à l'étape suivante.
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
