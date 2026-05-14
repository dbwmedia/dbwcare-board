import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { WorklogTimer } from "../property/timer";
import { WorklogManualEntryModal } from "../property/manual-entry-modal";
import type { ICareStore } from "@/plane-web/store/care";
import type { IWorklogEntry } from "@plane/types";

// Mock useCare hook
const mockCareStore: Partial<ICareStore> = {};

vi.mock("@/hooks/store/use-care", () => ({
  useCare: () => mockCareStore,
}));

// Mock the timer-stop-modal since it may not exist yet
vi.mock("../property/timer-stop-modal", () => ({
  WorklogTimerStopModal: ({ isOpen }: { isOpen: boolean }) => {
    if (!isOpen) return null;
    const React = require("react");
    return React.createElement("div", { "data-testid": "stop-modal" }, "Stop Modal");
  },
}));

const makeActiveEntry = (overrides: Partial<IWorklogEntry> = {}): IWorklogEntry => ({
  id: "entry-1",
  workspace: "ws-1",
  project: "proj-1",
  issue: "issue-1",
  logged_by: "user-1",
  logged_by_detail: { id: "user-1", display_name: "Test User", avatar: "" },
  description: "",
  duration_minutes: 0,
  started_at: new Date(Date.now() - 300_000).toISOString(), // 5 minutes ago
  ended_at: null,
  is_running: true,
  entry_type: "tracked",
  billing_status: "billable",
  gift_reason: "",
  created_at: "2026-05-14T10:00:00Z",
  updated_at: "2026-05-14T10:00:00Z",
  created_by: "user-1",
  ...overrides,
});

describe("WorklogTimer", () => {
  beforeEach(() => {
    Object.keys(mockCareStore).forEach((key) => delete (mockCareStore as Record<string, unknown>)[key]);
    Object.assign(mockCareStore, {
      activeTimer: null,
      startTimer: vi.fn(),
      stopTimer: vi.fn(),
    });
  });

  it("shows start button when no active timer", () => {
    render(
      <WorklogTimer
        workspaceSlug="test-workspace"
        projectId="proj-1"
        issueId="issue-1"
        activeEntry={null}
        disabled={false}
      />
    );

    // Should show the start timer button with translation key
    const startBtn = screen.getByText("dbwcare.start_timer");
    expect(startBtn).toBeTruthy();
  });

  it("renders null when disabled", () => {
    const { container } = render(
      <WorklogTimer
        workspaceSlug="test-workspace"
        projectId="proj-1"
        issueId="issue-1"
        activeEntry={null}
        disabled={true}
      />
    );

    expect(container.innerHTML).toBe("");
  });

  it("shows elapsed time and stop button when timer is active", () => {
    const entry = makeActiveEntry();

    const { container } = render(
      <WorklogTimer
        workspaceSlug="test-workspace"
        projectId="proj-1"
        issueId="issue-1"
        activeEntry={entry}
        disabled={false}
      />
    );

    // Should show a time display (format: MM:SS or HH:MM:SS)
    expect(container.querySelector(".font-mono")).toBeTruthy();

    // Should have a stop button (the Square icon button)
    const stopBtn = container.querySelector("button");
    expect(stopBtn).toBeTruthy();
  });

  it("calls startTimer when start button is clicked", async () => {
    const startTimer = vi.fn().mockResolvedValue(makeActiveEntry());
    Object.assign(mockCareStore, { startTimer, activeTimer: null });

    render(
      <WorklogTimer
        workspaceSlug="test-workspace"
        projectId="proj-1"
        issueId="issue-1"
        activeEntry={null}
        disabled={false}
      />
    );

    const startBtn = screen.getByText("dbwcare.start_timer").closest("button");
    expect(startBtn).toBeTruthy();
    fireEvent.click(startBtn!);

    await waitFor(() => {
      expect(startTimer).toHaveBeenCalledWith("test-workspace", "proj-1", "issue-1");
    });
  });
});

