import { action, computed, makeObservable, observable, runInAction } from "mobx";
import type {
  ICareSubscription,
  ICareSubscriptionFormData,
  ICareOverviewItem,
  IMonthlyBalance,
  IMonthWorklogGroup,
  IWorklogEntry,
  IWorklogEntryFormData,
  IWorklogTimerStartData,
} from "@plane/types";
import careService from "@/plane-web/services/care.service";
import type { CoreRootStore } from "@/store/root.store";

export interface ICareStore {
  // observables
  subscriptions: Record<string, ICareSubscription | null>; // project_id -> subscription
  balances: Record<string, IMonthlyBalance | null>; // project_id -> current balance
  balanceHistories: Record<string, IMonthlyBalance[]>; // project_id -> history
  monthWorklogs: Record<string, IMonthWorklogGroup[]>; // "projectId-year-month" -> groups
  overview: ICareOverviewItem[];
  activeTimer: IWorklogEntry | null;
  worklogEntries: Record<string, IWorklogEntry[]>; // issue_id -> entries
  loader: boolean;

  // computed
  currentProjectSubscription: ICareSubscription | null;
  currentProjectBalance: IMonthlyBalance | null;
  hasActiveSubscription: boolean;
  remainingMinutes: number;
  consumptionPercentage: number;

  // actions
  fetchSubscription: (workspaceSlug: string, projectId: string) => Promise<void>;
  updateSubscription: (workspaceSlug: string, projectId: string, data: ICareSubscriptionFormData) => Promise<void>;
  fetchCurrentBalance: (workspaceSlug: string, projectId: string) => Promise<void>;
  fetchBalanceHistory: (workspaceSlug: string, projectId: string, months?: number) => Promise<void>;
  fetchMonthWorklogs: (workspaceSlug: string, projectId: string, year: number, month: number) => Promise<void>;
  fetchCareOverview: (workspaceSlug: string) => Promise<void>;
  fetchActiveTimer: (workspaceSlug: string) => Promise<void>;
  fetchWorklogEntries: (workspaceSlug: string, projectId: string, issueId: string) => Promise<void>;
  createWorklogEntry: (
    workspaceSlug: string,
    projectId: string,
    issueId: string,
    data: IWorklogEntryFormData
  ) => Promise<IWorklogEntry>;
  updateWorklogEntry: (
    workspaceSlug: string,
    projectId: string,
    issueId: string,
    entryId: string,
    data: Partial<IWorklogEntryFormData>
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

  // helpers
  getSubscription: (projectId: string) => ICareSubscription | null;
  getBalance: (projectId: string) => IMonthlyBalance | null;
  getBalanceHistory: (projectId: string) => IMonthlyBalance[];
  getMonthWorklogs: (projectId: string, year: number, month: number) => IMonthWorklogGroup[];
}

export class CareStore implements ICareStore {
  subscriptions: Record<string, ICareSubscription | null> = {};
  balances: Record<string, IMonthlyBalance | null> = {};
  balanceHistories: Record<string, IMonthlyBalance[]> = {};
  monthWorklogs: Record<string, IMonthWorklogGroup[]> = {};
  overview: ICareOverviewItem[] = [];
  activeTimer: IWorklogEntry | null = null;
  worklogEntries: Record<string, IWorklogEntry[]> = {};
  loader = false;

  // Track which project the user is currently viewing
  private _currentProjectId: string | null = null;

  constructor(private rootStore: CoreRootStore) {
    makeObservable(this, {
      subscriptions: observable,
      balances: observable,
      balanceHistories: observable,
      monthWorklogs: observable,
      overview: observable,
      activeTimer: observable,
      worklogEntries: observable,
      loader: observable.ref,
      currentProjectSubscription: computed,
      currentProjectBalance: computed,
      hasActiveSubscription: computed,
      remainingMinutes: computed,
      consumptionPercentage: computed,
      fetchSubscription: action,
      updateSubscription: action,
      fetchCurrentBalance: action,
      fetchBalanceHistory: action,
      fetchMonthWorklogs: action,
      fetchCareOverview: action,
      fetchActiveTimer: action,
      fetchWorklogEntries: action,
      createWorklogEntry: action,
      updateWorklogEntry: action,
      deleteWorklogEntry: action,
      startTimer: action,
      stopTimer: action,
    });
  }

  get currentProjectSubscription(): ICareSubscription | null {
    if (!this._currentProjectId) return null;
    return this.subscriptions[this._currentProjectId] ?? null;
  }

