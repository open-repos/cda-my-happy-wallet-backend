export const paginationParameters = [
  { $ref: "#/components/parameters/PaginationLimit" },
  { $ref: "#/components/parameters/PaginationCursor" },
];

export const paginatedCollectionResponse = (description: string) => ({
  description,
  content: {
    "application/json": {
      schema: {
        type: "object",
        required: ["data", "meta"],
        additionalProperties: false,
        properties: {
          data: { type: "array", items: { type: "object" } },
          meta: { $ref: "#/components/schemas/PaginationMeta" },
        },
      },
      example: {
        data: [],
        meta: { limit: 50, hasNext: false, nextCursor: null },
      },
    },
  },
});

export const paginationValidationResponse = {
  description: "Invalid limit or opaque pagination cursor",
};
