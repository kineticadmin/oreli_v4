import { PrismaClient } from "@prisma/client";

/**
 * Client Prisma partagé (singleton paresseux). Il n'est instancié qu'au
 * premier accès réel à la base ; les tests injectent un dépôt en mémoire et
 * ne touchent donc jamais Prisma. `DATABASE_URL` est lue par Prisma depuis
 * `process.env` (SYSTEM.md : secrets via l'environnement, jamais en dur).
 */
let client: PrismaClient | null = null;

export function getPrismaClient(): PrismaClient {
  if (client === null) {
    client = new PrismaClient();
  }
  return client;
}
