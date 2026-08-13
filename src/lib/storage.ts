import "server-only";

import { StorageClient } from "@supabase/storage-js";

/**
 * Stockage des justificatifs — PROJET.md sections 4.1 et 10.
 *
 * Le bucket est privé et on y accède avec la clé service_role : elle contourne
 * toutes les règles de sécurité Supabase, c'est pourquoi ce module est
 * `server-only` — l'importer depuis un composant client ferait échouer le
 * build, et c'est voulu. Personne ne voit un fichier sans passer par une URL
 * signée, générée ici après contrôle des permissions.
 */

const BUCKET_JUSTIFICATIFS = "justificatifs";

/** 10 Mo : assez pour une photo de téléphone, borne la facture de stockage. */
export const TAILLE_MAX_JUSTIFICATIF = 10 * 1024 * 1024;

/**
 * L'extension est déduite du type MIME plutôt que du nom du fichier : le nom
 * vient du navigateur et ne mérite aucune confiance.
 */
export const TYPES_JUSTIFICATIF: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

/**
 * Client du Storage seul, plutôt que le client Supabase complet : ce dernier
 * embarque un module temps réel (WebSocket) qui exige Node 22+ et dont on n'a
 * aucun usage — on ne fait que déposer et lire des fichiers.
 */
function clientStorage() {
  const url = process.env.SUPABASE_URL;
  const cleServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !cleServiceRole) {
    throw new Error(
      "SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent être définies dans .env",
    );
  }
  return new StorageClient(`${url}/storage/v1`, {
    apikey: cleServiceRole,
    Authorization: `Bearer ${cleServiceRole}`,
  });
}

/**
 * Téléverse un justificatif et retourne son chemin dans le bucket.
 *
 * Le chemin commence par l'identifiant de l'entreprise : c'est le pendant
 * côté stockage du `organizationId` que porte chaque table (PROJET.md §7) —
 * l'isolation des tenants se lit dans l'arborescence elle-même. Le nom est un
 * UUID : pas de collision, et aucun nom de fichier utilisateur à assainir.
 */
export async function televerserJustificatif(params: {
  organizationId: string;
  fichier: File;
}): Promise<string> {
  const extension = TYPES_JUSTIFICATIF[params.fichier.type];
  if (!extension) {
    throw new Error(`Type de fichier refusé : ${params.fichier.type}`);
  }

  const chemin = `${params.organizationId}/${crypto.randomUUID()}.${extension}`;

  const { error } = await clientStorage()
    .from(BUCKET_JUSTIFICATIFS)
    .upload(chemin, params.fichier, { contentType: params.fichier.type });

  if (error) {
    throw new Error(`Téléversement du justificatif impossible : ${error.message}`);
  }

  return chemin;
}

/** Durée de vie courte : l'URL est régénérée à chaque consultation. */
const VALIDITE_URL_SECONDES = 60 * 10;

/**
 * URL signée temporaire vers un justificatif du bucket privé.
 *
 * À n'appeler qu'après avoir vérifié que la personne a le droit de voir la
 * dépense correspondante : l'URL, elle, est utilisable par quiconque la
 * détient jusqu'à expiration.
 */
export async function creerUrlSigneeJustificatif(
  chemin: string,
): Promise<string> {
  const { data, error } = await clientStorage()
    .from(BUCKET_JUSTIFICATIFS)
    .createSignedUrl(chemin, VALIDITE_URL_SECONDES);

  if (error || !data) {
    throw new Error(
      `URL signée impossible pour ce justificatif : ${error?.message}`,
    );
  }

  return data.signedUrl;
}

/**
 * Supprime un justificatif du bucket. Utilisé quand l'enregistrement en base
 * échoue après un téléversement réussi : sans ce nettoyage, le fichier
 * deviendrait orphelin — présent dans le bucket, invisible dans l'application.
 */
export async function supprimerJustificatif(chemin: string): Promise<void> {
  await clientStorage().from(BUCKET_JUSTIFICATIFS).remove([chemin]);
}
