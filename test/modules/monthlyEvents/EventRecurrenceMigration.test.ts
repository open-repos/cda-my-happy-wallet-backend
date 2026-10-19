import assert from "assert";
import { PrismaClient } from "@prisma/client";

const url = process.env.DATABASE_URL ?? "";
if (
  process.env.NODE_ENV !== "test" ||
  !url.includes("my-happy-wallet-mysql-test") ||
  !url.includes("myhappywallet_test")
) {
  throw new Error(
    "Recurrence migration tests require the disposable test database."
  );
}
const phase = process.argv[2];
if (phase !== "prepare" && phase !== "verify")
  throw new Error("Expected prepare or verify");
const prisma = new PrismaClient();
const email = "recurrence-migration@example.test";
const migration = "20261019113000_extend_event_recurrence";
const timestamp = new Date("2024-01-31T12:34:56.000Z");
const prepare = async () => {
  await prisma.utilisateur.deleteMany({ where: { email } });
  const count = await prisma.evenementMensuel.count({
    where: { recurrence: { notIn: ["AUCUNE", "MENSUELLE"] } },
  });
  assert.strictEqual(
    count,
    0,
    "Legacy-schema rehearsal requires no new recurrence values"
  );
  await prisma.$executeRawUnsafe(
    "ALTER TABLE `EvenementMensuel` MODIFY `recurrence` ENUM('AUCUNE', 'MENSUELLE') NOT NULL DEFAULT 'AUCUNE'"
  );
  await prisma.$executeRaw`DELETE FROM _prisma_migrations WHERE migration_name = ${migration}`;
  const user = await prisma.utilisateur.create({
    data: {
      email,
      firstname: "Legacy",
      lastname: "Recurrence",
      password: "test-only",
    },
  });
  for (const recurrence of ["AUCUNE", "MENSUELLE"] as const)
    await prisma.evenementMensuel.create({
      data: {
        userId: user.id,
        title: recurrence,
        recurrence,
        amount: "10.01",
        currency: "EUR",
        kind: "DEPENSE",
        startDate: new Date("2024-01-31T00:00:00.000Z"),
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    });
};
const verify = async () => {
  const user = await prisma.utilisateur.findUniqueOrThrow({ where: { email } });
  const events = await prisma.evenementMensuel.findMany({
    where: { userId: user.id },
    orderBy: { id: "asc" },
  });
  assert.deepStrictEqual(
    events.map((event) => event.recurrence),
    ["AUCUNE", "MENSUELLE"]
  );
  for (const event of events) {
    assert.strictEqual(event.title, event.recurrence);
    assert.strictEqual(event.amount.toFixed(2), "10.01");
    assert.strictEqual(event.createdAt.toISOString(), timestamp.toISOString());
    assert.strictEqual(event.updatedAt.toISOString(), timestamp.toISOString());
    assert.strictEqual(
      event.startDate.toISOString().slice(0, 10),
      "2024-01-31"
    );
  }
  const columns = await prisma.$queryRaw<
    { COLUMN_TYPE: string; COLUMN_DEFAULT: string }[]
  >`
    SELECT COLUMN_TYPE, COLUMN_DEFAULT FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'EvenementMensuel' AND COLUMN_NAME = 'recurrence'`;
  assert.strictEqual(
    columns[0].COLUMN_TYPE,
    "enum('AUCUNE','MENSUELLE','HEBDOMADAIRE','TRIMESTRIELLE','ANNUELLE')"
  );
  assert.strictEqual(columns[0].COLUMN_DEFAULT, "AUCUNE");
  for (const recurrence of [
    "HEBDOMADAIRE",
    "TRIMESTRIELLE",
    "ANNUELLE",
  ] as const)
    await prisma.evenementMensuel.create({
      data: {
        userId: user.id,
        title: recurrence,
        recurrence,
        amount: "1.00",
        currency: "EUR",
        startDate: new Date("2024-01-31T00:00:00.000Z"),
      },
    });
  await prisma.utilisateur.delete({ where: { id: user.id } });
};
(phase === "prepare" ? prepare() : verify())
  .finally(() => prisma.$disconnect())
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
