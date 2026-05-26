import assert from "node:assert/strict";
import test from "node:test";

import { CliError } from "../src/lib/api.js";
import {
  appendDateRangeParams,
  appendMonthOrDateRangeParams,
  appendPaginationParams,
  appendRequiredDateRangeParams,
  parseTransactionFilterType,
} from "../src/lib/history.js";

function assertCliError(fn: () => void, message: string): void {
  assert.throws(
    fn,
    (error) => error instanceof CliError && error.message === message
  );
}

test("appendPaginationParams validates and appends page and limit", () => {
  const searchParams = new URLSearchParams();

  appendPaginationParams(searchParams, { page: 2, limit: 50 });

  assert.equal(searchParams.get("page"), "2");
  assert.equal(searchParams.get("limit"), "50");
  assertCliError(
    () => appendPaginationParams(new URLSearchParams(), { page: 0 }),
    "Page must be an integer >= 1."
  );
  assertCliError(
    () => appendPaginationParams(new URLSearchParams(), { limit: 101 }),
    "Limit must be an integer between 1 and 100."
  );
});

test("appendDateRangeParams validates real calendar dates and month values", () => {
  const searchParams = new URLSearchParams();

  appendDateRangeParams(searchParams, {
    month: " 2024-02 ",
    startDate: "2024-02-01",
    endDate: "2024-02-29",
  });

  assert.equal(searchParams.get("month"), "2024-02");
  assert.equal(searchParams.get("start_date"), "2024-02-01");
  assert.equal(searchParams.get("end_date"), "2024-02-29");
  assertCliError(
    () => appendDateRangeParams(new URLSearchParams(), { month: "2024-13" }),
    "Month must be a valid calendar month in YYYY-MM format."
  );
  assertCliError(
    () => appendDateRangeParams(new URLSearchParams(), { startDate: "2026-02-29" }),
    "Start date must be a valid calendar date in YYYY-MM-DD format."
  );
  assertCliError(
    () => appendDateRangeParams(new URLSearchParams(), { endDate: "2026-04-31" }),
    "End date must be a valid calendar date in YYYY-MM-DD format."
  );
  assertCliError(
    () =>
      appendDateRangeParams(new URLSearchParams(), {
        startDate: "2024-03-01",
        endDate: "2024-02-29",
      }),
    "Start date must be on or before end date."
  );
});

test("appendMonthOrDateRangeParams rejects ambiguous or partial ranges", () => {
  assertCliError(
    () =>
      appendMonthOrDateRangeParams(new URLSearchParams(), {
        month: "2024-02",
        startDate: "2024-02-01",
        endDate: "2024-02-29",
      }),
    "Use either --month or --start-date/--end-date, but not both."
  );
  assertCliError(
    () =>
      appendMonthOrDateRangeParams(new URLSearchParams(), {
        startDate: "2024-02-01",
      }),
    "Provide both --start-date and --end-date for an explicit date range."
  );
});

test("appendRequiredDateRangeParams requires both dates", () => {
  assertCliError(
    () => appendRequiredDateRangeParams(new URLSearchParams(), {}),
    "Provide both --start-date and --end-date."
  );
  assertCliError(
    () =>
      appendRequiredDateRangeParams(new URLSearchParams(), {
        endDate: "2024-02-29",
      }),
    "Provide both --start-date and --end-date."
  );
});

test("parseTransactionFilterType normalizes supported filters", () => {
  assert.equal(parseTransactionFilterType(" CREDIT "), "credit");
  assertCliError(
    () => parseTransactionFilterType("debit"),
    "Invalid transaction type: debit. Expected one of all, credit, usage, refund."
  );
});
