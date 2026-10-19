import assert from "assert";
import { PrismaClient } from "@prisma/client";

const url = process.env.DATABASE_URL ?? "";
if (
  process.env.NODE_ENV !== "test" ||
  !url.includes("my-happy-wallet-mysql-test") ||
  !url.includes("myhappywallet_test")
)
  throw new Error(
    "Simulation migration tests require the disposable test database"
  );
const prisma = new PrismaClient();
const email = "simulation-migration@example.test";
const timestamp = new Date("2026-01-31T12:34:56.000Z");
const prepare = async () => {
  await prisma.utilisateur.deleteMany({ where: { email } });
  assert.strictEqual(
    await prisma.evenementMensuel.count({ where: { status: "POTENTIEL" } }),
    0,
    "No potential events may exist when rehearsing the legacy schema"
  );
  const user = await prisma.utilisateur.create({
    data: {
      email,
      firstname: "Legacy",
      lastname: "Simulation",
      password: "test-only",
    },
  });
  await prisma.evenementMensuel.create({
    data: {
      userId: user.id,
      title: "Legacy event",
      amount: "42.50",
      currency: "EUR",
      kind: "ENTREE",
      recurrence: "ANNUELLE",
      startDate: new Date("2026-01-31T00:00:00Z"),
      endDate: new Date("2028-01-31T00:00:00Z"),
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  });
  await prisma.$executeRawUnsafe(
    "DROP INDEX `EvenementMensuel_userId_status_startDate_id_idx` ON `EvenementMensuel`"
  );
  await prisma.$executeRawUnsafe(
    "ALTER TABLE `EvenementMensuel` DROP COLUMN `status`"
  );
  await prisma.$executeRaw`DELETE FROM _prisma_migrations WHERE migration_name = '20261019180000_add_event_simulation'`;
};
const verify = async () => {
  const user = await prisma.utilisateur.findUniqueOrThrow({ where: { email } });
  const event = await prisma.evenementMensuel.findFirstOrThrow({
    where: { userId: user.id },
  });
  assert.strictEqual(event.status, "CONFIRME");
  assert.strictEqual(event.title, "Legacy event");
  assert.strictEqual(event.amount.toFixed(2), "42.50");
  assert.strictEqual(event.currency, "EUR");
  assert.strictEqual(event.kind, "ENTREE");
  assert.strictEqual(event.recurrence, "ANNUELLE");
  assert.strictEqual(event.startDate.toISOString().slice(0, 10), "2026-01-31");
  assert.strictEqual(event.endDate?.toISOString().slice(0, 10), "2028-01-31");
  assert.strictEqual(event.createdAt.toISOString(), timestamp.toISOString());
  assert.strictEqual(event.updatedAt.toISOString(), timestamp.toISOString());
  const columns = await prisma.$queryRaw<
    { COLUMN_TYPE: string; COLUMN_DEFAULT: string }[]
  >`SELECT COLUMN_TYPE, COLUMN_DEFAULT FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'EvenementMensuel' AND COLUMN_NAME = 'status'`;
  assert.strictEqual(columns[0].COLUMN_TYPE, "enum('CONFIRME','POTENTIEL')");
  assert.strictEqual(columns[0].COLUMN_DEFAULT, "CONFIRME");
  await prisma.evenementMensuel.create({
    data: {
      userId: user.id,
      title: "Potential",
      amount: "1.00",
      currency: "EUR",
      startDate: new Date("2026-10-31T00:00:00Z"),
      status: "POTENTIEL",
    },
  });
  await prisma.utilisateur.delete({ where: { id: user.id } });
};
const phase = process.argv[2];
if (phase !== "prepare" && phase !== "verify")
  throw new Error("Expected prepare or verify");
(phase === "prepare" ? prepare() : verify())
  .finally(() => prisma.$disconnect())
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
