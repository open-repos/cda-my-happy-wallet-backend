import { Prisma, PrismaClient } from "@prisma/client";

export const potentialCutoff = (today: string): Date => {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(today) ||
    new Date(`${today}T00:00:00.000Z`).toISOString().slice(0, 10) !== today
  )
    throw new Error("INVALID_REFERENCE_DATE");
  return new Date(`${today.slice(0, 7)}-01T00:00:00.000Z`);
};

/** Lock rules before removing their historical resolutions; confirmation uses the same row locks. */
export const deletePotentialEvents = async (
  prisma: PrismaClient,
  ownerId: number,
  filter: { before?: Date; id?: number } = {}
): Promise<number> =>
  prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ id: number }[]>(Prisma.sql`
    SELECT id FROM EvenementMensuel
    WHERE userId = ${ownerId} AND status = 'POTENTIEL'
      ${
        filter.before === undefined
          ? Prisma.empty
          : Prisma.sql`AND startDate < ${filter.before}`
      }
      ${
        filter.id === undefined
          ? Prisma.empty
          : Prisma.sql`AND id = ${filter.id}`
      }
    ORDER BY id FOR UPDATE
  `);
    if (rows.length === 0) return 0;
    const ids = rows.map((row) => row.id);
    await tx.eventOccurrenceResolution.deleteMany({
      where: { userId: ownerId, sourceEventId: { in: ids } },
    });
    return (
      await tx.evenementMensuel.deleteMany({
        where: { userId: ownerId, status: "POTENTIEL", id: { in: ids } },
      })
    ).count;
  });

export const expirePotentialEvents = (
  prisma: PrismaClient,
  ownerId: number,
  today: string
): Promise<number> =>
  deletePotentialEvents(prisma, ownerId, { before: potentialCutoff(today) });
