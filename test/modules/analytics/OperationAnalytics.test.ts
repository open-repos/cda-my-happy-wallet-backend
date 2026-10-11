import assert from "assert";
import {
  AnalyticsQuery,
  AnalyticsRow,
  OperationAnalyticsError,
  assembleAnalytics,
  assertPointBudget,
  temporalKeys,
  validateAnalyticsRange,
} from "../../../src/modules/analytics/domain";

const query = (overrides: Partial<AnalyticsQuery> = {}): AnalyticsQuery => ({
  from: "2026-10-01",
  to: "2026-10-31",
  currency: "EUR",
  groupBy: "month",
  splitBy: null,
  kind: null,
  ...overrides,
});

const tooLarge = (action: () => unknown, label: string) =>
  assert.throws(
    action,
    (error: unknown) =>
      error instanceof OperationAnalyticsError &&
      error.code === "ANALYTICS_RANGE_TOO_LARGE",
    label
  );

// Clés temporelles complètes, bornes incluses.
assert.deepStrictEqual(
  temporalKeys(query({ groupBy: "day", from: "2028-02-27", to: "2028-03-01" })),
  ["2028-02-27", "2028-02-28", "2028-02-29", "2028-03-01"]
);
assert.deepStrictEqual(
  temporalKeys(query({ groupBy: "day", from: "2027-02-27", to: "2027-03-01" })),
  ["2027-02-27", "2027-02-28", "2027-03-01"]
);
// Semaines ISO libellées par leur lundi, y compris à cheval sur deux années.
assert.deepStrictEqual(
  temporalKeys(
    query({ groupBy: "week", from: "2026-12-30", to: "2027-01-12" })
  ),
  ["2026-12-28", "2027-01-04", "2027-01-11"]
);
// Un dimanche appartient à la semaine du lundi précédent.
assert.deepStrictEqual(
  temporalKeys(
    query({ groupBy: "week", from: "2026-10-11", to: "2026-10-11" })
  ),
  ["2026-10-05"]
);
assert.deepStrictEqual(
  temporalKeys(
    query({ groupBy: "month", from: "2026-11-30", to: "2027-02-01" })
  ),
  ["2026-11", "2026-12", "2027-01", "2027-02"]
);
assert.deepStrictEqual(
  temporalKeys(
    query({ groupBy: "year", from: "2025-12-31", to: "2027-01-01" })
  ),
  ["2025", "2026", "2027"]
);
assert.deepStrictEqual(temporalKeys(query({ groupBy: "category" })), []);

// Bornes de volume par granularité.
validateAnalyticsRange(
  query({ groupBy: "day", from: "2028-01-01", to: "2028-12-31" })
);
tooLarge(
  () =>
    validateAnalyticsRange(
      query({ groupBy: "day", from: "2027-01-01", to: "2028-01-02" })
    ),
  "367 jours"
);
validateAnalyticsRange(
  query({ groupBy: "month", from: "2017-01-01", to: "2026-12-31" })
);
tooLarge(
  () =>
    validateAnalyticsRange(
      query({ groupBy: "month", from: "2016-12-31", to: "2026-12-31" })
    ),
  "121 mois"
);
tooLarge(
  () =>
    validateAnalyticsRange(
      query({ groupBy: "category", from: "2016-12-31", to: "2026-12-31" })
    ),
  "catégories sur 121 mois"
);
validateAnalyticsRange(
  query({ groupBy: "year", from: "1997-01-01", to: "2026-12-31" })
);
tooLarge(
  () =>
    validateAnalyticsRange(
      query({ groupBy: "year", from: "1996-12-31", to: "2026-12-31" })
    ),
  "31 ans"
);
tooLarge(
  () =>
    validateAnalyticsRange(
      query({ groupBy: "week", from: "2024-01-01", to: "2027-01-04" })
    ),
  "158 semaines"
);
assert.throws(
  () => validateAnalyticsRange(query({ from: "2026-10-02", to: "2026-10-01" })),
  (error: unknown) =>
    error instanceof OperationAnalyticsError &&
    error.code === "ANALYTICS_QUERY_INVALID"
);
tooLarge(() => assertPointBudget(167, 3), "501 points");
assertPointBudget(500, 1);
assertPointBudget(250, 2);

// Assemblage temporel : zéros, centimes exacts, solde signé.
const rows: AnalyticsRow[] = [
  { bucket: "2026-10", series: null, kind: "DEPENSE", cents: 1000, count: 2 },
  { bucket: "2026-10", series: null, kind: "DEPENSE", cents: 1, count: 1 },
  { bucket: "2026-10", series: null, kind: "ENTREE", cents: 250, count: 1 },
  {
    bucket: "2026-12",
    series: null,
    kind: "ENTREE",
    cents: 999999999,
    count: 1,
  },
];
const monthly = assembleAnalytics(
  query({ from: "2026-10-01", to: "2026-12-31" }),
  rows,
  []
);
assert.deepStrictEqual(monthly.buckets, [
  {
    key: "2026-10",
    label: null,
    color: null,
    income: "2.50",
    expense: "10.01",
    net: "-7.51",
    count: 4,
  },
  {
    key: "2026-11",
    label: null,
    color: null,
    income: "0.00",
    expense: "0.00",
    net: "0.00",
    count: 0,
  },
  {
    key: "2026-12",
    label: null,
    color: null,
    income: "9999999.99",
    expense: "0.00",
    net: "9999999.99",
    count: 1,
  },
]);

