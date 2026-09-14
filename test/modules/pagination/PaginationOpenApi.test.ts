/// <reference path="../../../src/utils/custom.d.ts" />

import assert from "assert";
import swagger from "../../../src/utils/swagger.def";

type OpenApiOperation = {
  parameters?: Array<{ $ref?: string }>;
  responses?: Record<string, unknown>;
};

const paginatedPaths = [
  "/users",
  "/operations-fixes",
  "/operations-fixes/revenus",
  "/operations-fixes/charges",
  "/operation-categories",
  "/operations",
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
  assert.deepStrictEqual(operation.parameters, [
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

assert.deepStrictEqual(
  document.components.parameters.PaginationLimit.schema,
  { type: "integer", minimum: 1, maximum: 100, default: 50 }
);
assert.deepStrictEqual(
  document.components.schemas.PaginationMeta.required,
  ["limit", "hasNext", "nextCursor"]
);

console.log("Pagination OpenAPI tests passed");