  get currentProjectBalance(): IMonthlyBalance | null {
    if (!this._currentProjectId) return null;
    return this.balances[this._currentProjectId] ?? null;
  }

  get hasActiveSubscription(): boolean {
    return !!this.currentProjectSubscription?.is_active;
  }

  get remainingMinutes(): number {
    return this.currentProjectBalance?.remaining_minutes ?? 0;
  }

  get consumptionPercentage(): number {
    return this.currentProjectBalance?.consumption_percentage ?? 0;
  }

  // Helpers
  getSubscription = (projectId: string): ICareSubscription | null => {
    return this.subscriptions[projectId] ?? null;
  };

  getBalance = (projectId: string): IMonthlyBalance | null => {
    return this.balances[projectId] ?? null;
  };

  getBalanceHistory = (projectId: string): IMonthlyBalance[] => {
    return this.balanceHistories[projectId] ?? [];
  };

  getMonthWorklogs = (projectId: string, year: number, month: number): IMonthWorklogGroup[] => {
    return this.monthWorklogs[`${projectId}-${year}-${month}`] ?? [];
  };

  fetchSubscription = async (workspaceSlug: string, projectId: string) => {
    this._currentProjectId = projectId;
    try {
      const data = await careService.getSubscription(workspaceSlug, projectId);
      runInAction(() => {
        this.subscriptions[projectId] = data;
      });
    } catch {
      runInAction(() => {
        this.subscriptions[projectId] = null;
      });
    }
  };

  updateSubscription = async (workspaceSlug: string, projectId: string, data: ICareSubscriptionFormData) => {
    const result = await careService.updateSubscription(workspaceSlug, projectId, data);
    runInAction(() => {
      this.subscriptions[projectId] = result;
    });
  };

  fetchCurrentBalance = async (workspaceSlug: string, projectId: string) => {
    this._currentProjectId = projectId;
    try {
      const data = await careService.getCurrentBalance(workspaceSlug, projectId);
      runInAction(() => {
        this.balances[projectId] = data;
      });
    } catch {
      runInAction(() => {
        this.balances[projectId] = null;
      });
    }
  };

  fetchBalanceHistory = async (workspaceSlug: string, projectId: string, months = 12) => {
    const data = await careService.getBalanceHistory(workspaceSlug, projectId, months);
    runInAction(() => {
      this.balanceHistories[projectId] = data;
    });
  };

  fetchMonthWorklogs = async (workspaceSlug: string, projectId: string, year: number, month: number) => {
    const key = `${projectId}-${year}-${month}`;
    try {
      const data = await careService.getMonthWorklogs(workspaceSlug, projectId, year, month);
      runInAction(() => {
        this.monthWorklogs[key] = data;
      });
    } catch {
      runInAction(() => {
        this.monthWorklogs[key] = [];
      });
    }
  };

  fetchCareOverview = async (workspaceSlug: string) => {
    try {
      const data = await careService.getCareOverview(workspaceSlug);
      runInAction(() => {
        this.overview = data;
      });
    } catch {
      runInAction(() => {
        this.overview = [];
      });
    }
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
    this.fetchCurrentBalance(workspaceSlug, projectId);
    return entry;
  };

  updateWorklogEntry = async (
    workspaceSlug: string,
    projectId: string,
    issueId: string,
    entryId: string,
    data: Partial<IWorklogEntryFormData>
  ): Promise<IWorklogEntry> => {
    const updated = await careService.updateWorklogEntry(workspaceSlug, projectId, issueId, entryId, data);
    runInAction(() => {
      const existing = this.worklogEntries[issueId] || [];
      this.worklogEntries[issueId] = existing.map((e) => (e.id === entryId ? updated : e));
    });
    this.fetchCurrentBalance(workspaceSlug, projectId);
    return updated;
  };

  deleteWorklogEntry = async (workspaceSlug: string, projectId: string, issueId: string, entryId: string) => {
    await careService.deleteWorklogEntry(workspaceSlug, projectId, issueId, entryId);
    runInAction(() => {
      const existing = this.worklogEntries[issueId] || [];
      this.worklogEntries[issueId] = existing.filter((e) => e.id !== entryId);
    });
    this.fetchCurrentBalance(workspaceSlug, projectId);
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
    this.fetchCurrentBalance(workspaceSlug, projectId);
    return entry;
  };
}
