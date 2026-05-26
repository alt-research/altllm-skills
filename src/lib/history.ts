import { CliError } from "./api.js";

export const TRANSACTION_FILTER_TYPES = ["all", "credit", "usage", "refund"] as const;
export type TransactionFilterType = (typeof TRANSACTION_FILTER_TYPES)[number];

function normalizeMonth(value: string): string {
  const month = value.trim();
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) {
    throw new CliError("Month must be in YYYY-MM format.");
  }

  const monthNumber = Number(match[2]);
  if (monthNumber < 1 || monthNumber > 12) {
    throw new CliError("Month must be a valid calendar month in YYYY-MM format.");
  }

  return month;
}

function monthToDateRange(value: string): { startDate: string; endDate: string } {
  const month = normalizeMonth(value);
  const [yearText, monthText] = month.split("-");
  const year = Number(yearText);
  const monthNumber = Number(monthText);
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();

  return {
    startDate: `${month}-01`,
    endDate: `${month}-${String(lastDay).padStart(2, "0")}`,
  };
}

function normalizeDate(value: string, label: string): string {
  const date = value.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) {
    throw new CliError(`${label} must be in YYYY-MM-DD format.`);
  }

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, monthIndex, day));

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== monthIndex ||
    parsed.getUTCDate() !== day
  ) {
    throw new CliError(`${label} must be a valid calendar date in YYYY-MM-DD format.`);
  }

  return date;
}

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
    searchParams.set("month", normalizeMonth(params.month));
  }

  let normalizedStartDate: string | undefined;
  let normalizedEndDate: string | undefined;

  if (params.startDate !== undefined) {
    normalizedStartDate = normalizeDate(params.startDate, "Start date");
    searchParams.set("start_date", normalizedStartDate);
  }

  if (params.endDate !== undefined) {
    normalizedEndDate = normalizeDate(params.endDate, "End date");
    searchParams.set("end_date", normalizedEndDate);
  }

  if (
    normalizedStartDate !== undefined &&
    normalizedEndDate !== undefined &&
    normalizedStartDate > normalizedEndDate
  ) {
    throw new CliError("Start date must be on or before end date.");
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

export function appendRequiredDateRangeOrMonthParams(
  searchParams: URLSearchParams,
  params: { startDate?: string; endDate?: string; month?: string }
): void {
  const hasMonth = params.month !== undefined;
  const hasStartDate = params.startDate !== undefined;
  const hasEndDate = params.endDate !== undefined;

  if (hasMonth && (hasStartDate || hasEndDate)) {
    throw new CliError("Use either --month or --start-date/--end-date, but not both.");
  }

  if (params.month !== undefined) {
    const { startDate, endDate } = monthToDateRange(params.month);
    searchParams.set("start_date", startDate);
    searchParams.set("end_date", endDate);
    return;
  }

  if (!hasStartDate && !hasEndDate) {
    throw new CliError("Provide --month or both --start-date and --end-date.");
  }

  if (hasStartDate !== hasEndDate) {
    throw new CliError("Provide both --start-date and --end-date, or use --month.");
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
