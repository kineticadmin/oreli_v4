import { describe, expect, it } from "vitest";
import {
  decodeCursor,
  encodeCursor,
  InvalidCursorError,
} from "../src/products/cursor";

describe("encodeCursor / decodeCursor", () => {
  it("fait un aller-retour fidèle", () => {
    const cursor = {
      createdAt: new Date("2026-06-08T10:30:00.000Z"),
      id: "produit-42",
    };
    const decoded = decodeCursor(encodeCursor(cursor));
    expect(decoded.id).toBe(cursor.id);
    expect(decoded.createdAt.toISOString()).toBe(cursor.createdAt.toISOString());
  });

  it("produit un jeton opaque (ni la date ni l'id en clair)", () => {
    const token = encodeCursor({
      createdAt: new Date("2026-06-08T10:30:00.000Z"),
      id: "produit-42",
    });
    expect(token).not.toContain("produit-42");
    expect(token).not.toContain("2026");
  });

  it("rejette un jeton sans séparateur", () => {
    const token = Buffer.from("pas-de-separateur", "utf8").toString("base64url");
    expect(() => decodeCursor(token)).toThrow(InvalidCursorError);
  });

  it("rejette un jeton dont la date est invalide", () => {
    const token = Buffer.from("pas-une-date|produit-1", "utf8").toString(
      "base64url",
    );
    expect(() => decodeCursor(token)).toThrow(InvalidCursorError);
  });

  it("rejette un jeton dont l'id est vide", () => {
    const token = Buffer.from("2026-06-08T10:30:00.000Z|", "utf8").toString(
      "base64url",
    );
    expect(() => decodeCursor(token)).toThrow(InvalidCursorError);
  });
});