// Ventilation par catégorie : toutes les séries présentes dans chaque seau.
const categories = [
  { id: 4, name: "Alimentation", color: "#55AA22" },
  { id: 7, name: "Loisirs", color: null },
];
const split = assembleAnalytics(
  query({
    from: "2026-09-01",
    to: "2026-10-31",
    splitBy: "category",
    kind: "DEPENSE",
  }),
  [
    { bucket: "2026-09", series: "7", kind: "DEPENSE", cents: 4000, count: 1 },
    { bucket: "2026-10", series: "4", kind: "DEPENSE", cents: 1250, count: 2 },
  ],
  categories
);
assert.deepStrictEqual(
  split.buckets.map((bucket) =>
    bucket.series!.map((serie) => [serie.key, serie.label, serie.expense])
  ),
  // Séries triées par volume sur la période : Loisirs (40 €) avant Alimentation.
  [
    [
      ["7", "Loisirs", "40.00"],
      ["4", "Alimentation", "0.00"],
    ],
    [
      ["7", "Loisirs", "0.00"],
      ["4", "Alimentation", "12.50"],
    ],
  ]
);
assert.strictEqual(split.buckets[1].expense, "12.50");
assert.strictEqual(split.buckets[1].series![1].color, "#55AA22");

// Regroupement par catégorie : seaux présents, triés par volume décroissant.
const byCategory = assembleAnalytics(
  query({ groupBy: "category" }),
  [
    { bucket: "4", series: null, kind: "DEPENSE", cents: 500, count: 1 },
    { bucket: "7", series: null, kind: "DEPENSE", cents: 900, count: 3 },
    { bucket: "7", series: null, kind: "ENTREE", cents: 100, count: 1 },
  ],
  categories
);
assert.deepStrictEqual(
  byCategory.buckets.map((bucket) => [bucket.key, bucket.label, bucket.net]),
  [
    ["7", "Loisirs", "-8.00"],
    ["4", "Alimentation", "-5.00"],
  ]
);

// Regroupement par type : seaux du filtre, même vides.
assert.deepStrictEqual(
  assembleAnalytics(query({ groupBy: "kind" }), [], []).buckets.map(
    (bucket) => bucket.key
  ),
  ["DEPENSE", "ENTREE"]
);
assert.deepStrictEqual(
  assembleAnalytics(
    query({ groupBy: "kind", kind: "ENTREE" }),
    [],
    []
  ).buckets.map((bucket) => bucket.key),
  ["ENTREE"]
);

// Une ventilation trop large est refusée après lecture des séries.
tooLarge(
  () =>
    assembleAnalytics(
      query({
        groupBy: "day",
        from: "2026-01-01",
        to: "2026-12-31",
        splitBy: "kind",
      }),
      [
        {
          bucket: "2026-01-01",
          series: "DEPENSE",
          kind: "DEPENSE",
          cents: 1,
          count: 1,
        },
        {
          bucket: "2026-01-02",
          series: "ENTREE",
          kind: "ENTREE",
          cents: 1,
          count: 1,
        },
      ],
      []
    ),
  "365 jours × 2 séries"
);

// La limite de points vaut aussi sans ventilation (catégories non plafonnées).
const manyCategories = Array.from({ length: 501 }, (_, index) => ({
  bucket: String(index + 1),
  series: null,
  kind: "DEPENSE" as const,
  cents: 100,
  count: 1,
}));
tooLarge(
  () => assembleAnalytics(query({ groupBy: "category" }), manyCategories, []),
  "501 catégories"
);
assert.strictEqual(
  assembleAnalytics(query({ groupBy: "category" }), manyCategories.slice(1), [])
    .buckets.length,
  500
);

// Ventilation par sens : refusée avant toute lecture, quelles que soient les données.
tooLarge(
  () =>
    validateAnalyticsRange(
      query({
        groupBy: "day",
        from: "2028-01-01",
        to: "2028-12-31",
        splitBy: "kind",
      })
    ),
  "366 jours × 2 sens"
);
validateAnalyticsRange(
  query({
    groupBy: "day",
    from: "2028-01-01",
    to: "2028-12-31",
    splitBy: "kind",
    kind: "DEPENSE",
  })
);

// Changements d'heure à Paris (29 mars et 25 octobre 2026) : aucun jour sauté
// ni dupliqué, quel que soit le fuseau du processus.
const originalZone = process.env.TZ;
for (const zone of [
  "Europe/Paris",
  "America/Los_Angeles",
  "Pacific/Kiritimati",
  "UTC",
]) {
  process.env.TZ = zone;
  assert.deepStrictEqual(
    temporalKeys(
      query({ groupBy: "day", from: "2026-03-28", to: "2026-03-30" })
    ),
    ["2026-03-28", "2026-03-29", "2026-03-30"],
    zone
  );
  assert.deepStrictEqual(
    temporalKeys(
      query({ groupBy: "day", from: "2026-10-24", to: "2026-10-26" })
    ),
    ["2026-10-24", "2026-10-25", "2026-10-26"],
    zone
  );
  assert.deepStrictEqual(
    temporalKeys(
      query({ groupBy: "week", from: "2026-10-19", to: "2026-11-01" })
    ),
    ["2026-10-19", "2026-10-26"],
    zone
  );
  assert.deepStrictEqual(
    temporalKeys(
      query({ groupBy: "week", from: "2026-03-23", to: "2026-04-05" })
    ),
    ["2026-03-23", "2026-03-30"],
    zone
  );
}
process.env.TZ = originalZone;

console.log("Operation analytics domain tests passed");
