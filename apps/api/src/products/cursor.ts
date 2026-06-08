/**
 * Curseur de pagination du catalogue (SYSTEM.md : pagination par curseur sur
 * `created_at` + `id`, jamais LIMIT/OFFSET).
 *
 * Le jeton exposé à l'extérieur est opaque : base64url de `<ISO>|<id>`.
 */
export interface ProductCursor {
  createdAt: Date;
  id: string;
}

/** Levée lorsqu'un jeton de curseur fourni par le client est illisible. */
export class InvalidCursorError extends Error {
  constructor(message = "Curseur de pagination invalide") {
    super(message);
    this.name = "InvalidCursorError";
  }
}

const SEPARATOR = "|";

/** Encode un curseur en jeton opaque. */
export function encodeCursor(cursor: ProductCursor): string {
  const raw = `${cursor.createdAt.toISOString()}${SEPARATOR}${cursor.id}`;
  return Buffer.from(raw, "utf8").toString("base64url");
}

/** Décode un jeton opaque, ou lève `InvalidCursorError` s'il est malformé. */
export function decodeCursor(token: string): ProductCursor {
  const raw = Buffer.from(token, "base64url").toString("utf8");
  const separatorIndex = raw.indexOf(SEPARATOR);
  if (separatorIndex <= 0) {
    throw new InvalidCursorError();
  }

  const isoPart = raw.slice(0, separatorIndex);
  const id = raw.slice(separatorIndex + 1);
  const createdAt = new Date(isoPart);

  if (id.length === 0 || Number.isNaN(createdAt.getTime())) {
    throw new InvalidCursorError();
  }

  return { createdAt, id };
}
