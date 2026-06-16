export type TBillingStatus = "billable" | "gift" | "self_caused";
export type TEntryType = "tracked" | "manual";
export type TRecurrenceType = "monthly_date" | "interval_days";

export interface ICareSubscription {
  id: string;
  project: string;
  project_name: string | null;
  workspace: string;
  monthly_hours: number;
  package_label: string;
  started_at: string;
  is_active: boolean;
  customer_name: string;
  customer_email: string;
  report_bcc: string;
  report_enabled: boolean;
  weekly_report_enabled: boolean;
  expert_ids: string[];
  created_at: string;
  updated_at: string;
}

export interface ICareSubscriptionFormData {
  monthly_hours?: number;
  package_label?: string;
  started_at?: string;
  is_active?: boolean;
  customer_name?: string;
  customer_email?: string;
  report_bcc?: string;
  report_enabled?: boolean;
  weekly_report_enabled?: boolean;
  expert_ids?: string[];
}

export interface IMonthlyBalance {
  id: string;
  project: string;
  project_name: string | null;
  workspace: string;
  year: number;
  month: number;
  base_hours: number;
  base_minutes: number;
  rolled_over_minutes: number;
  borrowed_minutes: number;
  consumed_minutes: number;
  total_available_minutes: number;
  remaining_minutes: number;
  consumption_percentage: number;
  is_closed: boolean;
  created_at: string;
  updated_at: string;
}

export interface ICareOverviewItem {
  project_id: string;
  project_name: string;
  has_subscription: boolean;
  package_label: string;
  monthly_hours: number;
  is_active: boolean;
  base_minutes: number;
  total_available_minutes: number;
  consumed_minutes: number;
  remaining_minutes: number;
  consumption_percentage: number;
  year: number;
  month: number;
}

export interface IWorklogEntry {
  id: string;
  workspace: string;
  project: string;
  issue: string;
  logged_by: string;
  logged_by_detail: {
    id: string;
    display_name: string;
    avatar: string;
  } | null;
  description: string;
  duration_minutes: number;
  started_at: string | null;
  ended_at: string | null;
  is_running: boolean;
  entry_type: TEntryType;
  billing_status: TBillingStatus;
  gift_reason: string;
  created_at: string;
  updated_at: string;
  created_by: string;
}

export interface IWorklogEntryFormData {
  description: string;
  duration_minutes: number;
  started_at?: string;
  billing_status?: TBillingStatus;
  gift_reason?: string;
}

export interface IWorklogTimerStartData {
  description?: string;
  force_stop?: boolean;
}

export interface IWorklogTimerStopData {
  description: string;
  billing_status?: TBillingStatus;
}

export interface IMonthWorklogEntry {
  id: string;
  description: string;
  duration_minutes: number;
  billing_status: TBillingStatus;
  gift_reason: string;
  logged_by: { id: string; display_name: string } | null;
  started_at: string | null;
}

export interface IMonthWorklogGroup {
  issue_id: string;
  issue_title: string;
  entries: IMonthWorklogEntry[];
  total_minutes: number;
}

export interface IIssueRecurrence {
  id: string;
  template_issue: string;
  recurrence_type: TRecurrenceType;
  day_of_month: number | null;
  interval_days: number | null;
  estimated_minutes: number;
  next_occurrence_at: string;
  is_active: boolean;
  last_generated_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface IIssueRecurrenceFormData {
  recurrence_type: TRecurrenceType;
  day_of_month?: number | null;
  interval_days?: number | null;
  estimated_minutes?: number;
  is_active?: boolean;
}
