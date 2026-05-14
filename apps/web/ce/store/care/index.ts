import { action, computed, makeObservable, observable, runInAction } from "mobx";
import type {
  ICareSubscription,
  ICareSubscriptionFormData,
  IMonthlyBalance,
  IWorklogEntry,
  IWorklogEntryFormData,
  IWorklogTimerStartData,
} from "@plane/types";
import careService from "@/plane-web/services/care.service";
import type { CoreRootStore } from "@/store/root.store";

export interface ICareStore {
  // observables
  subscription: ICareSubscription | null;
  currentBalance: IMonthlyBalance | null;
  balanceHistory: IMonthlyBalance[];
  activeTimer: IWorklogEntry | null;
  worklogEntries: Record<string, IWorklogEntry[]>; // issue_id -> entries
  loader: boolean;

  // computed
  hasActiveSubscription: boolean;
  remainingMinutes: number;
  consumptionPercentage: number;

  // actions
  fetchSubscription: (workspaceSlug: string) => Promise<void>;
  updateSubscription: (workspaceSlug: string, data: ICareSubscriptionFormData) => Promise<void>;
  fetchCurrentBalance: (workspaceSlug: string) => Promise<void>;
  fetchBalanceHistory: (workspaceSlug: string, months?: number) => Promise<void>;
  fetchActiveTimer: (workspaceSlug: string) => Promise<void>;
  fetchWorklogEntries: (workspaceSlug: string, projectId: string, issueId: string) => Promise<void>;
  createWorklogEntry: (
    workspaceSlug: string,
    projectId: string,
    issueId: string,
    data: IWorklogEntryFormData
  ) => Promise<IWorklogEntry>;
  deleteWorklogEntry: (workspaceSlug: string, projectId: string, issueId: string, entryId: string) => Promise<void>;
  startTimer: (
    workspaceSlug: string,
    projectId: string,
    issueId: string,
    data?: IWorklogTimerStartData
  ) => Promise<IWorklogEntry>;
  stopTimer: (
    workspaceSlug: string,
    projectId: string,
    issueId: string,
    description: string,
    billingStatus?: string
  ) => Promise<IWorklogEntry>;
}

export class CareStore implements ICareStore {
  subscription: ICareSubscription | null = null;
  currentBalance: IMonthlyBalance | null = null;
  balanceHistory: IMonthlyBalance[] = [];
  activeTimer: IWorklogEntry | null = null;
  worklogEntries: Record<string, IWorklogEntry[]> = {};
  loader = false;

  constructor(private rootStore: CoreRootStore) {
    makeObservable(this, {
      subscription: observable,
      currentBalance: observable,
      balanceHistory: observable,
      activeTimer: observable,
      worklogEntries: observable,
      loader: observable.ref,
      hasActiveSubscription: computed,
      remainingMinutes: computed,
      consumptionPercentage: computed,
      fetchSubscription: action,
      updateSubscription: action,
      fetchCurrentBalance: action,
      fetchBalanceHistory: action,
      fetchActiveTimer: action,
      fetchWorklogEntries: action,
      createWorklogEntry: action,
      deleteWorklogEntry: action,
      startTimer: action,
      stopTimer: action,
    });
  }

  get hasActiveSubscription(): boolean {
    return !!this.subscription?.is_active;
  }

  get remainingMinutes(): number {
    return this.currentBalance?.remaining_minutes ?? 0;
  }

  get consumptionPercentage(): number {
    return this.currentBalance?.consumption_percentage ?? 0;
  }

  fetchSubscription = async (workspaceSlug: string) => {
    try {
      const data = await careService.getSubscription(workspaceSlug);
      runInAction(() => {
        this.subscription = data;
      });
    } catch {
      runInAction(() => {
        this.subscription = null;
      });
    }
  };

  updateSubscription = async (workspaceSlug: string, data: ICareSubscriptionFormData) => {
    const result = await careService.updateSubscription(workspaceSlug, data);
    runInAction(() => {
      this.subscription = result;
    });
  };

  fetchCurrentBalance = async (workspaceSlug: string) => {
    try {
      const data = await careService.getCurrentBalance(workspaceSlug);
      runInAction(() => {
        this.currentBalance = data;
      });
    } catch {
      runInAction(() => {
        this.currentBalance = null;
      });
    }
  };

  fetchBalanceHistory = async (workspaceSlug: string, months = 12) => {
    const data = await careService.getBalanceHistory(workspaceSlug, months);
    runInAction(() => {
      this.balanceHistory = data;
    });
  };

  fetchActiveTimer = async (workspaceSlug: string) => {
    try {
      const data = await careService.getActiveTimer(workspaceSlug);
      runInAction(() => {
        this.activeTimer = data;
      });
    } catch {
      runInAction(() => {
        this.activeTimer = null;
      });
    }
  };

  fetchWorklogEntries = async (workspaceSlug: string, projectId: string, issueId: string) => {
    this.loader = true;
    try {
      const data = await careService.getWorklogEntries(workspaceSlug, projectId, issueId);
      runInAction(() => {
        this.worklogEntries[issueId] = data;
        this.loader = false;
      });
    } catch {
      runInAction(() => {
        this.loader = false;
      });
    }
  };

  createWorklogEntry = async (
    workspaceSlug: string,
    projectId: string,
    issueId: string,
    data: IWorklogEntryFormData
  ): Promise<IWorklogEntry> => {
    const entry = await careService.createWorklogEntry(workspaceSlug, projectId, issueId, data);
    runInAction(() => {
      const existing = this.worklogEntries[issueId] || [];
      this.worklogEntries[issueId] = [entry, ...existing];
    });
    // Refresh balance after logging time
    this.fetchCurrentBalance(workspaceSlug);
    return entry;
  };

  deleteWorklogEntry = async (workspaceSlug: string, projectId: string, issueId: string, entryId: string) => {
    await careService.deleteWorklogEntry(workspaceSlug, projectId, issueId, entryId);
    runInAction(() => {
      const existing = this.worklogEntries[issueId] || [];
      this.worklogEntries[issueId] = existing.filter((e) => e.id !== entryId);
    });
    this.fetchCurrentBalance(workspaceSlug);
  };

  startTimer = async (
    workspaceSlug: string,
    projectId: string,
    issueId: string,
    data?: IWorklogTimerStartData
  ): Promise<IWorklogEntry> => {
    const entry = await careService.startTimer(workspaceSlug, projectId, issueId, data);
    runInAction(() => {
      this.activeTimer = entry;
    });
    return entry;
  };

  stopTimer = async (
    workspaceSlug: string,
    projectId: string,
    issueId: string,
    description: string,
    billingStatus?: string
  ): Promise<IWorklogEntry> => {
    const entry = await careService.stopTimer(workspaceSlug, projectId, issueId, {
      description,
      billing_status: billingStatus as any,
    });
    runInAction(() => {
      this.activeTimer = null;
      // Add stopped entry to the issue's worklog list
      const existing = this.worklogEntries[issueId] || [];
      this.worklogEntries[issueId] = [entry, ...existing.filter((e) => e.id !== entry.id)];
    });
    this.fetchCurrentBalance(workspaceSlug);
    return entry;
  };
}
