import { apiCall } from "@/lib/api";

type Primitive = string | number | boolean | null | undefined;
type UnknownRecord = Record<string, unknown>;

export interface CompanyStructureCompanyOption {
  id: string;
  name: string;
  code: string;
}

export interface CompanyStructureUserOption {
  id: string;
  name: string;
  username: string;
  email: string;
  label: string;
}

export interface CompanyStructureRecord {
  id: string;
  companyId: string;
  companyName: string;
  unitBisnisId: string | null;
  unitBisnisName: string;
  parentId: string | null;
  userDefaultId: string | null;
  userName: string;
  userUsername: string;
  userEmail: string;
  jabatan: string;
  level: number;
  sequence: number;
  isActive: boolean;
  effectiveStart: string | null;
  effectiveEnd: string | null;
  catatan: string | null;
  avatarInitials: string;
  raw: UnknownRecord;
}

export interface CompanyStructureTreeNode extends CompanyStructureRecord {
  children: CompanyStructureTreeNode[];
}

export interface CompanyStructureSummary {
  total: number;
  active: number;
  roots: number;
  vacancy: number;
  maxLevel: number;
}

export interface CompanyStructureFormValues {
  companyId: string;
  unitBisnisId: string | null;
  parentId: string | null;
  userDefaultId: string | null;
  jabatan: string;
  level: number;
  sequence: number;
  effectiveStart: string | null;
  effectiveEnd: string | null;
  isActive: boolean;
  catatan: string;
}

export interface CompanyStructureMutationPayload {
  company_id: string;
  unit_bisnis_id: string | null;
  parent_id: string | null;
  user_default_id: string | null;
  jabatan: string;
  level: number;
  sequence: number;
  effective_start: string | null;
  effective_end: string | null;
  is_active: boolean;
  catatan: string | null;
}

const USER_INCLUDE =
  "user_default:id|name|username,m_unit_bisnis:id|nama_comp|kode_unit_bisnis,m_company:id|nama";

const asRecord = (value: unknown): UnknownRecord =>
  value && typeof value === "object" ? (value as UnknownRecord) : {};

const asString = (value: unknown): string => {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  return "";
};

const asNullableString = (value: unknown): string | null => {
  const normalized = asString(value);
  return normalized || null;
};

const normalizeDateOnly = (value: unknown): string | null => {
  const normalized = asNullableString(value);
  if (!normalized) return null;

  const matchedDate = normalized.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  return matchedDate ?? normalized;
};

const asNumber = (value: Primitive, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const asBoolean = (value: unknown): boolean => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;

  const normalized = asString(value).toLowerCase();
  return ["1", "true", "t", "yes", "y", "aktif", "active"].includes(normalized);
};

const pickFirstString = (...values: unknown[]) => {
  for (const value of values) {
    const normalized = asString(value);
    if (normalized) return normalized;
  }

  return "";
};

const createInitials = (label: string) => {
  const parts = label.split(/\s+/).filter(Boolean).slice(0, 2);

  if (parts.length === 0) return "NA";
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
};

const normalizeCompany = (
  item: unknown,
): CompanyStructureCompanyOption | null => {
  const record = asRecord(item);
  const id = pickFirstString(record.id, record.company_id, record.value);
  const name = pickFirstString(
    record.nama_comp,
    record.nama_company,
    record.name,
    record.nama,
    record.label,
  );

  if (!id || !name) return null;

  return {
    id,
    name,
    code: pickFirstString(
      record.kode,
      record.kode_company,
      record.kode_comp,
      record.code,
    ),
  };
};

const normalizeUser = (item: unknown): CompanyStructureUserOption | null => {
  const record = asRecord(item);
  const id = pickFirstString(record.id, record.user_default_id, record.value);
  const name = pickFirstString(record.name, record.nama_user, record.nama);

  if (!id || !name) return null;

  const username = pickFirstString(record.username, record.user_code);
  const email = pickFirstString(record.email);
  const subtitle = username || email;

  return {
    id,
    name,
    username,
    email,
    label: subtitle ? `${name} (${subtitle})` : name,
  };
};

