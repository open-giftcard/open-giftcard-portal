import type {
  PortalFinancialHistoryPage,
  PortalFinancialHistoryFilters,
  PortalFinancialReconciliation,
  PortalFinancialSummary,
  PortalAuditFilters,
  PortalAuditPage,
  PortalCorporateCreditAllocation,
  PortalCorporateCreditBalance,
  PortalCorporateCreditHistoryPage,
  PortalCorporateCreditReversal,
  PortalBulkGiftCardBatch,
  PortalCardRegisterFilters,
  PortalCardRegisterPage,
  PortalGiftCard,
  PortalGiftCardDistribution,
  PortalGiftCardInventoryPage,
  PortalGiftCardLifecycleAction,
  PortalGiftCardLifecycleDetail,
  PortalGiftCardLifecycleEvent,
  PortalRecipientContactType,
  PortalOrganizationPage,
  PortalOrganization,
  PortalPaymentFilters,
  PortalPaymentReportPage,
  PortalPaymentReceipt,
  PortalPlatformOrganizationPage,
  PortalSession,
  PortalSubsidiary,
  PortalSubsidiaryPage,
  PortalTeamMember,
  PortalTeamPage,
  PortalRole,
  PortalRoleAssignment,
  PortalRoleScope,
  ProblemDetails,
} from "./types";

function auditQuery(
  filters: PortalAuditFilters,
  cursor?: string,
): URLSearchParams {
  const parameters = new URLSearchParams({ limit: "25" });
  if (cursor) {
    parameters.set("cursor", cursor);
  }
  if (filters.operation.trim()) {
    parameters.set("operation", filters.operation.trim());
  }
  if (filters.outcome) {
    parameters.set("outcome", filters.outcome);
  }
  if (filters.correlationId.trim()) {
    parameters.set("correlationId", filters.correlationId.trim());
  }
  return parameters;
}

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly problem: ProblemDetails,
  ) {
    super(problem.title ?? "The request could not be completed.");
  }
}

let antiforgeryToken: string | undefined;

