import { describe, expect, it } from "vitest";
import { bucketRevenue, bucketUnit, periodStart } from "./revenue";

describe("periodStart", () => {
  const today = "2026-10-13";

  it("counts today in the last 7 and 30 days", () => {
    expect(periodStart("7d", today)).toBe("2026-10-07");
    expect(periodStart("30d", today)).toBe("2026-09-14");
  });

  it("covers three calendar months", () => {
    expect(periodStart("3m", today)).toBe("2026-07-14");
  });

  it("starts « all » at the first sale, or today without any", () => {
    expect(periodStart("all", today, "2026-09-30")).toBe("2026-09-30");
    expect(periodStart("all", today)).toBe(today);
  });
});

describe("bucketUnit", () => {
  it("uses days up to a month, weeks up to half a year, months beyond", () => {
    expect(bucketUnit("2026-09-30", "2026-10-13")).toBe("day");
    expect(bucketUnit("2026-09-13", "2026-10-13")).toBe("day");
    expect(bucketUnit("2026-07-14", "2026-10-13")).toBe("week");
    expect(bucketUnit("2025-10-01", "2026-10-13")).toBe("month");
  });
});

describe("bucketRevenue", () => {
  it("lists every day, the ones without sales at zero", () => {
    const { unit, buckets } = bucketRevenue(
      [
        { day: "2026-10-01", total: 6600 },
        { day: "2026-10-03", total: 860 },
      ],
      "2026-10-01",
      "2026-10-04",
    );
    expect(unit).toBe("day");
    expect(buckets).toEqual([
      { start: "2026-10-01", total: 6600 },
      { start: "2026-10-02", total: 0 },
      { start: "2026-10-03", total: 860 },
      { start: "2026-10-04", total: 0 },
    ]);
  });

  it("adds days up into their Monday-started week", () => {
    const { unit, buckets } = bucketRevenue(
      [
        { day: "2026-07-14", total: 100 },
        { day: "2026-07-19", total: 50 },
        { day: "2026-07-20", total: 10 },
      ],
      "2026-07-14",
      "2026-10-13",
    );
    expect(unit).toBe("week");
    expect(buckets[0]).toEqual({ start: "2026-07-13", total: 150 });
    expect(buckets[1]).toEqual({ start: "2026-07-20", total: 10 });
    expect(buckets.at(-1)?.start).toBe("2026-10-12");
  });

  it("leaves out sales outside the period", () => {
    const { buckets } = bucketRevenue(
      [{ day: "2026-09-01", total: 999 }],
      "2026-10-01",
      "2026-10-02",
    );
    expect(buckets.every((bucket) => bucket.total === 0)).toBe(true);
  });

  it("adds days up by month over a long stretch", () => {
    const { unit, buckets } = bucketRevenue(
      [
        { day: "2025-11-05", total: 1 },
        { day: "2025-11-25", total: 2 },
      ],
      "2025-10-20",
      "2026-10-13",
    );
    expect(unit).toBe("month");
    expect(buckets[0]).toEqual({ start: "2025-10-01", total: 0 });
    expect(buckets[1]).toEqual({ start: "2025-11-01", total: 3 });
    expect(buckets).toHaveLength(13);
  });
});

describe("niceScale", async () => {
  const { niceScale } = await import("./revenue-chart");

  it("picks round steps, five at most, the top just above the highest value", () => {
    expect(niceScale(6600)).toEqual({ top: 8000, step: 2000 });
    expect(niceScale(4100)).toEqual({ top: 5000, step: 1000 });
    expect(niceScale(860)).toEqual({ top: 1000, step: 200 });
    expect(niceScale(1000)).toEqual({ top: 1000, step: 200 });
  });

  it("keeps a usable scale when nothing sold", () => {
    expect(niceScale(0)).toEqual({ top: 1, step: 1 });
  });
});