const normalizeStructureRecord = (
  item: unknown,
): CompanyStructureRecord | null => {
  const record = asRecord(item);
  const user = asRecord(record.user_default);
  const unitBisnis = asRecord(record.m_unit_bisnis ?? record.unit_bisnis);
  const company = asRecord(record.m_company);
  const id = pickFirstString(record.id);
  if (!id) return null;

  const companyId = pickFirstString(record.company_id);
  const companyName = pickFirstString(company.nama, "Tanpa Company");
  const unitBisnisId = asNullableString(record.unit_bisnis_id ?? unitBisnis.id);
  const unitBisnisName = pickFirstString(
    unitBisnis.nama_comp,
    unitBisnis.nama,
    record.unit_bisnis_name,
  );
  const userName = pickFirstString(
    user.name,
    record.user_name,
    record.nama_user,
    record.employee_name,
  );
  const userUsername = pickFirstString(
    user.username,
    record.username,
    record.user_code,
  );
  const userEmail = pickFirstString(user.email, record.email);
  const jabatan = pickFirstString(
    record.jabatan,
    record.position_name,
    record.title,
    "Untitled Position",
  );
  const catatan = asNullableString(
    record.catatan ?? record.note ?? record.notes,
  );

  return {
    id,
    companyId,
    companyName,
    unitBisnisId,
    unitBisnisName,
    parentId: asNullableString(record.parent_id),
    userDefaultId: asNullableString(record.user_default_id ?? user.id),
    userName,
    userUsername,
    userEmail,
    jabatan,
    level: asNumber(record.level as Primitive, 0),
    sequence: asNumber(record.sequence as Primitive, 0),
    isActive: asBoolean(record.is_active),
    effectiveStart: normalizeDateOnly(record.effective_start),
    effectiveEnd: normalizeDateOnly(record.effective_end),
    catatan,
    avatarInitials: createInitials(userName || jabatan),
    raw: record,
  };
};

const createStructureQuery = (companyId?: string) => {
  const queryParams = new URLSearchParams({
    no_pagination: "true",
    order_by: "sequence",
    order_type: "ASC",
    include: USER_INCLUDE,
  });

  if (companyId) {
    queryParams.append("filter_column_company_id", companyId);
  }

  return queryParams.toString();
};

export const COMPANY_STRUCTURE_FORM_DEFAULTS: CompanyStructureFormValues = {
  companyId: "",
  unitBisnisId: null,
  parentId: null,
  userDefaultId: null,
  jabatan: "",
  level: 1,
  sequence: 1,
  effectiveStart: null,
  effectiveEnd: null,
  isActive: true,
  catatan: "",
};

export function createCompanyStructureFormValues(
  partial: Partial<CompanyStructureFormValues> = {},
): CompanyStructureFormValues {
  return {
    ...COMPANY_STRUCTURE_FORM_DEFAULTS,
    ...partial,
  };
}

export function mapCompanyStructureRecordToFormValues(
  record: CompanyStructureRecord,
): CompanyStructureFormValues {
  return createCompanyStructureFormValues({
    companyId: record.companyId,
    unitBisnisId: record.unitBisnisId,
    parentId: record.parentId,
    userDefaultId: record.userDefaultId,
    jabatan: record.jabatan,
    level: record.level,
    sequence: record.sequence,
    effectiveStart: record.effectiveStart,
    effectiveEnd: record.effectiveEnd,
    isActive: record.isActive,
    catatan: record.catatan ?? "",
  });
}

export function mapCompanyStructureFormToPayload(
  values: CompanyStructureFormValues,
): CompanyStructureMutationPayload {
  return {
    company_id: values.companyId,
    unit_bisnis_id: values.unitBisnisId || null,
    parent_id: values.parentId || null,
    user_default_id: values.userDefaultId || null,
    jabatan: values.jabatan.trim(),
    level: Number(values.level) || 0,
    sequence: Number(values.sequence) || 0,
    effective_start: values.effectiveStart || null,
    effective_end: values.effectiveEnd || null,
    is_active: values.isActive,
    catatan: values.catatan.trim() || null,
  };
}

export async function getCompanyStructureCompanies(): Promise<
  CompanyStructureCompanyOption[]
> {
  const response = await apiCall<{ status: string; data: unknown[] }>(
    "/dynamic/m_company?no_pagination=true",
    {
      method: "GET",
    },
  );

  return response.data
    .map(normalizeCompany)
    .filter((item): item is CompanyStructureCompanyOption => Boolean(item))
    .sort((left, right) => left.name.localeCompare(right.name));
}