async function getAntiforgeryToken(): Promise<string> {
  if (antiforgeryToken) {
    return antiforgeryToken;
  }

  const response = await fetch("/bff/antiforgery", {
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
    },
  });
  if (!response.ok) {
    throw await toHttpError(response);
  }

  const payload = (await response.json()) as { token?: string };
  if (!payload.token) {
    throw new Error("The portal did not return a security token.");
  }

  antiforgeryToken = payload.token;
  return antiforgeryToken;
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  retryAntiforgery = true,
): Promise<T> {
  const method = init.method?.toUpperCase() ?? "GET";
  const unsafe = !["GET", "HEAD", "OPTIONS"].includes(method);
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");

  if (init.body) {
    headers.set("Content-Type", "application/json");
  }

  if (unsafe) {
    headers.set("X-CSRF-TOKEN", await getAntiforgeryToken());
  }

  const response = await fetch(path, {
    ...init,
    credentials: "same-origin",
    headers,
  });

  if (!response.ok) {
    const error = await toHttpError(response);
    if (
      unsafe &&
      retryAntiforgery &&
      error.problem.type === "https://giftcard.example/problems/antiforgery"
    ) {
      antiforgeryToken = undefined;
      return request<T>(path, init, false);
    }

    throw error;
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

async function toHttpError(response: Response): Promise<HttpError> {
  let problem: ProblemDetails = {};
  if (response.headers.get("content-type")?.includes("json")) {
    problem = (await response.json()) as ProblemDetails;
  }

  return new HttpError(response.status, problem);
}

export const portalApi = {
  getSession: () => request<PortalSession>("/bff/session"),

  login: (email: string, password: string) =>
    request<PortalSession>("/bff/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  logout: () =>
    request<void>("/bff/auth/logout", {
      method: "POST",
    }),

  getOrganizations: () => request<PortalOrganizationPage>("/bff/organizations"),

  getPlatformOrganizations: ({
    search,
    status,
    limit,
    offset,
  }: {
    search: string;
    status: string;
    limit: number;
    offset: number;
  }) => {
    const parameters = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
    });
    if (search) {
      parameters.set("search", search);
    }
    if (status) {
      parameters.set("status", status);
    }

    return request<PortalPlatformOrganizationPage>(
      `/bff/platform/organizations?${parameters.toString()}`,
    );
  },

  getPlatformOrganization: (organizationId: string) =>
    request<PortalOrganization>(
      `/bff/platform/organizations/${encodeURIComponent(organizationId)}`,
    ),

  getPlatformPayments: (filters: PortalPaymentFilters, cursor?: string) => {
    const parameters = new URLSearchParams({ limit: "20" });
    if (cursor) {
      parameters.set("cursor", cursor);
    }
    if (filters.storeReference.trim()) {
      parameters.set("storeReference", filters.storeReference.trim());
    }
    if (filters.state) {
      parameters.set("state", filters.state);
    }
    if (filters.currency.trim()) {
      parameters.set("currency", filters.currency.trim().toUpperCase());
    }
    if (filters.reference.trim()) {
      parameters.set("reference", filters.reference.trim());
    }
    if (filters.occurredFrom) {
      parameters.set("occurredFrom", filters.occurredFrom);
    }
    if (filters.occurredThrough) {
      parameters.set("occurredThrough", filters.occurredThrough);
    }

    return request<PortalPaymentReportPage>(
      `/bff/platform/payments?${parameters.toString()}`,
    );
  },

  getPlatformPaymentReceipt: (paymentId: string) =>
    request<PortalPaymentReceipt>(
      `/bff/platform/payments/${encodeURIComponent(paymentId)}`,
    ),

  getPlatformFundingBalances: (organizationId: string) =>
    request<PortalCorporateCreditBalance[]>(
      `/bff/platform/organizations/${encodeURIComponent(organizationId)}/funding/balances`,
    ),

  getPlatformFundingHistory: (organizationId: string, cursor?: string) => {
    const parameters = new URLSearchParams({ limit: "20" });
    if (cursor) {
      parameters.set("cursor", cursor);
    }
    return request<PortalCorporateCreditHistoryPage>(
      `/bff/platform/organizations/${encodeURIComponent(organizationId)}/funding/allocations?${parameters.toString()}`,
    );
  },

  allocatePlatformFunding: (
    organizationId: string,
    amount: string,
    currency: string,
    businessReference: string,
    operationId: string,
  ) =>
    request<PortalCorporateCreditAllocation>(
      `/bff/platform/organizations/${encodeURIComponent(organizationId)}/funding/allocations`,
      {
        method: "POST",
        body: JSON.stringify({
          amount,
          currency,
          businessReference,
          operationId,
        }),
      },
    ),

  reversePlatformFunding: (
    allocationId: string,
    reason: string,
    operationId: string,
  ) =>
    request<PortalCorporateCreditReversal>(
      `/bff/platform/funding/allocations/${encodeURIComponent(allocationId)}/reversal`,
      {
        method: "POST",
        body: JSON.stringify({ reason, operationId }),
      },
    ),

  getSubsidiaries: ({ limit, offset }: { limit: number; offset: number }) => {
    const parameters = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
    });
    return request<PortalSubsidiaryPage>(
      `/bff/organization/subsidiaries?${parameters.toString()}`,
    );
  },

  createSubsidiary: (name: string, code: string) =>
    request<PortalSubsidiary>("/bff/organization/subsidiaries", {
      method: "POST",
      body: JSON.stringify({ name, code }),
    }),

  getOrganizationTeam: ({ limit, offset }: { limit: number; offset: number }) =>
    request<PortalTeamPage>(
      `/bff/organization/team?${new URLSearchParams({
        limit: String(limit),
        offset: String(offset),
      }).toString()}`,
    ),

  getPlatformTeam: (
    organizationId: string,
    { limit, offset }: { limit: number; offset: number },
  ) =>
    request<PortalTeamPage>(
      `/bff/platform/organizations/${encodeURIComponent(
        organizationId,
      )}/team?${new URLSearchParams({
        limit: String(limit),
        offset: String(offset),
      }).toString()}`,
    ),

  addOrganizationTeamMember: (email: string) =>
    request<PortalTeamMember>("/bff/organization/team", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  disableOrganizationTeamMember: (membershipId: string) =>
    request<PortalTeamMember>(
      `/bff/organization/team/${encodeURIComponent(membershipId)}/disable`,
      { method: "POST" },
    ),

  getOrganizationRoles: () => request<PortalRole[]>("/bff/organization/roles"),

  createOrganizationRole: (name: string) =>
    request<PortalRole>("/bff/organization/roles", {
      method: "POST",
      body: JSON.stringify({ name }),
    }),

  grantOrganizationRolePermissions: (roleId: string, permissions: string[]) =>
    request<PortalRole>(
      `/bff/organization/roles/${encodeURIComponent(roleId)}/permissions`,
      {
        method: "POST",
        body: JSON.stringify({ permissions }),
      },
    ),

  getOrganizationRoleAssignments: () =>
    request<PortalRoleAssignment[]>("/bff/organization/role-assignments"),

  assignOrganizationRole: (
    membershipId: string,
    roleId: string,
    scope: PortalRoleScope,
  ) =>
    request<PortalRoleAssignment>("/bff/organization/role-assignments", {
      method: "POST",
      body: JSON.stringify({ membershipId, roleId, scope }),
    }),

  getGiftCardInventory: (cursor?: string) => {
    const parameters = new URLSearchParams({ limit: "20" });
    if (cursor) {
      parameters.set("cursor", cursor);
    }

    return request<PortalGiftCardInventoryPage>(
      `/bff/gift-cards/inventory?${parameters.toString()}`,
    );
  },

  issueGiftCard: ({
    amount,
    currency,
    validFromUtc,
    expiresAtUtc,
    isTransferable,
    isDivisible,
    businessReference,
    operationId,
  }: {
    amount: string;
    currency: string;
    validFromUtc?: string;
    expiresAtUtc: string;
    isTransferable: boolean;
    isDivisible: boolean;
    businessReference: string;
    operationId: string;
  }) =>
    request<PortalGiftCard>("/bff/gift-cards", {
      method: "POST",
      body: JSON.stringify({
        amount,
        currency,
        validFromUtc,
        expiresAtUtc,
        isTransferable,
        isDivisible,
        businessReference,
        operationId,
      }),
    }),

  getGiftCardLifecycle: (giftCardId: string) =>
    request<PortalGiftCardLifecycleDetail>(
      `/bff/gift-cards/${encodeURIComponent(giftCardId)}/lifecycle`,
    ),

  runGiftCardLifecycle: ({
    giftCardId,
    action,
    reason,
    operationId,
  }: {
    giftCardId: string;
    action: PortalGiftCardLifecycleAction;
    reason: string;
    operationId: string;
  }) =>
    request<PortalGiftCardLifecycleEvent>(
      `/bff/gift-cards/${encodeURIComponent(giftCardId)}/lifecycle/${action}`,
      {
        method: "POST",
        body: JSON.stringify({ reason, operationId }),
      },
    ),

  distributeGiftCard: ({
    giftCardId,
    contactType,
    recipientContact,
    businessReference,
    operationId,
  }: {
    giftCardId: string;
    contactType: PortalRecipientContactType;
    recipientContact: string;
    businessReference: string;
    operationId: string;
  }) =>
    request<PortalGiftCardDistribution>(
      `/bff/gift-cards/${encodeURIComponent(giftCardId)}/distribution`,
      {
        method: "POST",
        body: JSON.stringify({
          contactType,
          recipientContact,
          businessReference,
          operationId,
        }),
      },
    ),

  createBulkGiftCardBatch: (intent: {
    batchReference: string;
    operationId: string;
    items: Array<{
      itemReference: string;
      amount: string;
      currency: string;
      validFromUtc?: string;
      expiresAtUtc: string;
      isTransferable: boolean;
      isDivisible: boolean;
      contactType: PortalRecipientContactType;
      recipientContact: string;
    }>;
  }) =>
    request<PortalBulkGiftCardBatch>("/bff/gift-card-batches", {
      method: "POST",
      body: JSON.stringify(intent),
    }),

  getBulkGiftCardBatch: (batchId: string, cursor?: string) => {
    const parameters = new URLSearchParams({ limit: "200" });
    if (cursor) {
      parameters.set("cursor", cursor);
    }
    return request<PortalBulkGiftCardBatch>(
      `/bff/gift-card-batches/${encodeURIComponent(batchId)}?${parameters}`,
    );
  },

  retryBulkGiftCardBatch: (batchId: string) =>
    request<PortalBulkGiftCardBatch>(
      `/bff/gift-card-batches/${encodeURIComponent(batchId)}/retry`,
      { method: "POST" },
    ),

  selectOrganization: (organizationId: string) =>
    request<PortalSession>("/bff/organization-context", {
      method: "POST",
      body: JSON.stringify({ organizationId }),
    }),

  clearOrganization: () =>
    request<PortalSession>("/bff/organization-context", {
      method: "DELETE",
    }),

  getFinancialSummary: () =>
    request<PortalFinancialSummary>("/bff/finance/summary"),

  getFinancialHistory: (
    filters: PortalFinancialHistoryFilters,
    cursor?: string,
  ) => {
    const parameters = new URLSearchParams({ limit: "10" });
    if (cursor) {
      parameters.set("cursor", cursor);
    }
    if (filters.category) {
      parameters.set("category", filters.category);
    }
    if (filters.operation.trim()) {
      parameters.set("operation", filters.operation.trim());
    }
    if (filters.currency.trim()) {
      parameters.set("currency", filters.currency.trim().toUpperCase());
    }
    if (filters.reference.trim()) {
      parameters.set("reference", filters.reference.trim());
    }
    if (filters.occurredFrom) {
      parameters.set("occurredFrom", filters.occurredFrom);
    }
    if (filters.occurredThrough) {
      parameters.set("occurredThrough", filters.occurredThrough);
    }

    return request<PortalFinancialHistoryPage>(
      `/bff/finance/history?${parameters.toString()}`,
    );
  },

  getFinancialReconciliation: () =>
    request<PortalFinancialReconciliation>("/bff/finance/reconciliation"),

  getCardRegister: (filters: PortalCardRegisterFilters, cursor?: string) => {
    const parameters = new URLSearchParams({ limit: "25" });
    if (cursor) {
      parameters.set("cursor", cursor);
    }
    if (filters.lifecycleState) {
      parameters.set("lifecycleState", filters.lifecycleState);
    }
    if (filters.ownershipState) {
      parameters.set("ownershipState", filters.ownershipState);
    }
    if (filters.currency.trim()) {
      parameters.set("currency", filters.currency.trim().toUpperCase());
    }
    if (filters.reference.trim()) {
      parameters.set("reference", filters.reference.trim());
    }

    return request<PortalCardRegisterPage>(
      `/bff/gift-cards/register?${parameters.toString()}`,
    );
  },

  getOrganizationAudit: (filters: PortalAuditFilters, cursor?: string) =>
    request<PortalAuditPage>(
      `/bff/organization/audit-records?${auditQuery(filters, cursor).toString()}`,
    ),

  getPlatformAudit: (
    organizationId: string,
    filters: PortalAuditFilters,
    cursor?: string,
  ) =>
    request<PortalAuditPage>(
      `/bff/platform/organizations/${encodeURIComponent(
        organizationId,
      )}/audit-records?${auditQuery(filters, cursor).toString()}`,
    ),
};
