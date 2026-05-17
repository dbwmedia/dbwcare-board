import { API_BASE_URL } from "@plane/constants";
import type {
  ICareSubscription,
  ICareSubscriptionFormData,
  ICareOverviewItem,
  IMonthlyBalance,
  IWorklogEntry,
  IWorklogEntryFormData,
  IWorklogTimerStartData,
  IWorklogTimerStopData,
  IIssueRecurrence,
  IIssueRecurrenceFormData,
} from "@plane/types";
import { APIService } from "@/services/api.service";

class CareService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  // Subscription (project-level)
  async getSubscription(workspaceSlug: string, projectId: string): Promise<ICareSubscription | null> {
    const { data } = await this.get(`/api/workspaces/${workspaceSlug}/projects/${projectId}/care-subscription/`);
    return data;
  }

  async updateSubscription(
    workspaceSlug: string,
    projectId: string,
    payload: ICareSubscriptionFormData
  ): Promise<ICareSubscription> {
    const { data } = await this.patch(
      `/api/workspaces/${workspaceSlug}/projects/${projectId}/care-subscription/`,
      payload
    );
    return data;
  }

  // Balance (project-level)
  async getCurrentBalance(workspaceSlug: string, projectId: string): Promise<IMonthlyBalance | null> {
    const { data } = await this.get(`/api/workspaces/${workspaceSlug}/projects/${projectId}/care-balance/`);
    return data;
  }

  async getBalanceHistory(workspaceSlug: string, projectId: string, months = 12): Promise<IMonthlyBalance[]> {
    const { data } = await this.get(`/api/workspaces/${workspaceSlug}/projects/${projectId}/care-balance/history/`, {
      params: { months },
    });
    return data || [];
  }

  // Admin overview (workspace-level)
  async getCareOverview(workspaceSlug: string): Promise<ICareOverviewItem[]> {
    const { data } = await this.get(`/api/workspaces/${workspaceSlug}/care-overview/`);
    return data || [];
  }

  // Worklog entries
  async getWorklogEntries(workspaceSlug: string, projectId: string, issueId: string): Promise<IWorklogEntry[]> {
    const { data } = await this.get(
      `/api/workspaces/${workspaceSlug}/projects/${projectId}/issues/${issueId}/worklog-entries/`
    );
    return data || [];
  }

  async createWorklogEntry(
    workspaceSlug: string,
    projectId: string,
    issueId: string,
    payload: IWorklogEntryFormData
  ): Promise<IWorklogEntry> {
    const { data } = await this.post(
      `/api/workspaces/${workspaceSlug}/projects/${projectId}/issues/${issueId}/worklog-entries/`,
      payload
    );
    return data;
  }

  async updateWorklogEntry(
    workspaceSlug: string,
    projectId: string,
    issueId: string,
    entryId: string,
    payload: Partial<IWorklogEntryFormData>
  ): Promise<IWorklogEntry> {
    const { data } = await this.patch(
      `/api/workspaces/${workspaceSlug}/projects/${projectId}/issues/${issueId}/worklog-entries/${entryId}/`,
      payload
    );
    return data;
  }

  async deleteWorklogEntry(workspaceSlug: string, projectId: string, issueId: string, entryId: string): Promise<void> {
    await this.delete(
      `/api/workspaces/${workspaceSlug}/projects/${projectId}/issues/${issueId}/worklog-entries/${entryId}/`
    );
  }

  // Timer
  async startTimer(
    workspaceSlug: string,
    projectId: string,
    issueId: string,
    payload?: IWorklogTimerStartData
  ): Promise<IWorklogEntry> {
    const { data } = await this.post(
      `/api/workspaces/${workspaceSlug}/projects/${projectId}/issues/${issueId}/worklog-timer/start/`,
      payload || {}
    );
    return data;
  }

  async stopTimer(
    workspaceSlug: string,
    projectId: string,
    issueId: string,
    payload: IWorklogTimerStopData
  ): Promise<IWorklogEntry> {
    const { data } = await this.post(
      `/api/workspaces/${workspaceSlug}/projects/${projectId}/issues/${issueId}/worklog-timer/stop/`,
      payload
    );
    return data;
  }

  async getActiveTimer(workspaceSlug: string): Promise<IWorklogEntry | null> {
    const { data } = await this.get(`/api/workspaces/${workspaceSlug}/active-timer/`);
    return data;
  }

  // Recurrence
  async getRecurrence(workspaceSlug: string, projectId: string, issueId: string): Promise<IIssueRecurrence | null> {
    const { data } = await this.get(
      `/api/workspaces/${workspaceSlug}/projects/${projectId}/issues/${issueId}/recurrence/`
    );
    return data;
  }

  async createRecurrence(
    workspaceSlug: string,
    projectId: string,
    issueId: string,
    payload: IIssueRecurrenceFormData
  ): Promise<IIssueRecurrence> {
    const { data } = await this.post(
      `/api/workspaces/${workspaceSlug}/projects/${projectId}/issues/${issueId}/recurrence/`,
      payload
    );
    return data;
  }

  async updateRecurrence(
    workspaceSlug: string,
    projectId: string,
    issueId: string,
    payload: Partial<IIssueRecurrenceFormData>
  ): Promise<IIssueRecurrence> {
    const { data } = await this.patch(
      `/api/workspaces/${workspaceSlug}/projects/${projectId}/issues/${issueId}/recurrence/`,
      payload
    );
    return data;
  }

  async deleteRecurrence(workspaceSlug: string, projectId: string, issueId: string): Promise<void> {
    await this.delete(`/api/workspaces/${workspaceSlug}/projects/${projectId}/issues/${issueId}/recurrence/`);
  }
}

const careService = new CareService();
export default careService;
