#!/usr/bin/env node
/*
 * Génère la liste des icônes de catégorie autorisées : l'intersection des
 * icônes Font Awesome 6 Free `solid` et `regular` disponibles à la fois sur le
 * Web (`@fortawesome/free-*-svg-icons`) et sur le mobile (`FontAwesome6` Free
 * de `@expo/vector-icons`). Les icônes `brands` et Pro sont exclues.
 *
 * Usage, depuis la racine du backend :
 *   node scripts/generate-category-icons.js [--frontend <dossier>] [--date AAAA-MM-JJ]
 *
 * `--frontend` désigne le checkout frontend dont les dépendances sont
 * installées (par défaut `../my-happy-wallet-frontend`).
 */
const fs = require("fs");
const path = require("path");

const OUTPUT = path.join(
  __dirname,
  "..",
  "src/modules/operations/domain/categoryIcons.json"
);

const argument = (name, fallback) => {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1];
};

const frontend = path.resolve(
  argument("--frontend", path.join(__dirname, "../../my-happy-wallet-frontend"))
);
const generatedAt = argument("--date", new Date().toISOString().slice(0, 10));
if (!/^\d{4}-\d{2}-\d{2}$/.test(generatedAt)) {
  throw new Error(`Invalid --date: ${generatedAt}`);
}

const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));

// Refuse un volume `node_modules` qui ne correspond plus au lockfile : la
// liste serait générée depuis d'autres versions que celles livrées.
const versionOf = (packageDir) => {
  const installed = readJson(path.join(packageDir, "package.json")).version;
  const project = packageDir.slice(0, packageDir.lastIndexOf("node_modules"));
  const key = path.relative(project, packageDir).split(path.sep).join("/");
  const locked = readJson(path.join(project, "package-lock.json")).packages[key]
    ?.version;
  if (installed !== locked) {
    throw new Error(
      `${key}: installed ${installed}, package-lock.json ${locked}. Run npm ci first.`
    );
  }
  return installed;
};

const webIcons = (packageName, exportName) => {
  const dir = path.join(frontend, "node_modules/@fortawesome", packageName);
  const icons = require(path.join(dir, "index.js"))[exportName];
  return {
    version: versionOf(dir),
    names: new Set(Object.values(icons).map((icon) => icon.iconName)),
  };
};

const mobileDir = path.join(frontend, "mobile/node_modules/@expo/vector-icons");
const mobileMeta = JSON.parse(
  fs.readFileSync(
    path.join(
      mobileDir,
      "build/vendor/react-native-vector-icons/glyphmaps/FontAwesome6Free_meta.json"
    ),
    "utf8"
  )
);

const solid = webIcons("free-solid-svg-icons", "fas");
const regular = webIcons("free-regular-svg-icons", "far");
const intersect = (web, mobile) =>
  mobile.filter((name) => web.has(name)).sort();

const result = {
  generatedAt,
  generator: "scripts/generate-category-icons.js",
  sources: {
    "@fortawesome/free-solid-svg-icons": solid.version,
    "@fortawesome/free-regular-svg-icons": regular.version,
    "@expo/vector-icons (FontAwesome6 Free)": versionOf(mobileDir),
  },
  solid: [...new Set(intersect(solid.names, mobileMeta.solid))],
  regular: [...new Set(intersect(regular.names, mobileMeta.regular))],
};

fs.writeFileSync(OUTPUT, `${JSON.stringify(result, null, 2)}\n`);
console.log(
  `${path.relative(process.cwd(), OUTPUT)}: ${result.solid.length} solid, ${
    result.regular.length
  } regular`
);
