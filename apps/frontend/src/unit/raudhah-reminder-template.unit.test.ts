import assert from "node:assert/strict";
import { describe } from "vitest";
import { buildRaudhahReminderTemplate } from "../shared/raudhah-reminder-template.js";
import { runCase } from "../test/run-case.js";

function testBuildRaudhahReminderTemplateUsesRequestedFormat(): void {
  const template = buildRaudhahReminderTemplate({
    groupCode: "902023711",
    groupName: "KEB 2 MAR",
    totalPax: 19,
    packageName: "Unit Package",
    departureIso: "2026-03-02",
    providerName: "Daleel",
    coordinatorName: "Yusal",
    appointments: [
      { dateIso: "2026-02-09", status: "Free" },
      { dateIso: "2026-02-15", status: "Free" },
      { dateIso: "2026-02-08", status: "After" },
      { dateIso: "2026-02-16", status: "Before" },
    ],
    bookingDateIsos: ["2026-02-05", "2026-02-10"],
    groupDetailLine: "902023711 → Ikhwan 9 Pax | Akhwat 10 pax",
  });

  assert.equal(
    template,
    [
      "📢 Reminder Booking Raudhah GROUP 19 PAX KEB 2 MAR 2 MAR (YUSAL)",
      "",
      "🔹 Syarikah: Daleel",
      "📅 Perkiraan jadwal yang buka: 5 & 10 FEBRUARI",
      "",
      "📋 Detail Group:",
      "902023711 → Ikhwan 9 Pax | Akhwat 10 pax",
      "",
      "🕌 Jadwal Raudhah Agent:",
      "* 9 - 15 → Free",
      "* 8 → After",
      "* 16 → Before (sebelum dzuhur)",
    ].join("\n"),
  );
}

function testBuildRaudhahReminderTemplateFallsBackToDerivedBookingDatesAndPlaceholderDetails(): void {
  const template = buildRaudhahReminderTemplate({
    groupCode: "9017001001",
    groupName: "Unit Group",
    totalPax: 20,
    packageName: "Quad Package",
    departureIso: "2026-04-10",
    providerName: "Rawaf Mina",
    appointments: [
      { dateIso: "2026-04-10", status: "Free" },
      { dateIso: "2026-04-12", status: "After" },
    ],
  });

  assert.equal(template.includes("📅 Perkiraan jadwal yang buka: 3, 5, 8 & 10 APRIL"), true);
  assert.equal(template.includes("9017001001 → Ikhwan ... Pax | Akhwat ... pax"), true);
  assert.equal(template.includes("* 10 → Free"), true);
  assert.equal(template.includes("* 12 → After"), true);
}

describe("raudhah reminder template", () => {
  runCase("builds the new booking reminder template format", testBuildRaudhahReminderTemplateUsesRequestedFormat);
  runCase(
    "derives booking dates and preserves placeholder group detail when breakdown is unavailable",
    testBuildRaudhahReminderTemplateFallsBackToDerivedBookingDatesAndPlaceholderDetails,
  );
});
