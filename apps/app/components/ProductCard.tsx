import type { Product } from "@oreli/shared";
import { Image, Text, View } from "react-native";

import { formatPriceLabel } from "./variants";

export type ProductCardProps = {
  product: Pick<
    Product,
    "title" | "description" | "priceCents" | "currency" | "imageUrl" | "inStock"
  >;
};

/**
 * Carte produit du catalogue (NativeWind). Titre en typographie émotionnelle
 * (Playfair), corps en typographie fonctionnelle (Inter), prix mis en forme en
 * locale belge. Une pastille signale les produits épuisés.
 */
export function ProductCard({ product }: ProductCardProps) {
  return (
    <View className="overflow-hidden rounded-3xl bg-ivory shadow-sm">
      <Image
        accessibilityIgnoresInvertColors
        source={{ uri: product.imageUrl }}
        className="h-48 w-full bg-lavender"
        resizeMode="cover"
      />
      <View className="gap-2 p-4">
        <Text
          className="font-emotional text-xl text-navy"
          numberOfLines={2}
        >
          {product.title}
        </Text>
        <Text
          className="font-functional text-sm text-navy/70"
          numberOfLines={3}
        >
          {product.description}
        </Text>
        <View className="flex-row items-center justify-between pt-1">
          <Text className="font-functional text-lg font-semibold text-navy">
            {formatPriceLabel(product.priceCents, product.currency)}
          </Text>
          {!product.inStock ? (
            <Text className="font-functional text-xs uppercase tracking-wide text-coral">
              Épuisé
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}