describe("WorklogManualEntryModal", () => {
  beforeEach(() => {
    Object.keys(mockCareStore).forEach((key) => delete (mockCareStore as Record<string, unknown>)[key]);
    Object.assign(mockCareStore, {
      createWorklogEntry: vi.fn(),
    });
  });

  it("renders the modal when isOpen is true", () => {
    render(
      <WorklogManualEntryModal
        isOpen={true}
        onClose={vi.fn()}
        workspaceSlug="test-workspace"
        projectId="proj-1"
        issueId="issue-1"
      />
    );

    // Modal should be visible with the title
    expect(screen.getByText("dbwcare.manual_add")).toBeTruthy();
  });

  it("does not render when isOpen is false", () => {
    const { container } = render(
      <WorklogManualEntryModal
        isOpen={false}
        onClose={vi.fn()}
        workspaceSlug="test-workspace"
        projectId="proj-1"
        issueId="issue-1"
      />
    );

    expect(container.innerHTML).toBe("");
  });

  it("shows error when submitting with duration = 0", async () => {
    render(
      <WorklogManualEntryModal
        isOpen={true}
        onClose={vi.fn()}
        workspaceSlug="test-workspace"
        projectId="proj-1"
        issueId="issue-1"
      />
    );

    // Click save without entering any duration
    const saveBtn = screen.getByText("common.save");
    fireEvent.click(saveBtn);

    // Should show the duration error
    await waitFor(() => {
      expect(screen.getByText("dbwcare.duration_required")).toBeTruthy();
    });

    // createWorklogEntry should NOT have been called
    expect(mockCareStore.createWorklogEntry).not.toHaveBeenCalled();
  });

  it("shows error when description is too short", async () => {
    render(
      <WorklogManualEntryModal
        isOpen={true}
        onClose={vi.fn()}
        workspaceSlug="test-workspace"
        projectId="proj-1"
        issueId="issue-1"
      />
    );

    // Enter a valid duration (30 minutes)
    const minutesInput = screen.getByPlaceholderText("0") as HTMLInputElement;
    // There are two "0" placeholder inputs (hours, minutes). Get the second one.
    const inputs = document.querySelectorAll<HTMLInputElement>("input[type='number']");
    // Set minutes to 30
    if (inputs.length >= 2) {
      fireEvent.change(inputs[1], { target: { value: "30" } });
    }

    // Leave description empty and click save
    const saveBtn = screen.getByText("common.save");
    fireEvent.click(saveBtn);

    // Should show the description min length error
    await waitFor(() => {
      expect(screen.getByText("dbwcare.description_min_length")).toBeTruthy();
    });

    // createWorklogEntry should NOT have been called
    expect(mockCareStore.createWorklogEntry).not.toHaveBeenCalled();
  });

  it("submits successfully with valid data", async () => {
    const createWorklogEntry = vi.fn().mockResolvedValue({
      id: "entry-new",
      duration_minutes: 30,
      description: "Test task completed",
    });
    Object.assign(mockCareStore, { createWorklogEntry });

    const onClose = vi.fn();

    render(
      <WorklogManualEntryModal
        isOpen={true}
        onClose={onClose}
        workspaceSlug="test-workspace"
        projectId="proj-1"
        issueId="issue-1"
      />
    );

    // Set minutes to 30
    const numberInputs = document.querySelectorAll<HTMLInputElement>("input[type='number']");
    if (numberInputs.length >= 2) {
      fireEvent.change(numberInputs[1], { target: { value: "30" } });
    }

    // Set description
    const descInput = document.querySelector<HTMLInputElement>("input[name='description']");
    expect(descInput).toBeTruthy();
    fireEvent.change(descInput!, { target: { value: "Test task completed" } });

    // Click save
    const saveBtn = screen.getByText("common.save");
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(createWorklogEntry).toHaveBeenCalledWith("test-workspace", "proj-1", "issue-1", {
        duration_minutes: 30,
        description: "Test task completed",
        billing_status: "billable",
        gift_reason: "",
      });
    });

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("calls onClose when cancel button is clicked", () => {
    const onClose = vi.fn();

    render(
      <WorklogManualEntryModal
        isOpen={true}
        onClose={onClose}
        workspaceSlug="test-workspace"
        projectId="proj-1"
        issueId="issue-1"
      />
    );

    const cancelBtn = screen.getByText("common.cancel");
    fireEvent.click(cancelBtn);

    expect(onClose).toHaveBeenCalled();
  });
});
