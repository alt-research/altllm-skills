import { CliError } from "./api.js";

export const TRANSACTION_FILTER_TYPES = ["all", "credit", "usage", "refund"] as const;
export type TransactionFilterType = (typeof TRANSACTION_FILTER_TYPES)[number];

export function appendPaginationParams(
  searchParams: URLSearchParams,
  params: { page?: number; limit?: number }
): void {
  if (params.page !== undefined) {
    if (!Number.isInteger(params.page) || params.page < 1) {
      throw new CliError("Page must be an integer >= 1.");
    }
    searchParams.set("page", String(params.page));
  }

  if (params.limit !== undefined) {
    if (!Number.isInteger(params.limit) || params.limit < 1 || params.limit > 100) {
      throw new CliError("Limit must be an integer between 1 and 100.");
    }
    searchParams.set("limit", String(params.limit));
  }
}

export function appendDateRangeParams(
  searchParams: URLSearchParams,
  params: { startDate?: string; endDate?: string; month?: string }
): void {
  if (params.month !== undefined) {
    const month = params.month.trim();
    if (!/^\d{4}-\d{2}$/.test(month)) {
      throw new CliError("Month must be in YYYY-MM format.");
    }
    searchParams.set("month", month);
  }

  if (params.startDate !== undefined) {
    const startDate = params.startDate.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      throw new CliError("Start date must be in YYYY-MM-DD format.");
    }
    searchParams.set("start_date", startDate);
  }

  if (params.endDate !== undefined) {
    const endDate = params.endDate.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      throw new CliError("End date must be in YYYY-MM-DD format.");
    }
    searchParams.set("end_date", endDate);
  }
}

export function appendMonthOrDateRangeParams(
  searchParams: URLSearchParams,
  params: { startDate?: string; endDate?: string; month?: string }
): void {
  const hasMonth = params.month !== undefined;
  const hasStartDate = params.startDate !== undefined;
  const hasEndDate = params.endDate !== undefined;

  if (hasMonth && (hasStartDate || hasEndDate)) {
    throw new CliError("Use either --month or --start-date/--end-date, but not both.");
  }

  if (hasStartDate !== hasEndDate) {
    throw new CliError("Provide both --start-date and --end-date for an explicit date range.");
  }

  appendDateRangeParams(searchParams, params);
}

export function appendRequiredDateRangeParams(
  searchParams: URLSearchParams,
  params: { startDate?: string; endDate?: string }
): void {
  const hasStartDate = params.startDate !== undefined;
  const hasEndDate = params.endDate !== undefined;

  if (!hasStartDate && !hasEndDate) {
    throw new CliError("Provide both --start-date and --end-date.");
  }

  if (hasStartDate !== hasEndDate) {
    throw new CliError("Provide both --start-date and --end-date.");
  }

  appendDateRangeParams(searchParams, params);
}

export function parseTransactionFilterType(type: string): TransactionFilterType {
  const normalized = type.trim().toLowerCase();
  if ((TRANSACTION_FILTER_TYPES as readonly string[]).includes(normalized)) {
    return normalized as TransactionFilterType;
  }

  throw new CliError(
    `Invalid transaction type: ${type}. Expected one of ${TRANSACTION_FILTER_TYPES.join(", ")}.`
  );
}
