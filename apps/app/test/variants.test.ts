import { describe, expect, it } from "vitest";

import {
  bubbleContainerClassName,
  bubbleTextClassName,
  buttonContainerClassName,
  buttonLabelClassName,
  formatPriceLabel,
} from "../components/variants";

describe("buttonContainerClassName", () => {
  it("applique le corail à l'action principale", () => {
    expect(buttonContainerClassName("primary")).toContain("bg-coral");
  });

  it("applique l'or aux moments de célébration", () => {
    expect(buttonContainerClassName("celebration")).toContain("bg-gold");
  });

  it("rend la variante secondaire sans fond plein", () => {
    const className = buttonContainerClassName("secondary");
    expect(className).toContain("border-navy");
    expect(className).toContain("bg-transparent");
  });

  it("atténue le bouton désactivé", () => {
    expect(buttonContainerClassName("primary", true)).toContain("opacity-40");
    expect(buttonContainerClassName("primary", false)).not.toContain(
      "opacity-40",
    );
  });
});

describe("buttonLabelClassName", () => {
  it("écrit le libellé primaire en ivoire", () => {
    expect(buttonLabelClassName("primary")).toContain("text-ivory");
  });

  it("écrit le libellé secondaire en navy", () => {
    expect(buttonLabelClassName("secondary")).toContain("text-navy");
  });
});

describe("bubbleContainerClassName", () => {
  it("place Oreli à gauche sur fond lavande (moment d'IA)", () => {
    const className = bubbleContainerClassName("oreli");
    expect(className).toContain("self-start");
    expect(className).toContain("bg-lavender");
  });

  it("place l'invité à droite sur fond navy", () => {
    const className = bubbleContainerClassName("guest");
    expect(className).toContain("self-end");
    expect(className).toContain("bg-navy");
  });
});

describe("bubbleTextClassName", () => {
  it("contraste le texte selon l'auteur", () => {
    expect(bubbleTextClassName("oreli")).toContain("text-navy");
    expect(bubbleTextClassName("guest")).toContain("text-ivory");
  });
});

describe("formatPriceLabel", () => {
  it("met en forme les centimes en euros", () => {
    const label = formatPriceLabel(4500, "EUR");
    expect(label).toContain("45");
    expect(label).toContain("€");
  });

  it("gère les montants avec décimales", () => {
    const label = formatPriceLabel(1299, "EUR");
    expect(label).toContain("12");
    expect(label).toContain("99");
  });
});
