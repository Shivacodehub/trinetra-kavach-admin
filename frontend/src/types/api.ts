export interface Admin { id: string; email: string; full_name: string; role: string; organization_id: string | null }
export interface LoginResponse { access_token: string; token_type: string; expires_in: number; admin: Admin }
export interface Organization { id: string; name: string; code: string; org_type: string }

export interface DashboardSummary {
  total_workers: number; training_completed: number; pass_rate: number;
  certificates_issued: number; certificates_active: number; certificates_revoked: number;
  active_training: number; failed_assessments: number; modules_completed: number; pending_sync: number;
  system: {
    backend: string; database: string; last_sync_at: string | null;
    sync_last_24h: { accepted: number; duplicate: number; rejected: number };
    environment_note: string;
  };
}
export interface TrendPoint { date: string; completed: number; passed: number; failed: number }
export interface ModulePerformance {
  id: string; name: string; workers_trained: number; completion_rate: number; average_score: number | null; pass_rate: number;
}
export interface AttemptRow {
  id: string; attempt_id: string;
  worker: { id: string; worker_code: string; name: string; organization: string };
  module: { id: string; code: string; name: string };
  scenario: { id: string; name: string };
  status: "in_progress" | "completed" | "abandoned";
  started_at: string; ended_at: string | null; duration_seconds: number | null;
  score: number | null; result: "pass" | "fail" | null; synced_at: string | null; is_demo: boolean; language: string | null;
}
export interface CertificateRow {
  certificate_id: string;
  worker: { id: string; worker_code: string; name: string };
  module: { id: string; name: string };
  score: number; issued_at: string; status: "valid" | "revoked" | "expired";
  verification_count: number; verify_url: string; is_demo: boolean;
}

export interface Paged<T> { items: T[]; total: number; page: number; page_size: number; pages: number }
export type TrainingStatus = "not_started" | "in_progress" | "completed";
export type WorkerCertStatus = "none" | "partial" | "certified";
export interface WorkerRow {
  id: string; worker_code: string; name: string; organization: { id: string; name: string };
  department: string | null; role_title: string | null; preferred_language: "en" | "hi" | "sat";
  modules_completed: number; total_modules: number; average_score: number | null;
  training_status: TrainingStatus; certificate_status: WorkerCertStatus; last_activity_at: string | null; is_active: boolean; is_demo: boolean;
}
export interface WorkerProfile {
  id: string; worker_code: string; name: string; email: string | null; phone: string | null;
  organization: { id: string; name: string }; department: string | null; role_title: string | null;
  preferred_language: "en" | "hi" | "sat"; is_active: boolean; is_demo: boolean; joined_at: string; last_activity_at: string | null;
  summary: { modules_completed: number; total_modules: number; average_score: number | null; pass_rate: number | null; attempts: number; completed_attempts: number; certificates: number };
  behavior_performance: Record<string, number>;
}
export interface ModuleStats {
  id: string; code: string; name: string; description: string; pass_mark: number; config_label: string; content_version: string;
  scenarios: { id: string; name: string }[]; workers_trained: number; attempts_started: number; completed_attempts: number;
  completion_rate: number; average_score: number | null; pass_rate: number; average_duration_seconds: number | null;
}
export interface ModuleAnalytics extends ModuleStats {
  total_attempts: number;
  common_failure_areas: { event_type: string; expected_action: string; category: string | null; occurrences: number; incorrect: number; failure_rate: number }[];
  score_distribution: { range: string; passed: number; failed: number }[];
  pass_fail: { passed: number; failed: number };
  by_organization: { organization: string; attempts: number; average_score: number; pass_rate: number }[];
  by_worker: { worker_code: string; name: string; attempts: number; average_score: number; pass_rate: number }[];
  over_time: { date: string; attempts: number; average_score: number }[];
}
export type Risk = "low" | "medium" | "high" | "critical";
export interface AssessmentEvent {
  sequence: number; timestamp: string; elapsed_seconds: number; event_type: string; category: string | null;
  action_taken: string; expected_action: string; is_correct: boolean; score_impact: number; points_possible: number; risk_level: Risk;
}
export interface AssessmentDetail extends AttemptRow {
  pass_mark: number; score_source: string | null; client_reported_score: number | null; behavior_metrics: Record<string, number> | null;
  certificate_id: string | null; events_total: number; events_correct: number; events: AssessmentEvent[]; config_label: string;
}
export interface CertificateStats { issued: number; active: number; revoked: number; expired: number; expiring_30d: number }
export interface CertificateDetail extends CertificateRow {
  expires_at: string | null; revoked_at: string | null; revoked_reason: string | null; last_verified_at: string | null;
  attempt_id: string; worker_organization: string; scenario: string | null; disclaimer: string; title: string;
}
export type VerifyStatus = "valid" | "revoked" | "expired" | "invalid";
export interface VerifyResponse {
  valid: boolean; status: VerifyStatus; checked_at: string; disclaimer: string;
  certificate: { certificate_id: string; worker_name: string; training: string; score: number; result: string; issued_at: string; revoked_at: string | null } | null;
}
export type ComplianceStatus = "COMPLIANT" | "TRAINING_DUE" | "FAILED" | "NOT_STARTED";
export interface ComplianceRow {
  worker: { id: string; worker_code: string; name: string; organization: string }; module: { id: string; name: string };
  status: ComplianceStatus; completed: boolean; best_score: number | null; certificate_id: string | null;
  certificate_status: "valid" | "revoked" | "expired" | null; last_training_at: string | null;
}
export interface ComplianceResponse extends Paged<ComplianceRow> { summary: Record<ComplianceStatus, number>; note: string }
export interface ReportResponse { kind: string; range: string; columns: string[]; rows: (string | number | null)[][]; total: number; truncated: boolean; note: string }
