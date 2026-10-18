import assert from "assert";
import { PrismaClient } from "@prisma/client";

const databaseUrl = process.env.DATABASE_URL || "";
const phase = process.argv[2];
const migration = "20261017120000_add_operation_category_icon";
const email = "category-icon-migration@example.test";

if (
  !databaseUrl.includes("myhappywallet_test") ||
  !databaseUrl.includes("my-happy-wallet-mysql-test")
) {
  throw new Error(
    "Category icon migration tests require the disposable test database."
  );
}
if (phase !== "prepare" && phase !== "verify") {
  throw new Error("Expected migration test phase: prepare or verify");
}

const prisma = new PrismaClient();

const prepare = async () => {
  await prisma.utilisateur.deleteMany({ where: { email } });
  const user = await prisma.utilisateur.create({
    data: {
      firstname: "Icon",
      lastname: "Migration",
      email,
      password: "not-a-real-password",
    },
  });
  await prisma.$executeRawUnsafe(
    "ALTER TABLE `OperationCategory` DROP COLUMN `icon`"
  );
  await prisma.$executeRawUnsafe(
    "DELETE FROM `_prisma_migrations` WHERE `migration_name` = ?",
    migration
  );
  await prisma.$executeRawUnsafe(
    "INSERT INTO `OperationCategory` (`name`, `color`, `userId`, `updatedAt`) VALUES ('Avant icône', '#336699', ?, NOW())",
    user.id
  );
};

const verify = async () => {
  const user = await prisma.utilisateur.findUniqueOrThrow({ where: { email } });
  const category = await prisma.operationCategory.findFirstOrThrow({
    where: { userId: user.id, name: "Avant icône" },
  });
  // Une catégorie existante garde sa pastille de couleur, sans icône.
  assert.strictEqual(category.icon, null);
  assert.strictEqual(category.color, "#336699");
  const updated = await prisma.operationCategory.update({
    where: { id: category.id },
    data: { icon: "regular:heart" },
  });
  assert.strictEqual(updated.icon, "regular:heart");
  await prisma.utilisateur.delete({ where: { id: user.id } });
};

(phase === "prepare" ? prepare : verify)()
  .finally(async () => prisma.$disconnect())
  .catch((error) => {
    throw error;
  });
