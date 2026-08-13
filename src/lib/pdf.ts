import "server-only";
import { PDFDocument, type PDFFont, type PDFPage, StandardFonts, rgb } from "pdf-lib";

const MARGE = 50;
const LARGEUR = 595.28; // A4 portrait, en points
const HAUTEUR = 841.89;
const INTERLIGNE = 16;

/**
 * Mise en page minimale pour les rapports texte/tableaux des exports
 * comptables (PROJET.md §4.4) : pdf-lib ne fournit que du dessin bas niveau
 * (texte positionné en x/y), donc gérer le curseur vertical et le saut de
 * page automatique évite de le refaire dans chaque route d'export.
 */
export class ConstructeurPdf {
  private page: PDFPage;
  private y: number;

  private constructor(
    private readonly doc: PDFDocument,
    private readonly police: PDFFont,
    private readonly policeGrasse: PDFFont,
  ) {
    this.page = doc.addPage([LARGEUR, HAUTEUR]);
    this.y = HAUTEUR - MARGE;
  }

  static async creer(titreDocument: string): Promise<ConstructeurPdf> {
    const doc = await PDFDocument.create();
    doc.setTitle(titreDocument);
    const police = await doc.embedFont(StandardFonts.Helvetica);
    const policeGrasse = await doc.embedFont(StandardFonts.HelveticaBold);
    return new ConstructeurPdf(doc, police, policeGrasse);
  }

  private nouvellePage() {
    this.page = this.doc.addPage([LARGEUR, HAUTEUR]);
    this.y = HAUTEUR - MARGE;
  }

  private assurerEspace(hauteur: number) {
    if (this.y - hauteur < MARGE) this.nouvellePage();
  }

  titre(texte: string) {
    this.assurerEspace(28);
    this.page.drawText(texte, {
      x: MARGE,
      y: this.y,
      size: 18,
      font: this.policeGrasse,
    });
    this.y -= 28;
  }

  sousTitre(texte: string) {
    this.assurerEspace(20);
    this.page.drawText(texte, {
      x: MARGE,
      y: this.y,
      size: 11,
      font: this.police,
      color: rgb(0.4, 0.4, 0.4),
    });
    this.y -= 20;
  }

  section(texte: string) {
    this.assurerEspace(30);
    this.y -= 8;
    this.page.drawText(texte, {
      x: MARGE,
      y: this.y,
      size: 13,
      font: this.policeGrasse,
    });
    this.y -= 18;
  }

  /** Une ligne « libellé … valeur », la valeur alignée à droite. */
  ligne(libelle: string, valeur: string, options?: { gras?: boolean }) {
    this.assurerEspace(INTERLIGNE);
    const taille = 10;
    const police = options?.gras ? this.policeGrasse : this.police;
    this.page.drawText(libelle, { x: MARGE, y: this.y, size: taille, font: police });
    const largeurValeur = police.widthOfTextAtSize(valeur, taille);
    this.page.drawText(valeur, {
      x: LARGEUR - MARGE - largeurValeur,
      y: this.y,
      size: taille,
      font: police,
    });
    this.y -= INTERLIGNE;
  }

  espace(hauteur = 10) {
    this.y -= hauteur;
  }

  async terminer(): Promise<Uint8Array> {
    return this.doc.save();
  }
}
