import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { CareBalanceWidget } from "../care-balance-widget";
import type { ICareStore } from "@/plane-web/store/care";
import type { IMonthlyBalance, ICareSubscription } from "@plane/types";

// Mock useCare hook
const mockCareStore: Partial<ICareStore> = {};

vi.mock("@/hooks/store/use-care", () => ({
  useCare: () => mockCareStore,
}));

// Mock useParams to return a workspace slug
vi.mock("react-router", async () => {
  const actual = await vi.importActual<typeof import("react-router")>("react-router");
  return {
    ...actual,
    useParams: () => ({ workspaceSlug: "test-workspace" }),
    Link: ({ to, children, ...rest }: { to: string; children: React.ReactNode; [key: string]: unknown }) => {
      const React = require("react");
      return React.createElement("a", { href: to, ...rest }, children);
    },
  };
});

const makeBalance = (overrides: Partial<IMonthlyBalance> = {}): IMonthlyBalance => ({
  id: "bal-1",
  workspace: "ws-1",
  year: 2026,
  month: 5,
  base_hours: 10,
  base_minutes: 600,
  rolled_over_minutes: 0,
  borrowed_minutes: 0,
  consumed_minutes: 180,
  total_available_minutes: 600,
  remaining_minutes: 420,
  consumption_percentage: 30,
  is_closed: false,
  created_at: "2026-05-01T00:00:00Z",
  updated_at: "2026-05-14T00:00:00Z",
  ...overrides,
});

const makeSubscription = (overrides: Partial<ICareSubscription> = {}): ICareSubscription => ({
  id: "sub-1",
  workspace: "ws-1",
  monthly_hours: 10,
  package_label: "Care S",
  started_at: "2026-01-01T00:00:00Z",
  is_active: true,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-05-01T00:00:00Z",
  ...overrides,
});

describe("CareBalanceWidget", () => {
  beforeEach(() => {
    // Reset the mock store before each test
    Object.keys(mockCareStore).forEach((key) => delete (mockCareStore as Record<string, unknown>)[key]);
    // Default no-op actions
    Object.assign(mockCareStore, {
      fetchSubscription: vi.fn(),
      fetchCurrentBalance: vi.fn(),
    });
  });

  it("renders green state when much time remains (>50%)", () => {
    Object.assign(mockCareStore, {
      hasActiveSubscription: true,
      subscription: makeSubscription(),
      currentBalance: makeBalance({
        consumed_minutes: 180,
        total_available_minutes: 600,
        remaining_minutes: 420,
        consumption_percentage: 30,
      }),
    });

    const { container } = render(<CareBalanceWidget />);

    // Widget should render (not null)
    expect(container.innerHTML).not.toBe("");

    // Should display the remaining time text (translation key with interpolation)
    expect(screen.getByText(/dbwcare\.remaining_this_month/)).toBeTruthy();

    // Should display the "of total" text
    expect(screen.getByText(/dbwcare\.of_total/)).toBeTruthy();

    // The link should point to the care settings page
    const link = container.querySelector("a");
    expect(link).toBeTruthy();
    expect(link?.getAttribute("href")).toBe("/test-workspace/settings/care/");
  });

  it("renders warning state when little time remains (<=25%)", () => {
    Object.assign(mockCareStore, {
      hasActiveSubscription: true,
      subscription: makeSubscription(),
      currentBalance: makeBalance({
        consumed_minutes: 510,
        total_available_minutes: 600,
        remaining_minutes: 90,
        consumption_percentage: 85,
      }),
    });

    const { container } = render(<CareBalanceWidget />);

    // Widget should render
    expect(container.innerHTML).not.toBe("");

    // Should show remaining time (90 min = 1h 30min)
    expect(screen.getByText(/dbwcare\.remaining_this_month/)).toBeTruthy();
  });

  it("renders null when no active subscription", () => {
    Object.assign(mockCareStore, {
      hasActiveSubscription: false,
      subscription: null,
      currentBalance: makeBalance(),
    });

    const { container } = render(<CareBalanceWidget />);

    // Should render nothing
    expect(container.innerHTML).toBe("");
  });

  it("renders null when no balance data", () => {
    Object.assign(mockCareStore, {
      hasActiveSubscription: true,
      subscription: makeSubscription(),
      currentBalance: null,
    });

    const { container } = render(<CareBalanceWidget />);

    // Should render nothing
    expect(container.innerHTML).toBe("");
  });

  it("shows borrowed state when remaining minutes are negative", () => {
    Object.assign(mockCareStore, {
      hasActiveSubscription: true,
      subscription: makeSubscription(),
      currentBalance: makeBalance({
        consumed_minutes: 660,
        total_available_minutes: 600,
        remaining_minutes: -60,
        consumption_percentage: 110,
      }),
    });

    const { container } = render(<CareBalanceWidget />);

    expect(container.innerHTML).not.toBe("");
    // Should show "borrowed" text since remaining < 0
    expect(screen.getByText(/dbwcare\.borrowed_this_month/)).toBeTruthy();
  });

  it("calls fetchSubscription and fetchCurrentBalance on mount", () => {
    const fetchSubscription = vi.fn();
    const fetchCurrentBalance = vi.fn();

    Object.assign(mockCareStore, {
      hasActiveSubscription: false,
      subscription: null,
      currentBalance: null,
      fetchSubscription,
      fetchCurrentBalance,
    });

    render(<CareBalanceWidget />);

    expect(fetchSubscription).toHaveBeenCalledWith("test-workspace");
    expect(fetchCurrentBalance).toHaveBeenCalledWith("test-workspace");
  });
});
