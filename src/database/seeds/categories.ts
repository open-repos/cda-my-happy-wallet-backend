import { Prisma } from "@prisma/client";

export const categories: Prisma.CategorieCreateInput[] = [
  { categorie: "Loisir" },
  { categorie: "Alimentation" },
  { categorie: "Imprevu" },
  { categorie: "Autres" },
];
