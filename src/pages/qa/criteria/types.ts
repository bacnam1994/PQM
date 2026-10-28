export interface CriteriaSummary {
  id: string;
  name: string;
  count: number;
  relatedTCCS: { id: string; code: string; product: string; productId?: string }[];
  types: Set<string>;
  masterCriterionId?: string;
}
