// ============================================================================
// CENTRAL STATUS COLOR REGISTRY
// ----------------------------------------------------------------------------
// Single source of truth for status colors across the whole app.
// Covers approval statuses (DRAFT, IN APPROVAL, APPROVED, REJECT, REVISI),
// document lifecycle statuses (POST, WAITING BIAYA KIRIM, LOCK, VOID),
// transaction statuses (OUTSTANDING, PARTIAL, RECEIVED, INVOICED, CLOSED,
// ORDERED) and active flags (AKTIF, NONAKTIF).
//
// Conventional color mapping:
//   gray    -> neutral / not yet submitted (DRAFT, CLOSED, NONAKTIF)
//   blue    -> in progress (IN APPROVAL, PARTIAL, ALL filter highlight)
//   green   -> success / approved (APPROVED, RECEIVED, AKTIF)
//   teal    -> finalized / posted (POST)
//   red     -> error / rejected / voided (REJECT, VOID)
//   yellow  -> needs attention (REVISI)
//   amber   -> waiting (WAITING BIAYA KIRIM)
//   slate   -> locked (LOCK)
//   orange  -> outstanding (OUTSTANDING)
//   purple  -> invoiced (INVOICED)
//   indigo  -> ordered (ORDERED)
//
// IMPORTANT: helpers NEVER return an empty string for a known status, and
// fall back to a neutral gray badge for unknown statuses so nothing is left
// uncolored.
// ============================================================================

export type ApprovalStatus =
  | "DRAFT"
  | "IN APPROVAL"
  | "APPROVED"
  | "REJECT"
  | "REVISI";

// Canonical status keys understood by the registry.
export type StatusKey =
  | ApprovalStatus
  | "APPROVED SYSTEM"
  | "POST"
  | "WAITING BIAYA KIRIM"
  | "LOCK"
  | "VOID"
  | "OUTSTANDING"
  | "PARTIAL"
  | "RECEIVED"
  | "INVOICED"
  | "CLOSED"
  | "ORDERED"
  | "AKTIF"
  | "NONAKTIF"
  | "CONFIRM";

// ----------------------------------------------------------------------------
// COLOR PALETTE (light + dark)
// ----------------------------------------------------------------------------
type StatusColor =
  | "gray"
  | "blue"
  | "green"
  | "teal"
  | "red"
  | "yellow"
  | "amber"
  | "slate"
  | "orange"
  | "purple"
  | "indigo";

const BADGE_CLASS_BY_COLOR: Record<StatusColor, string> = {
  gray: "border border-gray-200 bg-gray-100 text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200",
  blue: "border border-blue-200 bg-blue-100 text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200",
  green:
    "border border-green-200 bg-green-100 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200",
  teal: "border border-teal-200 bg-teal-100 text-teal-800 dark:border-teal-800 dark:bg-teal-950 dark:text-teal-200",
  red: "border border-red-200 bg-red-100 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200",
  yellow:
    "border border-yellow-200 bg-yellow-100 text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-200",
  amber:
    "border border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200",
  slate:
    "border border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200",
  orange:
    "border border-orange-200 bg-orange-100 text-orange-800 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-200",
  purple:
    "border border-purple-200 bg-purple-100 text-purple-800 dark:border-purple-800 dark:bg-purple-950 dark:text-purple-200",
  indigo:
    "border border-indigo-200 bg-indigo-100 text-indigo-800 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-200",
};

const FILTER_CLASS_BY_COLOR: Record<StatusColor, string> = {
  gray: "border-gray-500 bg-gray-100 text-gray-800 hover:bg-gray-100 dark:border-gray-500 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-800",
  blue: "border-blue-500 bg-blue-100 text-blue-800 hover:bg-blue-100 dark:border-blue-500 dark:bg-blue-950 dark:text-blue-200 dark:hover:bg-blue-950",
  green:
    "border-green-500 bg-green-100 text-green-800 hover:bg-green-100 dark:border-green-500 dark:bg-green-950 dark:text-green-200 dark:hover:bg-green-950",
  teal: "border-teal-500 bg-teal-100 text-teal-800 hover:bg-teal-100 dark:border-teal-500 dark:bg-teal-950 dark:text-teal-200 dark:hover:bg-teal-950",
  red: "border-red-500 bg-red-100 text-red-800 hover:bg-red-100 dark:border-red-500 dark:bg-red-950 dark:text-red-200 dark:hover:bg-red-950",
  yellow:
    "border-yellow-500 bg-yellow-100 text-yellow-800 hover:bg-yellow-100 dark:border-yellow-500 dark:bg-yellow-950 dark:text-yellow-200 dark:hover:bg-yellow-950",
  amber:
    "border-amber-500 bg-amber-100 text-amber-800 hover:bg-amber-100 dark:border-amber-500 dark:bg-amber-950 dark:text-amber-200 dark:hover:bg-amber-950",
  slate:
    "border-slate-500 bg-slate-100 text-slate-700 hover:bg-slate-100 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-800",
  orange:
    "border-orange-500 bg-orange-100 text-orange-800 hover:bg-orange-100 dark:border-orange-500 dark:bg-orange-950 dark:text-orange-200 dark:hover:bg-orange-950",
  purple:
    "border-purple-500 bg-purple-100 text-purple-800 hover:bg-purple-100 dark:border-purple-500 dark:bg-purple-950 dark:text-purple-200 dark:hover:bg-purple-950",
  indigo:
    "border-indigo-500 bg-indigo-100 text-indigo-800 hover:bg-indigo-100 dark:border-indigo-500 dark:bg-indigo-950 dark:text-indigo-200 dark:hover:bg-indigo-950",
};

