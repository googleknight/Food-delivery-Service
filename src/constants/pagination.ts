import { SORT_ORDER } from "./prisma";

export const PAGINATION_DEFAULTS = {
  PAGE: 1,
  LIMIT: 20,
  MAX_LIMIT: 100,
  SORT_BY: "createdAt",
  SORT_ORDER: SORT_ORDER.DESC,
};
