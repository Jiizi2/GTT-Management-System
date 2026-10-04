import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AgentVisaFlights } from "../../agent/components/agent-visa-flights";
import type { GroupVisaSetup } from "../../shared/app-domain";
import { createEmptyFlightLeg } from "../../shared/flight-plan";

const visa: GroupVisaSetup = {
  visaStatus: "Draft",
  syarikah: "",
  paymentStatus: "Unpaid",
  makkahHotels: [],
  madinahHotels: [],
  raudhahAppointments: [],
};

describe("Agent visa flight details", () => {
  it("orders transit legs without inventing a return flight", () => {
    render(
      <AgentVisaFlights
        visa={{
          ...visa,
          flightLegs: [
            {
              ...createEmptyFlightLeg("ONWARD", 1),
              departureAirportCode: "DOH",
              arrivalAirportCode: "JED",
              flightNumber: "QR-1186",
            },
            {
              ...createEmptyFlightLeg("ONWARD", 0),
              departureAirportCode: "CGK",
              arrivalAirportCode: "DOH",
              flightNumber: "QR-957",
              departureDate: "2026-10-10",
              departureTime: "18:20",
            },
          ],
        }}
      />,
    );
    const onward = screen.getByRole("region", { name: "Penerbangan berangkat" });
    expect(within(onward).getByText("2 segmen · Transit")).toBeVisible();
    const rows = within(onward).getAllByRole("listitem");
    expect(rows[0]).toHaveTextContent("QR-957");
    expect(rows[1]).toHaveTextContent("QR-1186");
    expect(screen.getByText("Penerbangan pulang belum tercatat.")).toBeVisible();
    expect(screen.queryByText("Direct")).not.toBeInTheDocument();
  });

  it("retains legacy flight data and distinguishes missing routes and times", () => {
    render(
      <AgentVisaFlights
        visa={{
          ...visa,
          arrivalFlightNumber: "JT-106",
          arrivalFlightDate: "2026-10-10",
          arrivalTime: "21:45",
          flightLegs: [createEmptyFlightLeg("ONWARD")],
        }}
      />,
    );
    expect(screen.getByText("JT-106")).toBeVisible();
    expect(screen.getByText("Rute belum lengkap")).toBeVisible();
    expect(screen.getByText("10 Okt 2026 · 21:45")).toBeVisible();
    expect(screen.queryByText("Direct")).not.toBeInTheDocument();
    expect(screen.queryByText(/Raudhah|Tasreh/i)).not.toBeInTheDocument();
  });
});
