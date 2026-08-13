import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Le CLI (migrate, studio) a besoin d'une connexion directe, sans pooler
    url: process.env["DIRECT_URL"],
  },
});