export async function getCompanyStructureUsers(): Promise<
  CompanyStructureUserOption[]
> {
  const response = await apiCall<{ status: string; data: unknown[] }>(
    "/dynamic/user_default?no_pagination=true&include=m_company",
    { method: "GET" },
  );

  return response.data
    .map(normalizeUser)
    .filter((item): item is CompanyStructureUserOption => Boolean(item))
    .sort((left, right) => left.name.localeCompare(right.name));
}

export async function getCompanyStructureRecords(
  companyId?: string,
): Promise<CompanyStructureRecord[]> {
  const response = await apiCall<{ status: string; data: unknown[] }>(
    `/dynamic/m_company_structure?${createStructureQuery(companyId)}`,
    { method: "GET" },
  );

  return response.data
    .map(normalizeStructureRecord)
    .filter((item): item is CompanyStructureRecord => Boolean(item))
    .sort((left, right) => {
      if (left.level !== right.level) return left.level - right.level;
      if (left.sequence !== right.sequence)
        return left.sequence - right.sequence;
      return left.jabatan.localeCompare(right.jabatan);
    });
}

export async function createCompanyStructure(
  payload: CompanyStructureMutationPayload,
): Promise<{ status: string; data: unknown }> {
  return apiCall("/dynamic/m_company_structure", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateCompanyStructure(
  id: string,
  payload: CompanyStructureMutationPayload,
): Promise<{ status: string; data: unknown }> {
  return apiCall(`/dynamic/m_company_structure/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteCompanyStructure(
  id: string,
): Promise<{ status: string; data: unknown }> {
  return apiCall(`/dynamic/m_company_structure/${id}`, {
    method: "DELETE",
  });
}

export function buildCompanyStructureTree(
  records: CompanyStructureRecord[],
): CompanyStructureTreeNode[] {
  const nodeMap = new Map<string, CompanyStructureTreeNode>();

  records.forEach((record) => {
    nodeMap.set(record.id, {
      ...record,
      children: [],
    });
  });

  const roots: CompanyStructureTreeNode[] = [];

  nodeMap.forEach((node) => {
    if (node.parentId && nodeMap.has(node.parentId)) {
      nodeMap.get(node.parentId)?.children.push(node);
      return;
    }

    roots.push(node);
  });

  const sortNodes = (nodes: CompanyStructureTreeNode[]) => {
    nodes.sort((left, right) => {
      if (left.sequence !== right.sequence)
        return left.sequence - right.sequence;
      if (left.level !== right.level) return left.level - right.level;
      return left.jabatan.localeCompare(right.jabatan);
    });

    nodes.forEach((node) => sortNodes(node.children));
  };

  sortNodes(roots);
  return roots;
}

export function filterCompanyStructureRecords(
  records: CompanyStructureRecord[],
  options: { search?: string; showInactive?: boolean } = {},
): CompanyStructureRecord[] {
  const showInactive = options.showInactive ?? false;
  const search = asString(options.search).toLowerCase();

  const baseRecords = showInactive
    ? records
    : records.filter((record) => record.isActive);
  if (!search) return baseRecords;

  const recordMap = new Map(records.map((record) => [record.id, record]));
  const includedIds = new Set<string>();

  baseRecords.forEach((record) => {
    const searchableText = [
      record.jabatan,
      record.userName,
      record.userUsername,
      record.userEmail,
      record.companyName,
      record.unitBisnisName,
      record.catatan ?? "",
    ]
      .join(" ")
      .toLowerCase();

    if (!searchableText.includes(search)) return;

    let current: CompanyStructureRecord | undefined = record;
    while (current) {
      includedIds.add(current.id);
      current = current.parentId ? recordMap.get(current.parentId) : undefined;
    }
  });

  return baseRecords.filter((record) => includedIds.has(record.id));
}

export function summarizeCompanyStructure(
  records: CompanyStructureRecord[],
): CompanyStructureSummary {
  return {
    total: records.length,
    active: records.filter((record) => record.isActive).length,
    roots: records.filter((record) => !record.parentId).length,
    vacancy: records.filter((record) => !record.userName).length,
    maxLevel: records.reduce(
      (maxLevel, record) => Math.max(maxLevel, record.level),
      0,
    ),
  };
}

export function formatCompanyStructureDate(value: string | null) {
  if (!value) return "-";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsed);
}
