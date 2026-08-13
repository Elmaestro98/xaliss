import "server-only";

import { GoogleGenAI, Type } from "@google/genai";
import * as z from "zod";

/**
 * OCR des reçus par l'API Gemini (palier gratuit) — PROJET.md §9.
 *
 * L'image part en base64 vers Gemini vision, contraint par un schéma de
 * sortie JSON : la forme de la réponse est garantie par l'API, puis revérifiée
 * ici avec zod — deux ceintures, car ce JSON alimentera un formulaire et
 * l'audit. Le résultat ne fait que PRÉ-REMPLIR le formulaire : la validation
 * humaine reste obligatoire, et `confidence` est archivé dans Receipt.
 */
export const SchemaExtractionRecu = z.object({
  amount: z.number().int().nullable(),
  currency: z.string().nullable(),
  date: z.string().nullable(),
  supplier: z.string().nullable(),
  suggestedCategory: z.string().nullable(),
  confidence: z.number().min(0).max(1),
});

export type ExtractionRecu = z.infer<typeof SchemaExtractionRecu>;

/** Le même schéma, au format attendu par Gemini (structured output). */
const SCHEMA_GEMINI = {
  type: Type.OBJECT,
  properties: {
    amount: {
      type: Type.INTEGER,
      nullable: true,
      description:
        "Montant total TTC en valeur entière, sans centimes. null si illisible.",
    },
    currency: {
      type: Type.STRING,
      nullable: true,
      description:
        "Devise telle qu'affichée sur le reçu (FCFA, XOF, EUR…). null si absente.",
    },
    date: {
      type: Type.STRING,
      nullable: true,
      description: "Date du reçu au format AAAA-MM-JJ. null si illisible.",
    },
    supplier: {
      type: Type.STRING,
      nullable: true,
      description: "Nom du commerçant ou fournisseur. null si illisible.",
    },
    suggestedCategory: {
      type: Type.STRING,
      nullable: true,
      description:
        "Nom EXACT d'une catégorie de la liste fournie, ou null si aucune ne convient.",
    },
    confidence: {
      type: Type.NUMBER,
      description: "Confiance globale de l'extraction entre 0 et 1.",
    },
  },
  required: [
    "amount",
    "currency",
    "date",
    "supplier",
    "suggestedCategory",
    "confidence",
  ],
};

export async function extraireDonneesRecu(params: {
  fichier: File;
  nomsCategories: string[];
}): Promise<ExtractionRecu> {
  const cle = process.env.GEMINI_API_KEY;
  if (!cle) {
    throw new Error("GEMINI_API_KEY doit être définie dans .env");
  }
  const client = new GoogleGenAI({ apiKey: cle });

  const base64 = Buffer.from(await params.fichier.arrayBuffer()).toString(
    "base64",
  );

  const reponse = await client.models.generateContent({
    // L'alias « latest » suit les mises à jour de Google : les noms datés
    // finissent retirés pour les nouveaux comptes (vécu avec 2.5-flash).
    model: "gemini-flash-latest",
    contents: [
      {
        role: "user",
        parts: [
          // Gemini accepte images et PDF par le même bloc inlineData.
          { inlineData: { mimeType: params.fichier.type, data: base64 } },
          {
            text:
              "Voici le justificatif d'une dépense d'entreprise au Sénégal " +
              "(reçu, facture ou ticket de caisse). Extrais-en les informations " +
              "demandées. Les montants sont le plus souvent en FCFA. " +
              "Pour suggestedCategory, choisis le nom exact le plus pertinent " +
              "parmi ces catégories comptables : " +
              params.nomsCategories.join(", ") +
              ". Si une information est absente ou illisible, mets null — " +
              "n'invente jamais.",
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: SCHEMA_GEMINI,
    },
  });

  const texte = reponse.text;
  if (!texte) {
    throw new Error("L'extraction OCR n'a pas produit de résultat exploitable.");
  }

  const resultat = SchemaExtractionRecu.safeParse(JSON.parse(texte));
  if (!resultat.success) {
    throw new Error("Réponse OCR inattendue : " + z.prettifyError(resultat.error));
  }

  return resultat.data;
}
