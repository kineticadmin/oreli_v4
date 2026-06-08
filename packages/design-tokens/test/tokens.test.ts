import { describe, expect, it } from "vitest";
import {
  palette,
  resolveColor,
  semanticColors,
  typography,
} from "../src/index";

describe("resolveColor", () => {
  it("résout l'action principale vers le corail", () => {
    expect(resolveColor("primaryAction")).toBe(palette.coral);
  });

  it("résout le moment d'IA vers la lavande", () => {
    expect(resolveColor("aiMoment")).toBe(palette.lavender);
  });

  it("résout la célébration vers l'or", () => {
    expect(resolveColor("celebration")).toBe(palette.gold);
  });
});

describe("tokens de base", () => {
  it("expose la palette navy / or / ivoire", () => {
    expect(palette.navy).toMatch(/^#/);
    expect(semanticColors.background).toBe(palette.ivory);
    expect(semanticColors.foreground).toBe(palette.navy);
  });

  it("définit les deux familles typographiques", () => {
    expect(typography.emotional).toBe("Playfair Display");
    expect(typography.functional).toBe("Inter");
  });
});
