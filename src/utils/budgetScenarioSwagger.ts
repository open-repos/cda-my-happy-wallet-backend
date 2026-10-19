export const budgetScenarioParameter = {
  name: "scenario",
  in: "query",
  description:
    "Only simulation explicitly includes unconfirmed potential events",
  schema: {
    type: "string",
    enum: ["standard", "simulation"],
    default: "standard",
  },
};
