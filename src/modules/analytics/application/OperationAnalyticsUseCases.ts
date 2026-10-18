import {
  AnalyticsCategory,
  AnalyticsQuery,
  AnalyticsRow,
  OperationAnalytics,
  assembleAnalytics,
  validateAnalyticsRange,
} from "../domain";

export interface OperationAnalyticsRepository {
  /** Totaux par seau, série et sens, filtrés sur le propriétaire en base. */
  aggregate(ownerId: number, query: AnalyticsQuery): Promise<AnalyticsRow[]>;
  /** Catégories du propriétaire parmi les identifiants donnés. */
  categories(
    ownerId: number,
    ids: readonly number[]
  ): Promise<AnalyticsCategory[]>;
}

export class OperationAnalyticsUseCases {
  public constructor(
    private readonly analytics: OperationAnalyticsRepository
  ) {}

  public async aggregate(
    ownerId: number,
    query: AnalyticsQuery
  ): Promise<OperationAnalytics> {
    validateAnalyticsRange(query);
    const rows = await this.analytics.aggregate(ownerId, query);
    const ids = new Set<number>();
    for (const row of rows) {
      if (query.groupBy === "category") ids.add(Number(row.bucket));
      if (query.splitBy === "category" && row.series !== null) {
        ids.add(Number(row.series));
      }
    }
    const categories =
      ids.size === 0 ? [] : await this.analytics.categories(ownerId, [...ids]);
    return assembleAnalytics(query, rows, categories);
  }
}