// Map each canonical status to its conventional color.
const STATUS_COLOR: Record<StatusKey, StatusColor> = {
  DRAFT: "gray",
  "IN APPROVAL": "blue",
  APPROVED: "green",
  "APPROVED SYSTEM": "green",
  REJECT: "red",
  REVISI: "yellow",
  POST: "teal",
  "WAITING BIAYA KIRIM": "amber",
  LOCK: "slate",
  VOID: "red",
  OUTSTANDING: "orange",
  PARTIAL: "blue",
  RECEIVED: "green",
  INVOICED: "purple",
  CLOSED: "gray",
  ORDERED: "indigo",
  AKTIF: "green",
  NONAKTIF: "gray",
  CONFIRM: "green",
};

const NEUTRAL_BADGE_CLASS = BADGE_CLASS_BY_COLOR.gray;

// ----------------------------------------------------------------------------
// OPTIONS
// ----------------------------------------------------------------------------
export const APPROVAL_STATUS_OPTIONS: ApprovalStatus[] = [
  "DRAFT",
  "IN APPROVAL",
  "APPROVED",
  "REJECT",
  "REVISI",
];

// ----------------------------------------------------------------------------
// NORMALIZATION
// ----------------------------------------------------------------------------
/**
 * Normalize a raw status string into a canonical {@link StatusKey}.
 * Handles common aliases (REJECTED, REVISE, WAITING_BIAYA_KIRIM, LOCKED, ...)
 * and the "INVOICED 1/2" suffix variants. Returns null for unknown values.
 */
export function normalizeStatusKey(status?: string | null): StatusKey | null {
  const raw = (status || "").trim().toUpperCase().replace(/_/g, " ");

  if (!raw) return null;

  // Aliases
  if (raw === "REJECTED") return "REJECT";
  if (raw === "REVISE" || raw === "REVISED") return "REVISI";
  if (raw === "POSTED") return "POST";
  if (raw === "LOCKED") return "LOCK";
  if (raw === "VOIDED") return "VOID";
  if (raw === "ACTIVE") return "AKTIF";
  if (raw === "INACTIVE" || raw === "NON AKTIF" || raw === "NON-AKTIF")
    return "NONAKTIF";

  // INVOICED with trailing counters e.g. "INVOICED 1/2"
  if (raw === "INVOICED" || raw.startsWith("INVOICED ")) return "INVOICED";

  if (raw in STATUS_COLOR) return raw as StatusKey;

  return null;
}

/**
 * Backwards-compatible approval-only normalizer. Returns one of the 5 approval
 * statuses, or null when the status is not an approval status.
 */
export function normalizeApprovalStatus(
  status?: string | null,
): ApprovalStatus | null {
  const key = normalizeStatusKey(status);
  return key && APPROVAL_STATUS_OPTIONS.includes(key as ApprovalStatus)
    ? (key as ApprovalStatus)
    : null;
}

// ----------------------------------------------------------------------------
// BADGE / FILTER CLASS HELPERS (general purpose — cover ALL statuses)
// ----------------------------------------------------------------------------
/**
 * Get the badge class for any status. Never returns empty: unknown statuses
 * fall back to a neutral gray badge so nothing is left uncolored.
 */
export function getStatusBadgeClass(status?: string | null): string {
  const key = normalizeStatusKey(status);
  return key ? BADGE_CLASS_BY_COLOR[STATUS_COLOR[key]] : NEUTRAL_BADGE_CLASS;
}

/**
 * Get the filter-button class for any status when active. Returns an empty
 * string when not active (so the button keeps its default outline style).
 */
export function getStatusFilterClass(
  status: string | null | undefined,
  active: boolean,
): string {
  if (!active) return "";

  // "ALL" / null filter -> neutral blue highlight.
  const raw = (status || "").trim().toUpperCase();
  if (!raw || raw === "ALL") return FILTER_CLASS_BY_COLOR.blue;

  const key = normalizeStatusKey(status);
  return key ? FILTER_CLASS_BY_COLOR[STATUS_COLOR[key]] : FILTER_CLASS_BY_COLOR.gray;
}

/** Convenience helper for the "ALL" filter button highlight. */
export function getAllFilterClass(active: boolean): string {
  return active ? FILTER_CLASS_BY_COLOR.blue : "";
}

// ----------------------------------------------------------------------------
// BACKWARDS-COMPATIBLE APPROVAL HELPERS
// (kept so existing imports keep working; now cover all statuses too)
// ----------------------------------------------------------------------------
export function getApprovalStatusBadgeClass(status?: string | null): string {
  return getStatusBadgeClass(status);
}

export function getApprovalStatusFilterClass(
  status: string,
  active: boolean,
): string {
  return getStatusFilterClass(status, active);
}

/**
 * Render a standalone status badge as an HTML string (used inside
 * DataTable renderHtml callbacks). Displays underscores as spaces.
 */
export function renderApprovalStatusBadge(status?: string | null): string {
  const label = (status || "DRAFT").toString().replace(/_/g, " ");
  const badgeClass = getStatusBadgeClass(status);

  return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badgeClass}">${label}</span>`;
}
