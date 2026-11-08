/// <reference path="../../../src/utils/custom.d.ts" />

import assert from "assert";
import swagger from "../../../src/utils/swagger.def";

type OpenApiOperation = {
  parameters?: Array<{ $ref?: string; name?: string; schema?: unknown }>;
  responses?: Record<string, unknown>;
};

const paginatedPaths = [
  "/users",
  "/operations-fixes",
  "/operations-fixes/revenus",
  "/operations-fixes/charges",
  "/operation-categories",
  "/operations",
  "/goals",
  "/savings-accounts",
  "/savings-accounts/{id}/movements",
  "/savings-occurrences/pending",
  "/accounts/current/movements",
  "/budget-periods/history",
  "/event-occurrences/pending",
] as const;

const document = swagger as unknown as {
  paths: Record<string, { get?: OpenApiOperation }>;
  components: {
    parameters: Record<string, { schema: Record<string, unknown> }>;
    schemas: Record<string, Record<string, unknown>>;
  };
};

for (const path of paginatedPaths) {
  const operation = document.paths[path]?.get;
  assert.ok(operation, `Missing GET ${path} in OpenAPI`);
  // Les filtres métier éventuels précèdent toujours les paramètres partagés.
  assert.deepStrictEqual(operation.parameters?.slice(-2), [
    { $ref: "#/components/parameters/PaginationLimit" },
    { $ref: "#/components/parameters/PaginationCursor" },
  ]);
  assert.ok(operation.responses?.["200"], `Missing 200 response for ${path}`);
  assert.ok(operation.responses?.["422"], `Missing 422 response for ${path}`);

  const response = operation.responses?.["200"] as {
    content?: {
      "application/json"?: {
        schema?: { required?: string[]; properties?: Record<string, unknown> };
      };
    };
  };
  const schema = response.content?.["application/json"]?.schema;
  assert.deepStrictEqual(schema?.required, ["data", "meta"]);
  assert.ok(schema?.properties?.data);
  assert.ok(schema?.properties?.meta);
}

// #174 : les suggestions gardent le curseur partagé, avec leur propre limite.
const suggestions = document.paths["/operations/suggestions/titles"]?.get;
assert.ok(suggestions, "Missing GET /operations/suggestions/titles in OpenAPI");
const suggestionParameters = suggestions.parameters ?? [];
assert.deepStrictEqual(
  suggestionParameters.map((parameter) => parameter.name ?? parameter.$ref),
  ["q", "limit", "#/components/parameters/PaginationCursor"]
);
assert.deepStrictEqual(suggestionParameters[1]?.schema, {
  type: "integer",
  minimum: 1,
  maximum: 50,
  default: 10,
});
assert.ok(suggestions.responses?.["200"]);
assert.ok(suggestions.responses?.["422"]);

assert.deepStrictEqual(
  document.components.parameters.PaginationLimit.schema,
  { type: "integer", minimum: 1, maximum: 100, default: 50 }
);
assert.deepStrictEqual(
  document.components.schemas.PaginationMeta.required,
  ["limit", "hasNext", "nextCursor"]
);

console.log("Pagination OpenAPI tests passed");
