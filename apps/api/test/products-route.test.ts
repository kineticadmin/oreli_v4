import { API_PREFIX, productsPageSchema } from "@oreli/shared";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { makeInMemoryRepository, makeRecord } from "./helpers";

function appWithProducts(count: number) {
  const records = Array.from({ length: count }, (_, index) =>
    makeRecord({
      id: `p-${String(index).padStart(2, "0")}`,
      createdAt: new Date(2026, 5, 1 + index),
    }),
  );
  return createApp({ productRepository: makeInMemoryRepository(records) });
}

describe("GET /api/v1/products", () => {
  it("renvoie une page conforme au schéma", async () => {
    const app = appWithProducts(3);
    const res = await app.request(`${API_PREFIX}/products`);

    expect(res.status).toBe(200);
    const parsed = productsPageSchema.parse(await res.json());
    expect(parsed.items).toHaveLength(3);
    expect(parsed.nextCursor).toBeNull();
  });

  it("pagine via le curseur renvoyé", async () => {
    const app = appWithProducts(5);

    const firstRes = await app.request(`${API_PREFIX}/products?limit=2`);
    const first = productsPageSchema.parse(await firstRes.json());
    expect(first.items).toHaveLength(2);
    expect(first.nextCursor).not.toBeNull();

    const secondRes = await app.request(
      `${API_PREFIX}/products?limit=2&cursor=${encodeURIComponent(
        first.nextCursor ?? "",
      )}`,
    );
    const second = productsPageSchema.parse(await secondRes.json());
    expect(second.items).toHaveLength(2);

    const firstIds = new Set(first.items.map((p) => p.id));
    for (const item of second.items) {
      expect(firstIds.has(item.id)).toBe(false);
    }
  });

  it("rejette un `limit` hors bornes avec une ApiError 400", async () => {
    const app = appWithProducts(3);
    const res = await app.request(`${API_PREFIX}/products?limit=0`);

    expect(res.status).toBe(400);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("validation_error");
  });

  it("rejette un `limit` non numérique avec une ApiError 400", async () => {
    const app = appWithProducts(3);
    const res = await app.request(`${API_PREFIX}/products?limit=abc`);

    expect(res.status).toBe(400);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("validation_error");
  });

  it("rejette un curseur illisible avec une ApiError 400", async () => {
    const app = appWithProducts(3);
    const res = await app.request(
      `${API_PREFIX}/products?cursor=jeton-invalide`,
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("invalid_cursor");
  });
});
