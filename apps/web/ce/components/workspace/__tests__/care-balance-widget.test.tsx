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

const TEST_PROJECT_ID = "proj-123";

// Mock useParams to return workspace slug and project id
vi.mock("react-router", async () => {
  const actual = await vi.importActual<typeof import("react-router")>("react-router");
  return {
    ...actual,
    useParams: () => ({ workspaceSlug: "test-workspace", projectId: TEST_PROJECT_ID }),
    Link: ({ to, children, ...rest }: { to: string; children: React.ReactNode; [key: string]: unknown }) => {
      const React = require("react");
      return React.createElement("a", { href: to, ...rest }, children);
    },
  };
});

const makeBalance = (overrides: Partial<IMonthlyBalance> = {}): IMonthlyBalance => ({
  id: "bal-1",
  project: TEST_PROJECT_ID,
  project_name: "Test Project",
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
  project: TEST_PROJECT_ID,
  project_name: "Test Project",
  workspace: "ws-1",
  monthly_hours: 10,
  package_label: "Care S",
  started_at: "2026-01-01T00:00:00Z",
  is_active: true,
  customer_name: "",
  customer_email: "",
  report_bcc: "",
  report_enabled: true,
  weekly_report_enabled: false,
  expert_ids: [],
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
      getSubscription: (projectId: string) => mockCareStore.subscriptions?.[projectId] ?? null,
      getBalance: (projectId: string) => mockCareStore.balances?.[projectId] ?? null,
      subscriptions: {},
      balances: {},
    });
  });

  it("renders green state when much time remains (>50%)", () => {
    const sub = makeSubscription();
    const bal = makeBalance({
      consumed_minutes: 180,
      total_available_minutes: 600,
      remaining_minutes: 420,
      consumption_percentage: 30,
    });
    Object.assign(mockCareStore, {
      getSubscription: () => sub,
      getBalance: () => bal,
    });

    const { container } = render(<CareBalanceWidget projectId={TEST_PROJECT_ID} />);

    expect(container.innerHTML).not.toBe("");
    expect(screen.getByText(/dbwcare\.remaining_this_month/)).toBeTruthy();
    expect(screen.getByText(/dbwcare\.of_total/)).toBeTruthy();

    const link = container.querySelector("a");
    expect(link).toBeTruthy();
    expect(link?.getAttribute("href")).toContain("/settings/projects/");
  });

  it("renders warning state when little time remains (<=25%)", () => {
    const sub = makeSubscription();
    const bal = makeBalance({
      consumed_minutes: 510,
      total_available_minutes: 600,
      remaining_minutes: 90,
      consumption_percentage: 85,
    });
    Object.assign(mockCareStore, {
      getSubscription: () => sub,
      getBalance: () => bal,
    });

    const { container } = render(<CareBalanceWidget projectId={TEST_PROJECT_ID} />);
    expect(container.innerHTML).not.toBe("");
    expect(screen.getByText(/dbwcare\.remaining_this_month/)).toBeTruthy();
  });

  it("renders null when no active subscription", () => {
    Object.assign(mockCareStore, {
      getSubscription: () => null,
      getBalance: () => makeBalance(),
    });

    const { container } = render(<CareBalanceWidget projectId={TEST_PROJECT_ID} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders null when no balance data", () => {
    Object.assign(mockCareStore, {
      getSubscription: () => makeSubscription(),
      getBalance: () => null,
    });

    const { container } = render(<CareBalanceWidget projectId={TEST_PROJECT_ID} />);
    expect(container.innerHTML).toBe("");
  });

  it("shows borrowed state when remaining minutes are negative", () => {
    const sub = makeSubscription();
    const bal = makeBalance({
      consumed_minutes: 660,
      total_available_minutes: 600,
      remaining_minutes: -60,
      consumption_percentage: 110,
    });
    Object.assign(mockCareStore, {
      getSubscription: () => sub,
      getBalance: () => bal,
    });

    const { container } = render(<CareBalanceWidget projectId={TEST_PROJECT_ID} />);
    expect(container.innerHTML).not.toBe("");
    expect(screen.getByText(/dbwcare\.borrowed_this_month/)).toBeTruthy();
  });

  it("calls fetchSubscription and fetchCurrentBalance on mount with projectId", () => {
    const fetchSubscription = vi.fn();
    const fetchCurrentBalance = vi.fn();

    Object.assign(mockCareStore, {
      getSubscription: () => null,
      getBalance: () => null,
      fetchSubscription,
      fetchCurrentBalance,
    });

    render(<CareBalanceWidget projectId={TEST_PROJECT_ID} />);

    expect(fetchSubscription).toHaveBeenCalledWith("test-workspace", TEST_PROJECT_ID);
    expect(fetchCurrentBalance).toHaveBeenCalledWith("test-workspace", TEST_PROJECT_ID);
  });
});
