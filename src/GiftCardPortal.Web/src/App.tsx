import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { HttpError, portalApi } from "./api";
import { BrandHeader } from "./components/BrandHeader";
import { LoadingPanel, StatusPanel } from "./components/StatusPanel";
import { useTranslation } from "./i18n/translate";
import { LoginScreen } from "./features/auth/LoginScreen";
import { OrganizationChooser } from "./features/organizations/OrganizationChooser";
import {
  PlatformWorkspace,
  type PlatformDirectoryFilters,
  type PlatformView,
} from "./features/platform/PlatformWorkspace";
import { ApplicationShell } from "./features/shell/ApplicationShell";
import type {
  PortalAuditFilters,
  PortalCardRegisterFilters,
  PortalFinancialHistoryFilters,
  PortalGiftCard,
  PortalPaymentFilters,
} from "./types";

const sessionKey = ["portal-session"] as const;
const organizationsKey = ["portal-organizations"] as const;
const platformOrganizationsKey = ["platform-organizations"] as const;
const platformOrganizationDetailKey = ["platform-organization-detail"] as const;
const platformFundingBalancesKey = ["platform-funding-balances"] as const;
const platformFundingHistoryKey = ["platform-funding-history"] as const;
const platformAuditKey = ["platform-audit"] as const;
const platformTeamKey = ["platform-team"] as const;
const platformPaymentsKey = ["platform-payments"] as const;
const platformPaymentReceiptKey = ["platform-payment-receipt"] as const;
const platformDirectoryPermission = "platform.organizations.view";
const platformTeamViewPermission = "platform.organizations.memberships.view";
const platformFundingViewPermission = "platform.corporate_credits.view";
const platformFundingAllocatePermission = "platform.corporate_credits.allocate";
const platformFundingReversePermission = "platform.corporate_credits.reverse";
const platformPaymentsViewPermission = "platform.payments.view";
const platformPageSize = 20;
const subsidiariesKey = ["organization-subsidiaries"] as const;
const organizationTeamKey = ["organization-team"] as const;
const organizationRolesKey = ["organization-roles"] as const;
const organizationRoleAssignmentsKey = [
  "organization-role-assignments",
] as const;
const teamPageSize = 25;
const subsidiaryPageSize = 20;
const giftCardInventoryKey = ["gift-card-inventory"] as const;
const giftCardLifecycleKey = ["gift-card-lifecycle"] as const;
const giftCardBatchKey = ["gift-card-batch"] as const;
const organizationViewPermission = "organization.view";
const organizationCreateSubsidiaryPermission = "organization.create_subsidiary";
const giftCardViewPermission = "organization.gift_cards.view";
const giftCardIssuePermission = "organization.gift_cards.issue";
const giftCardDistributePermission = "organization.gift_cards.distribute";
const giftCardLifecyclePermission = "organization.gift_cards.lifecycle.manage";
const financeSummaryKey = ["finance-summary"] as const;
const financeHistoryKey = ["finance-history"] as const;
const financeReconciliationKey = ["finance-reconciliation"] as const;
const cardRegisterKey = ["card-register"] as const;
const emptyCardRegisterFilters: PortalCardRegisterFilters = {
  lifecycleState: "",
  ownershipState: "",
  currency: "",
  reference: "",
};
const organizationAuditKey = ["organization-audit"] as const;
const emptyAuditFilters: PortalAuditFilters = {
  operation: "",
  outcome: "",
  correlationId: "",
};
const emptyFinancialHistoryFilters: PortalFinancialHistoryFilters = {
  category: "",
  operation: "",
  currency: "",
  reference: "",
  occurredFrom: "",
  occurredThrough: "",
};
const emptyPaymentFilters: PortalPaymentFilters = {
  storeReference: "",
  state: "",
  currency: "",
  reference: "",
  occurredFrom: "",
  occurredThrough: "",
};
const financePermissions = [
  "organization.corporate_credits.view",
  "organization.gift_cards.view",
] as const;

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof HttpError && error.message) {
    return error.message;
  }

  return fallback;
}

export function App() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const [selectedPlatformOrganizationId, setSelectedPlatformOrganizationId] =
    useState<string>();
  const platformView: PlatformView = location.pathname.startsWith(
    "/platform/payments",
  )
    ? "payments"
    : "customers";
  const [platformPaymentFilters, setPlatformPaymentFilters] =
    useState(emptyPaymentFilters);
  const [selectedPaymentId, setSelectedPaymentId] = useState<string>();
  const [subsidiaryOffset, setSubsidiaryOffset] = useState(0);
  const [teamOffset, setTeamOffset] = useState(0);
  const [platformTeamOffset, setPlatformTeamOffset] = useState(0);
  const [selectedGiftCardId, setSelectedGiftCardId] = useState<string>();
  const [distributionCard, setDistributionCard] = useState<PortalGiftCard>();
  const [currentBatchId, setCurrentBatchId] = useState<string>();
  const [financialHistoryFilters, setFinancialHistoryFilters] = useState(
    emptyFinancialHistoryFilters,
  );
  const [cardRegisterFilters, setCardRegisterFilters] = useState(
    emptyCardRegisterFilters,
  );
  const [organizationAuditFilters, setOrganizationAuditFilters] =
    useState(emptyAuditFilters);
  const [platformAuditFilters, setPlatformAuditFilters] =
    useState(emptyAuditFilters);
  const [platformFilters, setPlatformFilters] = useState<
    PlatformDirectoryFilters & { offset: number }
  >({
    search: "",
    status: "",
    offset: 0,
  });
  const sessionQuery = useQuery({
    queryKey: sessionKey,
    queryFn: portalApi.getSession,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const session = sessionQuery.data;
  const isSignedIn = Boolean(session);
  const isPlatformContext = session?.user.contextType === "Platform";
  const hasPlatformDirectoryPermission = Boolean(
    session?.user.platformPermissions.includes(platformDirectoryPermission),
  );
  const hasPlatformFundingViewPermission = Boolean(
    session?.user.platformPermissions.includes(platformFundingViewPermission),
  );
  const hasPlatformFundingAllocatePermission = Boolean(
    session?.user.platformPermissions.includes(
      platformFundingAllocatePermission,
    ),
  );
  const hasPlatformFundingReversePermission = Boolean(
    session?.user.platformPermissions.includes(
      platformFundingReversePermission,
    ),
  );
  const hasPlatformAuditPermission = Boolean(
    session?.user.platformPermissions.includes("platform.audit.view"),
  );
  const hasPlatformTeamViewPermission = Boolean(
    session?.user.platformPermissions.includes(platformTeamViewPermission),
  );
  const hasPlatformPaymentsViewPermission = Boolean(
    session?.user.platformPermissions.includes(platformPaymentsViewPermission),
  );
  const needsOrganization =
    isSignedIn && !isPlatformContext && !session?.user.organizationContext;
  const hasFinancePermission = Boolean(
    session?.user.organizationContext &&
    financePermissions.every((permission) =>
      session.user.organizationContext?.effectivePermissions.includes(
        permission,
      ),
    ),
  );
  const hasOrganizationViewPermission = Boolean(
    session?.user.organizationContext?.effectivePermissions.includes(
      organizationViewPermission,
    ),
  );
  const hasOrganizationAuditPermission = Boolean(
    session?.user.organizationContext?.effectivePermissions.includes(
      "organization.audit.view",
    ),
  );
  const hasOrganizationCreatePermission = Boolean(
    session?.user.organizationContext?.effectivePermissions.includes(
      organizationCreateSubsidiaryPermission,
    ),
  );
  const hasGiftCardViewPermission = Boolean(
    session?.user.organizationContext?.effectivePermissions.includes(
      giftCardViewPermission,
    ),
  );
  const hasGiftCardIssuePermission = Boolean(
    session?.user.organizationContext?.effectivePermissions.includes(
      giftCardIssuePermission,
    ),
  );
  const hasGiftCardLifecyclePermission = Boolean(
    session?.user.organizationContext?.effectivePermissions.includes(
      giftCardLifecyclePermission,
    ),
  );
  const hasGiftCardDistributePermission = Boolean(
    session?.user.organizationContext?.effectivePermissions.includes(
      giftCardDistributePermission,
    ),
  );
  const organizationPermissions =
    session?.user.organizationContext?.effectivePermissions ?? [];
  const hasTeamViewPermission = organizationPermissions.includes(
    "organization.memberships.view",
  );
  const hasTeamAddPermission = organizationPermissions.includes(
    "organization.memberships.create",
  );
  const hasTeamDisablePermission = organizationPermissions.includes(
    "organization.memberships.disable",
  );
  const hasRoleViewPermission = organizationPermissions.includes("role.view");
  const hasRoleCreatePermission =
    organizationPermissions.includes("role.create");
  const hasRoleGrantPermission = organizationPermissions.includes(
    "role.manage_permissions",
  );
  const hasRoleAssignPermission =
    organizationPermissions.includes("role.assign");

  const organizationsQuery = useQuery({
    queryKey: organizationsKey,
    queryFn: portalApi.getOrganizations,
    enabled: needsOrganization,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const platformOrganizationsQuery = useQuery({
    queryKey: [...platformOrganizationsKey, platformFilters],
    queryFn: () =>
      portalApi.getPlatformOrganizations({
        ...platformFilters,
        limit: platformPageSize,
      }),
    enabled: isPlatformContext && hasPlatformDirectoryPermission,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const platformOrganizationDetailQuery = useQuery({
    queryKey: [
      ...platformOrganizationDetailKey,
      selectedPlatformOrganizationId,
    ],
    queryFn: () =>
      portalApi.getPlatformOrganization(selectedPlatformOrganizationId!),
    enabled:
      isPlatformContext &&
      hasPlatformDirectoryPermission &&
      Boolean(selectedPlatformOrganizationId),
    retry: false,
    refetchOnWindowFocus: false,
  });

  const platformFundingBalancesQuery = useQuery({
    queryKey: [...platformFundingBalancesKey, selectedPlatformOrganizationId],
    queryFn: () =>
      portalApi.getPlatformFundingBalances(selectedPlatformOrganizationId!),
    enabled:
      isPlatformContext &&
      hasPlatformFundingViewPermission &&
      Boolean(selectedPlatformOrganizationId),
    retry: false,
    refetchOnWindowFocus: false,
  });

  const platformFundingHistoryQuery = useInfiniteQuery({
    queryKey: [...platformFundingHistoryKey, selectedPlatformOrganizationId],
    queryFn: ({ pageParam }) =>
      portalApi.getPlatformFundingHistory(
        selectedPlatformOrganizationId!,
        pageParam,
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled:
      isPlatformContext &&
      hasPlatformFundingViewPermission &&
      Boolean(selectedPlatformOrganizationId),
    retry: false,
    refetchOnWindowFocus: false,
  });

  const platformAuditQuery = useInfiniteQuery({
    queryKey: [
      ...platformAuditKey,
      selectedPlatformOrganizationId,
      platformAuditFilters,
    ],
    queryFn: ({ pageParam }) =>
      portalApi.getPlatformAudit(
        selectedPlatformOrganizationId!,
        platformAuditFilters,
        pageParam,
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled:
      isPlatformContext &&
      hasPlatformAuditPermission &&
      Boolean(selectedPlatformOrganizationId),
    retry: false,
    refetchOnWindowFocus: false,
  });

  const platformTeamQuery = useQuery({
    queryKey: [
      ...platformTeamKey,
      selectedPlatformOrganizationId,
      platformTeamOffset,
    ],
    queryFn: () =>
      portalApi.getPlatformTeam(selectedPlatformOrganizationId!, {
        limit: teamPageSize,
        offset: platformTeamOffset,
      }),
    enabled:
      isPlatformContext &&
      hasPlatformTeamViewPermission &&
      Boolean(selectedPlatformOrganizationId),
    retry: false,
    refetchOnWindowFocus: false,
  });

  const platformPaymentsQuery = useInfiniteQuery({
    queryKey: [...platformPaymentsKey, platformPaymentFilters],
    queryFn: ({ pageParam }) =>
      portalApi.getPlatformPayments(platformPaymentFilters, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled:
      isPlatformContext &&
      hasPlatformPaymentsViewPermission &&
      platformView === "payments",
    retry: false,
    refetchOnWindowFocus: false,
  });

  const platformPaymentReceiptQuery = useQuery({
    queryKey: [...platformPaymentReceiptKey, selectedPaymentId],
    queryFn: () => portalApi.getPlatformPaymentReceipt(selectedPaymentId!),
    enabled:
      isPlatformContext &&
      hasPlatformPaymentsViewPermission &&
      platformView === "payments" &&
      Boolean(selectedPaymentId),
    retry: false,
    refetchOnWindowFocus: false,
  });

  const subsidiariesQuery = useQuery({
    queryKey: [
      ...subsidiariesKey,
      session?.user.organizationContext?.organization.id,
      subsidiaryOffset,
    ],
    queryFn: () =>
      portalApi.getSubsidiaries({
        limit: subsidiaryPageSize,
        offset: subsidiaryOffset,
      }),
    enabled: Boolean(
      session?.user.organizationContext && hasOrganizationViewPermission,
    ),
    retry: false,
    refetchOnWindowFocus: false,
  });

  const organizationTeamQuery = useQuery({
    queryKey: [
      ...organizationTeamKey,
      session?.user.organizationContext?.organization.id,
      teamOffset,
    ],
    queryFn: () =>
      portalApi.getOrganizationTeam({
        limit: teamPageSize,
        offset: teamOffset,
      }),
    enabled: Boolean(
      session?.user.organizationContext && hasTeamViewPermission,
    ),
    retry: false,
    refetchOnWindowFocus: false,
  });

  const organizationRolesQuery = useQuery({
    queryKey: [
      ...organizationRolesKey,
      session?.user.organizationContext?.organization.id,
    ],
    queryFn: portalApi.getOrganizationRoles,
    enabled: Boolean(
      session?.user.organizationContext && hasRoleViewPermission,
    ),
    retry: false,
    refetchOnWindowFocus: false,
  });

  const organizationRoleAssignmentsQuery = useQuery({
    queryKey: [
      ...organizationRoleAssignmentsKey,
      session?.user.organizationContext?.organization.id,
    ],
    queryFn: portalApi.getOrganizationRoleAssignments,
    enabled: Boolean(
      session?.user.organizationContext && hasRoleViewPermission,
    ),
    retry: false,
    refetchOnWindowFocus: false,
  });

  const giftCardInventoryQuery = useInfiniteQuery({
    queryKey: [
      ...giftCardInventoryKey,
      session?.user.organizationContext?.organization.id,
    ],
    queryFn: ({ pageParam }) => portalApi.getGiftCardInventory(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: Boolean(
      session?.user.organizationContext && hasGiftCardViewPermission,
    ),
    retry: false,
    refetchOnWindowFocus: false,
  });

  const giftCardLifecycleQuery = useQuery({
    queryKey: [...giftCardLifecycleKey, selectedGiftCardId],
    queryFn: () => portalApi.getGiftCardLifecycle(selectedGiftCardId!),
    enabled: Boolean(
      session?.user.organizationContext &&
      hasGiftCardViewPermission &&
      selectedGiftCardId,
    ),
    retry: false,
    refetchOnWindowFocus: false,
  });

  const giftCardBatchQuery = useInfiniteQuery({
    queryKey: [...giftCardBatchKey, currentBatchId],
    queryFn: ({ pageParam }) =>
      portalApi.getBulkGiftCardBatch(currentBatchId!, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: Boolean(
      session?.user.organizationContext &&
      hasGiftCardViewPermission &&
      currentBatchId,
    ),
    retry: false,
    refetchOnWindowFocus: false,
    refetchInterval: (query) => {
      const status = query.state.data?.pages[0]?.status;
      return status === "Pending" || status === "Processing" ? 2_000 : false;
    },
  });

  const financeSummaryQuery = useQuery({
    queryKey: financeSummaryKey,
    queryFn: portalApi.getFinancialSummary,
    enabled: hasFinancePermission,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const financeHistoryQuery = useInfiniteQuery({
    queryKey: [...financeHistoryKey, financialHistoryFilters],
    queryFn: ({ pageParam }) =>
      portalApi.getFinancialHistory(financialHistoryFilters, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: hasFinancePermission,
    retry: false,
    refetchOnWindowFocus: false,
  });

  // The register reads the same funded-card records the gift-card workspace is
  // permitted to see, so it rides on the same view permission rather than
  // inventing one the backend would not recognise.
  const cardRegisterQuery = useInfiniteQuery({
    queryKey: [...cardRegisterKey, cardRegisterFilters],
    queryFn: ({ pageParam }) =>
      portalApi.getCardRegister(cardRegisterFilters, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: hasGiftCardViewPermission,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const financeReconciliationQuery = useQuery({
    queryKey: financeReconciliationKey,
    queryFn: portalApi.getFinancialReconciliation,
    enabled: false,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const organizationAuditQuery = useInfiniteQuery({
    queryKey: [
      ...organizationAuditKey,
      session?.user.organizationContext?.organization.id,
      organizationAuditFilters,
    ],
    queryFn: ({ pageParam }) =>
      portalApi.getOrganizationAudit(organizationAuditFilters, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: Boolean(
      session?.user.organizationContext && hasOrganizationAuditPermission,
    ),
    retry: false,
    refetchOnWindowFocus: false,
  });

  const createSubsidiary = useMutation({
    mutationFn: ({ name, code }: { name: string; code: string }) =>
      portalApi.createSubsidiary(name, code),
    onSuccess: () => {
      setSubsidiaryOffset(0);
      void queryClient.invalidateQueries({ queryKey: subsidiariesKey });
      void queryClient.invalidateQueries({ queryKey: organizationAuditKey });
    },
  });

  const addTeamMember = useMutation({
    mutationFn: portalApi.addOrganizationTeamMember,
    onSuccess: () => {
      setTeamOffset(0);
      void queryClient.invalidateQueries({ queryKey: organizationTeamKey });
      void queryClient.invalidateQueries({ queryKey: organizationAuditKey });
    },
  });

  const disableTeamMember = useMutation({
    mutationFn: portalApi.disableOrganizationTeamMember,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: organizationTeamKey });
      void queryClient.invalidateQueries({ queryKey: organizationAuditKey });
    },
  });

  const createRole = useMutation({
    mutationFn: portalApi.createOrganizationRole,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: organizationRolesKey });
      void queryClient.invalidateQueries({ queryKey: organizationAuditKey });
    },
  });

  const grantRolePermissions = useMutation({
    mutationFn: ({
      roleId,
      permissions,
    }: {
      roleId: string;
      permissions: string[];
    }) => portalApi.grantOrganizationRolePermissions(roleId, permissions),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: organizationRolesKey });
      void queryClient.invalidateQueries({ queryKey: organizationAuditKey });
    },
  });

  const assignRole = useMutation({
    mutationFn: ({
      membershipId,
      roleId,
      scope,
    }: {
      membershipId: string;
      roleId: string;
      scope: "Organization" | "Subtree";
    }) => portalApi.assignOrganizationRole(membershipId, roleId, scope),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: organizationRoleAssignmentsKey,
      });
      void queryClient.invalidateQueries({ queryKey: organizationAuditKey });
    },
  });

  function resetTeamActions() {
    addTeamMember.reset();
    disableTeamMember.reset();
    createRole.reset();
    grantRolePermissions.reset();
    assignRole.reset();
  }

  const issueGiftCard = useMutation({
    mutationFn: portalApi.issueGiftCard,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: giftCardInventoryKey });
      void queryClient.invalidateQueries({ queryKey: financeSummaryKey });
      void queryClient.invalidateQueries({ queryKey: financeHistoryKey });
      void queryClient.invalidateQueries({ queryKey: cardRegisterKey });
      void queryClient.invalidateQueries({ queryKey: organizationAuditKey });
      queryClient.removeQueries({ queryKey: financeReconciliationKey });
    },
  });

  const runGiftCardLifecycle = useMutation({
    mutationFn: portalApi.runGiftCardLifecycle,
    onSuccess: (_, intent) => {
      void queryClient.invalidateQueries({ queryKey: giftCardLifecycleKey });
      void queryClient.invalidateQueries({ queryKey: giftCardInventoryKey });
      void queryClient.invalidateQueries({ queryKey: organizationAuditKey });
      if (intent.action === "cancel" || intent.action === "expire") {
        void queryClient.invalidateQueries({ queryKey: financeSummaryKey });
        void queryClient.invalidateQueries({ queryKey: financeHistoryKey });
        void queryClient.invalidateQueries({ queryKey: cardRegisterKey });
        queryClient.removeQueries({ queryKey: financeReconciliationKey });
      }
    },
  });

  const distributeGiftCard = useMutation({
    mutationFn: portalApi.distributeGiftCard,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: giftCardInventoryKey });
      void queryClient.invalidateQueries({ queryKey: giftCardLifecycleKey });
      void queryClient.invalidateQueries({ queryKey: organizationAuditKey });
    },
  });

  const createBulkGiftCardBatch = useMutation({
    mutationFn: portalApi.createBulkGiftCardBatch,
    onSuccess: (batch) => {
      setCurrentBatchId(batch.id);
    },
  });

  const retryBulkGiftCardBatch = useMutation({
    mutationFn: () => portalApi.retryBulkGiftCardBatch(currentBatchId!),
    onSuccess: (batch) => {
      setCurrentBatchId(batch.id);
    },
  });

  const giftCardBatchResult = giftCardBatchQuery.data
    ? {
        ...giftCardBatchQuery.data.pages[0],
        nextCursor: giftCardBatchQuery.data.pages.at(-1)?.nextCursor ?? null,
        items: giftCardBatchQuery.data.pages.flatMap((page) => page.items),
      }
    : createBulkGiftCardBatch.data;

  useEffect(() => {
    if (giftCardBatchResult?.status !== "Completed") {
      return;
    }

    void queryClient.invalidateQueries({ queryKey: giftCardInventoryKey });
    void queryClient.invalidateQueries({ queryKey: financeSummaryKey });
    void queryClient.invalidateQueries({ queryKey: financeHistoryKey });
    void queryClient.invalidateQueries({ queryKey: cardRegisterKey });
    void queryClient.invalidateQueries({ queryKey: organizationAuditKey });
    queryClient.removeQueries({ queryKey: financeReconciliationKey });
  }, [giftCardBatchResult?.id, giftCardBatchResult?.status, queryClient]);

  const allocatePlatformFunding = useMutation({
    mutationFn: ({
      amount,
      currency,
      businessReference,
      operationId,
    }: {
      amount: string;
      currency: string;
      businessReference: string;
      operationId: string;
    }) =>
      portalApi.allocatePlatformFunding(
        selectedPlatformOrganizationId!,
        amount,
        currency,
        businessReference,
        operationId,
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: platformFundingBalancesKey,
      });
      void queryClient.invalidateQueries({
        queryKey: platformFundingHistoryKey,
      });
      void queryClient.invalidateQueries({ queryKey: platformAuditKey });
    },
  });

  const reversePlatformFunding = useMutation({
    mutationFn: ({
      allocationId,
      reason,
      operationId,
    }: {
      allocationId: string;
      reason: string;
      operationId: string;
    }) => portalApi.reversePlatformFunding(allocationId, reason, operationId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: platformFundingBalancesKey,
      });
      void queryClient.invalidateQueries({
        queryKey: platformFundingHistoryKey,
      });
      void queryClient.invalidateQueries({ queryKey: platformAuditKey });
    },
  });

  const login = useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      portalApi.login(email, password),
    onSuccess: (nextSession) => {
      setSelectedPlatformOrganizationId(undefined);
      setSelectedGiftCardId(undefined);
      setDistributionCard(undefined);
      setCurrentBatchId(undefined);
      setFinancialHistoryFilters(emptyFinancialHistoryFilters);
      setOrganizationAuditFilters(emptyAuditFilters);
      setPlatformAuditFilters(emptyAuditFilters);
      setSubsidiaryOffset(0);
      setTeamOffset(0);
      setPlatformTeamOffset(0);
      createSubsidiary.reset();
      addTeamMember.reset();
      disableTeamMember.reset();
      createRole.reset();
      grantRolePermissions.reset();
      assignRole.reset();
      issueGiftCard.reset();
      runGiftCardLifecycle.reset();
      distributeGiftCard.reset();
      createBulkGiftCardBatch.reset();
      retryBulkGiftCardBatch.reset();
      queryClient.setQueryData(sessionKey, nextSession);
      void queryClient.invalidateQueries({ queryKey: organizationsKey });
      queryClient.removeQueries({ queryKey: platformOrganizationDetailKey });
      queryClient.removeQueries({ queryKey: platformFundingBalancesKey });
      queryClient.removeQueries({ queryKey: platformFundingHistoryKey });
      queryClient.removeQueries({ queryKey: platformAuditKey });
      queryClient.removeQueries({ queryKey: platformTeamKey });
      queryClient.removeQueries({ queryKey: subsidiariesKey });
      queryClient.removeQueries({ queryKey: organizationTeamKey });
      queryClient.removeQueries({ queryKey: organizationRolesKey });
      queryClient.removeQueries({ queryKey: organizationRoleAssignmentsKey });
      queryClient.removeQueries({ queryKey: giftCardInventoryKey });
      queryClient.removeQueries({ queryKey: giftCardLifecycleKey });
      queryClient.removeQueries({ queryKey: giftCardBatchKey });
      void queryClient.invalidateQueries({ queryKey: financeSummaryKey });
      void queryClient.invalidateQueries({ queryKey: financeHistoryKey });
      void queryClient.invalidateQueries({ queryKey: cardRegisterKey });
      queryClient.removeQueries({ queryKey: financeReconciliationKey });
      queryClient.removeQueries({ queryKey: organizationAuditKey });
    },
  });

  const logout = useMutation({
    mutationFn: portalApi.logout,
    onSuccess: () => {
      setSelectedPlatformOrganizationId(undefined);
      setSelectedGiftCardId(undefined);
      setDistributionCard(undefined);
      setCurrentBatchId(undefined);
      setFinancialHistoryFilters(emptyFinancialHistoryFilters);
      setOrganizationAuditFilters(emptyAuditFilters);
      setPlatformAuditFilters(emptyAuditFilters);
      setSubsidiaryOffset(0);
      setTeamOffset(0);
      setPlatformTeamOffset(0);
      createSubsidiary.reset();
      addTeamMember.reset();
      disableTeamMember.reset();
      createRole.reset();
      grantRolePermissions.reset();
      assignRole.reset();
      issueGiftCard.reset();
      runGiftCardLifecycle.reset();
      distributeGiftCard.reset();
      createBulkGiftCardBatch.reset();
      retryBulkGiftCardBatch.reset();
      queryClient.removeQueries({ queryKey: organizationsKey });
      queryClient.removeQueries({ queryKey: platformOrganizationsKey });
      queryClient.removeQueries({ queryKey: platformOrganizationDetailKey });
      queryClient.removeQueries({ queryKey: platformFundingBalancesKey });
      queryClient.removeQueries({ queryKey: platformFundingHistoryKey });
      queryClient.removeQueries({ queryKey: platformAuditKey });
      queryClient.removeQueries({ queryKey: platformTeamKey });
      queryClient.removeQueries({ queryKey: subsidiariesKey });
      queryClient.removeQueries({ queryKey: organizationTeamKey });
      queryClient.removeQueries({ queryKey: organizationRolesKey });
      queryClient.removeQueries({ queryKey: organizationRoleAssignmentsKey });
      queryClient.removeQueries({ queryKey: giftCardInventoryKey });
      queryClient.removeQueries({ queryKey: giftCardLifecycleKey });
      queryClient.removeQueries({ queryKey: giftCardBatchKey });
      queryClient.removeQueries({ queryKey: financeSummaryKey });
      queryClient.removeQueries({ queryKey: financeHistoryKey });
      queryClient.removeQueries({ queryKey: cardRegisterKey });
      queryClient.removeQueries({ queryKey: financeReconciliationKey });
      queryClient.removeQueries({ queryKey: organizationAuditKey });
      void queryClient.invalidateQueries({ queryKey: sessionKey });
    },
  });

  const selectOrganization = useMutation({
    mutationFn: portalApi.selectOrganization,
    onSuccess: (nextSession) => {
      setSelectedGiftCardId(undefined);
      setDistributionCard(undefined);
      setCurrentBatchId(undefined);
      setFinancialHistoryFilters(emptyFinancialHistoryFilters);
      setOrganizationAuditFilters(emptyAuditFilters);
      setSubsidiaryOffset(0);
      setTeamOffset(0);
      createSubsidiary.reset();
      addTeamMember.reset();
      disableTeamMember.reset();
      createRole.reset();
      grantRolePermissions.reset();
      assignRole.reset();
      issueGiftCard.reset();
      runGiftCardLifecycle.reset();
      distributeGiftCard.reset();
      createBulkGiftCardBatch.reset();
      retryBulkGiftCardBatch.reset();
      queryClient.setQueryData(sessionKey, nextSession);
      queryClient.removeQueries({ queryKey: subsidiariesKey });
      queryClient.removeQueries({ queryKey: organizationTeamKey });
      queryClient.removeQueries({ queryKey: organizationRolesKey });
      queryClient.removeQueries({ queryKey: organizationRoleAssignmentsKey });
      queryClient.removeQueries({ queryKey: giftCardInventoryKey });
      queryClient.removeQueries({ queryKey: giftCardLifecycleKey });
      queryClient.removeQueries({ queryKey: giftCardBatchKey });
      void queryClient.invalidateQueries({ queryKey: financeSummaryKey });
      void queryClient.invalidateQueries({ queryKey: financeHistoryKey });
      void queryClient.invalidateQueries({ queryKey: cardRegisterKey });
      queryClient.removeQueries({ queryKey: financeReconciliationKey });
      queryClient.removeQueries({ queryKey: organizationAuditKey });
    },
  });

  const clearOrganization = useMutation({
    mutationFn: portalApi.clearOrganization,
    onSuccess: (nextSession) => {
      setSelectedGiftCardId(undefined);
      setDistributionCard(undefined);
      setCurrentBatchId(undefined);
      setFinancialHistoryFilters(emptyFinancialHistoryFilters);
      setOrganizationAuditFilters(emptyAuditFilters);
      setSubsidiaryOffset(0);
      setTeamOffset(0);
      createSubsidiary.reset();
      addTeamMember.reset();
      disableTeamMember.reset();
      createRole.reset();
      grantRolePermissions.reset();
      assignRole.reset();
      issueGiftCard.reset();
      runGiftCardLifecycle.reset();
      distributeGiftCard.reset();
      createBulkGiftCardBatch.reset();
      retryBulkGiftCardBatch.reset();
      queryClient.setQueryData(sessionKey, nextSession);
      void queryClient.invalidateQueries({ queryKey: organizationsKey });
      queryClient.removeQueries({ queryKey: financeSummaryKey });
      queryClient.removeQueries({ queryKey: financeHistoryKey });
      queryClient.removeQueries({ queryKey: cardRegisterKey });
      queryClient.removeQueries({ queryKey: financeReconciliationKey });
      queryClient.removeQueries({ queryKey: organizationAuditKey });
      queryClient.removeQueries({ queryKey: subsidiariesKey });
      queryClient.removeQueries({ queryKey: organizationTeamKey });
      queryClient.removeQueries({ queryKey: organizationRolesKey });
      queryClient.removeQueries({ queryKey: organizationRoleAssignmentsKey });
      queryClient.removeQueries({ queryKey: giftCardInventoryKey });
      queryClient.removeQueries({ queryKey: giftCardLifecycleKey });
      queryClient.removeQueries({ queryKey: giftCardBatchKey });
    },
  });

  let content: React.ReactNode;
  if (sessionQuery.isPending) {
    content = (
      <main id="main-content" className="page-width centered-page">
        <LoadingPanel label={t("Loading your secure session…")} />
      </main>
    );
  } else if (
    sessionQuery.error instanceof HttpError &&
    sessionQuery.error.status === 401
  ) {
    content = (
      <LoginScreen
        isPending={login.isPending}
        errorMessage={
          login.error
            ? errorMessage(
                login.error,
                t(
                  "We could not sign you in. Check your details and try again.",
                ),
              )
            : undefined
        }
        onLogin={(email, password) => {
          login.reset();
          login.mutate({ email, password });
        }}
      />
    );
  } else if (sessionQuery.isError || !session) {
    content = (
      <main id="main-content" className="page-width centered-page">
        <StatusPanel
          title={t("The portal is temporarily unavailable")}
          actionLabel={t("Try again")}
          onAction={() => {
            void sessionQuery.refetch();
          }}
        >
          {t(
            "We could not load your secure session. No sign-in information was exposed.",
          )}
        </StatusPanel>
      </main>
    );
  } else if (isPlatformContext) {
    const directorySessionExpired = [
      platformOrganizationsQuery.error,
      platformOrganizationDetailQuery.error,
      platformFundingBalancesQuery.error,
      platformFundingHistoryQuery.error,
      platformAuditQuery.error,
      platformTeamQuery.error,
      platformPaymentsQuery.error,
      platformPaymentReceiptQuery.error,
      allocatePlatformFunding.error,
      reversePlatformFunding.error,
    ].some((error) => error instanceof HttpError && error.status === 401);
    if (directorySessionExpired) {
      content = (
        <LoginScreen
          isPending={login.isPending}
          errorMessage={t(
            "Your secure session expired. Sign in again to continue.",
          )}
          onLogin={(email, password) => {
            login.reset();
            login.mutate({ email, password });
          }}
        />
      );
    } else {
      const paymentPages = platformPaymentsQuery.data?.pages;
      const paymentReport = paymentPages?.[0]
        ? {
            ...paymentPages[0],
            items: paymentPages.flatMap((page) => page.items),
            nextCursor: paymentPages.at(-1)?.nextCursor ?? null,
          }
        : undefined;
      content = (
        <PlatformWorkspace
          user={session.user}
          page={platformOrganizationsQuery.data}
          filters={platformFilters}
          selectedOrganizationId={selectedPlatformOrganizationId}
          selectedOrganization={platformOrganizationDetailQuery.data}
          hasDirectoryPermission={hasPlatformDirectoryPermission}
          isLoading={platformOrganizationsQuery.isPending}
          isDetailLoading={platformOrganizationDetailQuery.isPending}
          isLoggingOut={logout.isPending}
          errorMessage={
            platformOrganizationsQuery.error
              ? errorMessage(
                  platformOrganizationsQuery.error,
                  t(
                    "The platform customer directory is temporarily unavailable.",
                  ),
                )
              : undefined
          }
          detailErrorMessage={
            platformOrganizationDetailQuery.error
              ? errorMessage(
                  platformOrganizationDetailQuery.error,
                  t("The customer detail is temporarily unavailable."),
                )
              : undefined
          }
          funding={{
            customerName:
              platformOrganizationDetailQuery.data?.name ?? "selected customer",
            balances: platformFundingBalancesQuery.data,
            allocations:
              platformFundingHistoryQuery.data?.pages.flatMap(
                (page) => page.items,
              ) ?? [],
            allocated: allocatePlatformFunding.data,
            reversed: reversePlatformFunding.data,
            hasViewPermission: hasPlatformFundingViewPermission,
            hasAllocatePermission: hasPlatformFundingAllocatePermission,
            hasReversePermission: hasPlatformFundingReversePermission,
            hasMoreHistory: Boolean(platformFundingHistoryQuery.hasNextPage),
            isLoadingBalances: platformFundingBalancesQuery.isPending,
            isLoadingHistory: platformFundingHistoryQuery.isPending,
            isLoadingMore: platformFundingHistoryQuery.isFetchingNextPage,
            isAllocating: allocatePlatformFunding.isPending,
            isReversing: reversePlatformFunding.isPending,
            balancesError: platformFundingBalancesQuery.error
              ? errorMessage(
                  platformFundingBalancesQuery.error,
                  t("Corporate-credit balances are temporarily unavailable."),
                )
              : undefined,
            historyError: platformFundingHistoryQuery.error
              ? errorMessage(
                  platformFundingHistoryQuery.error,
                  t("Allocation history is temporarily unavailable."),
                )
              : undefined,
            allocationError: allocatePlatformFunding.error
              ? errorMessage(
                  allocatePlatformFunding.error,
                  t("Corporate credit could not be allocated."),
                )
              : undefined,
            reversalError: reversePlatformFunding.error
              ? errorMessage(
                  reversePlatformFunding.error,
                  t("The allocation could not be reversed."),
                )
              : undefined,
            onRetryBalances: () => {
              void platformFundingBalancesQuery.refetch();
            },
            onRetryHistory: () => {
              void platformFundingHistoryQuery.refetch();
            },
            onLoadMore: () => {
              void platformFundingHistoryQuery.fetchNextPage();
            },
            onAllocate: (intent) => {
              allocatePlatformFunding.reset();
              allocatePlatformFunding.mutate(intent);
            },
            onReverse: (intent) => {
              reversePlatformFunding.reset();
              reversePlatformFunding.mutate({
                allocationId: intent.allocation.id,
                reason: intent.reason,
                operationId: intent.operationId,
              });
            },
          }}
          audit={{
            scopeName:
              platformOrganizationDetailQuery.data?.name ?? "selected customer",
            records:
              platformAuditQuery.data?.pages.flatMap((page) => page.items) ??
              [],
            appliedFilters: platformAuditFilters,
            hasPermission: hasPlatformAuditPermission,
            hasMore: Boolean(platformAuditQuery.hasNextPage),
            isLoading: platformAuditQuery.isPending,
            isLoadingMore: platformAuditQuery.isFetchingNextPage,
            errorMessage:
              platformAuditQuery.error && !platformAuditQuery.data
                ? errorMessage(
                    platformAuditQuery.error,
                    t("Customer audit evidence is temporarily unavailable."),
                  )
                : undefined,
            loadMoreError:
              platformAuditQuery.isFetchNextPageError &&
              platformAuditQuery.error
                ? errorMessage(
                    platformAuditQuery.error,
                    t(
                      "More audit evidence could not be loaded. Current results are unchanged.",
                    ),
                  )
                : undefined,
            onApplyFilters: setPlatformAuditFilters,
            onRetry: () => {
              void platformAuditQuery.refetch();
            },
            onLoadMore: () => {
              void platformAuditQuery.fetchNextPage();
            },
          }}
          team={{
            organizationName:
              platformOrganizationDetailQuery.data?.name ?? "selected customer",
            page: platformTeamQuery.data,
            permissions: {
              viewMembers: hasPlatformTeamViewPermission,
              addMembers: false,
              disableMembers: false,
              viewRoles: false,
              createRoles: false,
              grantPermissions: false,
              assignRoles: false,
            },
            readOnly: true,
            isLoading: platformTeamQuery.isPending,
            errorMessage: platformTeamQuery.error
              ? errorMessage(
                  platformTeamQuery.error,
                  t("The customer team roster is temporarily unavailable."),
                )
              : undefined,
            onPreviousPage: () => {
              setPlatformTeamOffset((current) =>
                Math.max(0, current - teamPageSize),
              );
            },
            onNextPage: () => {
              setPlatformTeamOffset((current) => current + teamPageSize);
            },
            onRetry: () => {
              void platformTeamQuery.refetch();
            },
          }}
          activeView={platformView}
          payments={{
            report: paymentReport,
            receipt: platformPaymentReceiptQuery.data,
            appliedFilters: platformPaymentFilters,
            hasPermission: hasPlatformPaymentsViewPermission,
            hasMore: Boolean(platformPaymentsQuery.hasNextPage),
            isLoading: platformPaymentsQuery.isPending,
            isLoadingMore: platformPaymentsQuery.isFetchingNextPage,
            isReceiptLoading: platformPaymentReceiptQuery.isPending,
            reportError:
              platformPaymentsQuery.error && !platformPaymentsQuery.data
                ? errorMessage(
                    platformPaymentsQuery.error,
                    t("POS payment reporting is temporarily unavailable."),
                  )
                : undefined,
            loadMoreError:
              platformPaymentsQuery.isFetchNextPageError &&
              platformPaymentsQuery.error
                ? errorMessage(
                    platformPaymentsQuery.error,
                    t(
                      "More payments could not be loaded. Current results are unchanged.",
                    ),
                  )
                : undefined,
            receiptError: platformPaymentReceiptQuery.error
              ? errorMessage(
                  platformPaymentReceiptQuery.error,
                  t("The payment receipt is temporarily unavailable."),
                )
              : undefined,
            selectedPaymentId,
            onApplyFilters: (filters) => {
              setSelectedPaymentId(undefined);
              setPlatformPaymentFilters(filters);
            },
            onRetry: () => {
              void platformPaymentsQuery.refetch();
            },
            onLoadMore: () => {
              void platformPaymentsQuery.fetchNextPage();
            },
            onOpenReceipt: setSelectedPaymentId,
            onCloseReceipt: () => setSelectedPaymentId(undefined),
            onRetryReceipt: () => {
              void platformPaymentReceiptQuery.refetch();
            },
          }}
          onApplyFilters={(filters) => {
            setPlatformFilters({ ...filters, offset: 0 });
          }}
          onPreviousPage={() => {
            setPlatformFilters((current) => ({
              ...current,
              offset: Math.max(0, current.offset - platformPageSize),
            }));
          }}
          onNextPage={() => {
            setPlatformFilters((current) => ({
              ...current,
              offset: current.offset + platformPageSize,
            }));
          }}
          onRetry={() => {
            void platformOrganizationsQuery.refetch();
          }}
          onOpenOrganization={(organizationId) => {
            allocatePlatformFunding.reset();
            reversePlatformFunding.reset();
            setPlatformAuditFilters(emptyAuditFilters);
            setPlatformTeamOffset(0);
            setSelectedPlatformOrganizationId(organizationId);
          }}
          onCloseOrganization={() => {
            allocatePlatformFunding.reset();
            reversePlatformFunding.reset();
            setPlatformAuditFilters(emptyAuditFilters);
            setPlatformTeamOffset(0);
            setSelectedPlatformOrganizationId(undefined);
            queryClient.removeQueries({ queryKey: platformFundingBalancesKey });
            queryClient.removeQueries({ queryKey: platformFundingHistoryKey });
            queryClient.removeQueries({ queryKey: platformAuditKey });
            queryClient.removeQueries({ queryKey: platformTeamKey });
          }}
          onRetryOrganization={() => {
            void platformOrganizationDetailQuery.refetch();
          }}
          onShowCustomers={() => {
            void navigate("/platform/customers");
            setSelectedPaymentId(undefined);
          }}
          onShowPayments={() => {
            void navigate("/platform/payments");
            setSelectedPlatformOrganizationId(undefined);
            setSelectedPaymentId(undefined);
          }}
          onLogout={() => {
            logout.reset();
            logout.mutate();
          }}
        />
      );
    }
  } else if (!session.user.organizationContext) {
    if (organizationsQuery.isPending) {
      content = (
        <main id="main-content" className="page-width centered-page">
          <LoadingPanel label={t("Loading your organizations…")} />
        </main>
      );
    } else if (organizationsQuery.isError) {
      content = (
        <main id="main-content" className="page-width centered-page">
          <StatusPanel
            title={t("Organizations could not be loaded")}
            actionLabel={t("Try again")}
            onAction={() => {
              void organizationsQuery.refetch();
            }}
          >
            {errorMessage(
              organizationsQuery.error,
              t("The platform did not return your organization list."),
            )}
          </StatusPanel>
        </main>
      );
    } else if (!organizationsQuery.data?.items.length) {
      content = (
        <main id="main-content" className="page-width centered-page">
          <StatusPanel
            title={t("No organizations are available")}
            actionLabel={t("Sign out")}
            onAction={() => {
              logout.mutate();
            }}
          >
            {t(
              "Your account is active, but the platform did not return an organization membership. Contact your administrator if this is unexpected.",
            )}
          </StatusPanel>
        </main>
      );
    } else {
      content = (
        <OrganizationChooser
          user={session.user}
          organizations={organizationsQuery.data.items}
          contextWasCleared={session.contextWasCleared}
          isPending={selectOrganization.isPending}
          errorMessage={
            selectOrganization.error
              ? errorMessage(
                  selectOrganization.error,
                  t("That organization could not be verified."),
                )
              : undefined
          }
          onSelect={(organizationId) => {
            selectOrganization.reset();
            selectOrganization.mutate(organizationId);
          }}
          onLogout={() => {
            logout.mutate();
          }}
        />
      );
    }
  } else {
    const financeSessionExpired = [
      financeSummaryQuery.error,
      financeHistoryQuery.error,
      financeReconciliationQuery.error,
      organizationAuditQuery.error,
      subsidiariesQuery.error,
      createSubsidiary.error,
      giftCardInventoryQuery.error,
      issueGiftCard.error,
      giftCardLifecycleQuery.error,
      runGiftCardLifecycle.error,
      distributeGiftCard.error,
      createBulkGiftCardBatch.error,
      giftCardBatchQuery.error,
      retryBulkGiftCardBatch.error,
      organizationTeamQuery.error,
      organizationRolesQuery.error,
      organizationRoleAssignmentsQuery.error,
      addTeamMember.error,
      disableTeamMember.error,
      createRole.error,
      grantRolePermissions.error,
      assignRole.error,
    ].some((error) => error instanceof HttpError && error.status === 401);
    if (financeSessionExpired) {
      content = (
        <LoginScreen
          isPending={login.isPending}
          errorMessage={t(
            "Your secure session expired. Sign in again to continue.",
          )}
          onLogin={(email, password) => {
            login.reset();
            login.mutate({ email, password });
          }}
        />
      );
    } else {
      const history =
        financeHistoryQuery.data?.pages.flatMap((page) => page.items) ?? [];
      const giftCards =
        giftCardInventoryQuery.data?.pages.flatMap((page) => page.items) ?? [];
      const selectedGiftCard =
        giftCards.find((card) => card.id === selectedGiftCardId) ??
        giftCardLifecycleQuery.data?.giftCard;
      content = (
        <ApplicationShell
          user={session.user}
          isChangingOrganization={clearOrganization.isPending}
          isLoggingOut={logout.isPending}
          errorMessage={
            clearOrganization.error
              ? errorMessage(
                  clearOrganization.error,
                  t("The organization context could not be cleared."),
                )
              : logout.error
                ? errorMessage(
                    logout.error,
                    t("Sign out could not be completed."),
                  )
                : undefined
          }
          finance={{
            summary: financeSummaryQuery.data,
            history,
            appliedHistoryFilters: financialHistoryFilters,
            hasFinancePermission,
            hasMoreHistory: Boolean(financeHistoryQuery.hasNextPage),
            isSummaryLoading: financeSummaryQuery.isPending,
            isHistoryLoading: financeHistoryQuery.isPending,
            isLoadingMore: financeHistoryQuery.isFetchingNextPage,
            summaryError: financeSummaryQuery.error
              ? errorMessage(
                  financeSummaryQuery.error,
                  t("Financial totals are temporarily unavailable."),
                )
              : undefined,
            historyError:
              financeHistoryQuery.error && !financeHistoryQuery.data
                ? errorMessage(
                    financeHistoryQuery.error,
                    t("Recent financial activity is temporarily unavailable."),
                  )
                : undefined,
            loadMoreError:
              financeHistoryQuery.isFetchNextPageError &&
              financeHistoryQuery.error
                ? errorMessage(
                    financeHistoryQuery.error,
                    t(
                      "More activity could not be loaded. Your current results are unchanged.",
                    ),
                  )
                : undefined,
            onRetrySummary: () => {
              void financeSummaryQuery.refetch();
            },
            onRetryHistory: () => {
              void financeHistoryQuery.refetch();
            },
            onLoadMore: () => {
              void financeHistoryQuery.fetchNextPage();
            },
            onApplyHistoryFilters: (filters) => {
              setFinancialHistoryFilters(filters);
            },
          }}
          reconciliation={{
            result: financeReconciliationQuery.data,
            hasFinancePermission,
            isRunning: financeReconciliationQuery.isFetching,
            errorMessage: financeReconciliationQuery.error
              ? errorMessage(
                  financeReconciliationQuery.error,
                  t("Reconciliation is temporarily unavailable."),
                )
              : undefined,
            onRun: () => {
              void financeReconciliationQuery.refetch();
            },
          }}
          cardRegister={{
            register: cardRegisterQuery.data
              ? {
                  ...cardRegisterQuery.data.pages[
                    cardRegisterQuery.data.pages.length - 1
                  ],
                  items: cardRegisterQuery.data.pages.flatMap(
                    (page) => page.items,
                  ),
                }
              : undefined,
            appliedFilters: cardRegisterFilters,
            hasMore: Boolean(cardRegisterQuery.hasNextPage),
            isLoading: cardRegisterQuery.isPending,
            isLoadingMore: cardRegisterQuery.isFetchingNextPage,
            registerError:
              cardRegisterQuery.error && !cardRegisterQuery.data
                ? errorMessage(
                    cardRegisterQuery.error,
                    t("The card register is temporarily unavailable."),
                  )
                : undefined,
            loadMoreError:
              cardRegisterQuery.isFetchNextPageError && cardRegisterQuery.error
                ? errorMessage(
                    cardRegisterQuery.error,
                    t("More cards could not be loaded."),
                  )
                : undefined,
            onApplyFilters: (filters) => {
              setCardRegisterFilters(filters);
            },
            onRetry: () => {
              void cardRegisterQuery.refetch();
            },
            onLoadMore: () => {
              void cardRegisterQuery.fetchNextPage();
            },
          }}
          cards={{
            organizationName:
              session.user.organizationContext.organization.name,
            cards: giftCards,
            issuedCard: issueGiftCard.data,
            hasViewPermission: hasGiftCardViewPermission,
            hasIssuePermission: hasGiftCardIssuePermission,
            hasDistributePermission: hasGiftCardDistributePermission,
            hasMore: Boolean(giftCardInventoryQuery.hasNextPage),
            isLoading: giftCardInventoryQuery.isPending,
            isLoadingMore: giftCardInventoryQuery.isFetchingNextPage,
            isIssuing: issueGiftCard.isPending,
            inventoryError:
              giftCardInventoryQuery.error && !giftCardInventoryQuery.data
                ? errorMessage(
                    giftCardInventoryQuery.error,
                    t("Gift card inventory is temporarily unavailable."),
                  )
                : undefined,
            loadMoreError:
              giftCardInventoryQuery.isFetchNextPageError &&
              giftCardInventoryQuery.error
                ? errorMessage(
                    giftCardInventoryQuery.error,
                    t(
                      "More cards could not be loaded. Your current inventory is unchanged.",
                    ),
                  )
                : undefined,
            issuanceError: issueGiftCard.error
              ? errorMessage(
                  issueGiftCard.error,
                  t("The gift card could not be issued."),
                )
              : undefined,
            lifecycle:
              selectedGiftCardId && selectedGiftCard
                ? {
                    organizationName:
                      session.user.organizationContext.organization.name,
                    selectedCard: selectedGiftCard,
                    detail: giftCardLifecycleQuery.data,
                    completedEvent: runGiftCardLifecycle.data,
                    hasManagePermission: hasGiftCardLifecyclePermission,
                    isLoading: giftCardLifecycleQuery.isPending,
                    isRunning: runGiftCardLifecycle.isPending,
                    errorMessage: giftCardLifecycleQuery.error
                      ? errorMessage(
                          giftCardLifecycleQuery.error,
                          t("Gift card detail is temporarily unavailable."),
                        )
                      : undefined,
                    actionError: runGiftCardLifecycle.error
                      ? errorMessage(
                          runGiftCardLifecycle.error,
                          t("The lifecycle action could not be completed."),
                        )
                      : undefined,
                    onBack: () => {
                      setSelectedGiftCardId(undefined);
                      runGiftCardLifecycle.reset();
                    },
                    onRetry: () => {
                      void giftCardLifecycleQuery.refetch();
                    },
                    onRun: (intent) => {
                      runGiftCardLifecycle.reset();
                      runGiftCardLifecycle.mutate(intent);
                    },
                  }
                : undefined,
            distribution: distributionCard
              ? {
                  organizationName:
                    session.user.organizationContext.organization.name,
                  card: distributionCard,
                  result: distributeGiftCard.data,
                  isSending: distributeGiftCard.isPending,
                  errorMessage: distributeGiftCard.error
                    ? errorMessage(
                        distributeGiftCard.error,
                        t("The recipient delivery could not be completed."),
                      )
                    : undefined,
                  onBack: () => {
                    setDistributionCard(undefined);
                    distributeGiftCard.reset();
                  },
                  onSend: (intent) => {
                    distributeGiftCard.reset();
                    distributeGiftCard.mutate(intent);
                  },
                }
              : undefined,
            bulkBatch: {
              organizationName:
                session.user.organizationContext.organization.name,
              canCreate:
                hasGiftCardIssuePermission && hasGiftCardDistributePermission,
              canView: hasGiftCardViewPermission,
              availableCorporateCredit:
                financeSummaryQuery.data?.currencies.map((currency) => ({
                  currency: currency.currency,
                  amount: currency.remainingCorporateCredit,
                })),
              result: giftCardBatchResult,
              isCreating: createBulkGiftCardBatch.isPending,
              isRefreshing: giftCardBatchQuery.isFetching,
              isLoadingMore: giftCardBatchQuery.isFetchingNextPage,
              isRetrying: retryBulkGiftCardBatch.isPending,
              createError: createBulkGiftCardBatch.error
                ? errorMessage(
                    createBulkGiftCardBatch.error,
                    t("The asynchronous batch could not be queued."),
                  )
                : undefined,
              refreshError: giftCardBatchQuery.error
                ? errorMessage(
                    giftCardBatchQuery.error,
                    t("The current batch result could not be refreshed."),
                  )
                : undefined,
              retryError: retryBulkGiftCardBatch.error
                ? errorMessage(
                    retryBulkGiftCardBatch.error,
                    t("The failed rows could not be queued for retry."),
                  )
                : undefined,
              onCreate: (intent) => {
                createBulkGiftCardBatch.reset();
                retryBulkGiftCardBatch.reset();
                createBulkGiftCardBatch.mutate(intent);
              },
              onRefresh: () => {
                void giftCardBatchQuery.refetch();
              },
              onLoadMore: () => {
                void giftCardBatchQuery.fetchNextPage();
              },
              onRetryFailed: () => {
                retryBulkGiftCardBatch.reset();
                retryBulkGiftCardBatch.mutate();
              },
              onStartNew: () => {
                setCurrentBatchId(undefined);
                createBulkGiftCardBatch.reset();
                retryBulkGiftCardBatch.reset();
              },
            },
            onRetry: () => {
              void giftCardInventoryQuery.refetch();
            },
            onLoadMore: () => {
              void giftCardInventoryQuery.fetchNextPage();
            },
            onOpenCard: (giftCardId) => {
              setDistributionCard(undefined);
              distributeGiftCard.reset();
              runGiftCardLifecycle.reset();
              setSelectedGiftCardId(giftCardId);
            },
            onDistributeCard: (card) => {
              setSelectedGiftCardId(undefined);
              runGiftCardLifecycle.reset();
              distributeGiftCard.reset();
              setDistributionCard(card);
            },
            onIssue: (intent) => {
              issueGiftCard.reset();
              issueGiftCard.mutate(intent);
            },
          }}
          organization={{
            page: subsidiariesQuery.data,
            createdSubsidiary: createSubsidiary.data,
            hasViewPermission: hasOrganizationViewPermission,
            hasCreatePermission: hasOrganizationCreatePermission,
            isLoading: subsidiariesQuery.isPending,
            isCreating: createSubsidiary.isPending,
            listError: subsidiariesQuery.error
              ? errorMessage(
                  subsidiariesQuery.error,
                  t("The organization structure is temporarily unavailable."),
                )
              : undefined,
            createError: createSubsidiary.error
              ? errorMessage(
                  createSubsidiary.error,
                  t("The subsidiary could not be created."),
                )
              : undefined,
            onPreviousPage: () => {
              setSubsidiaryOffset((current) =>
                Math.max(0, current - subsidiaryPageSize),
              );
            },
            onNextPage: () => {
              setSubsidiaryOffset((current) => current + subsidiaryPageSize);
            },
            onRetry: () => {
              void subsidiariesQuery.refetch();
            },
            onCreate: (name, code) => {
              createSubsidiary.reset();
              createSubsidiary.mutate({ name, code });
            },
          }}
          team={{
            organizationName:
              session.user.organizationContext.organization.name,
            page: organizationTeamQuery.data,
            roles: organizationRolesQuery.data,
            assignments: organizationRoleAssignmentsQuery.data,
            currentMembershipId: session.user.organizationContext.membershipId,
            grantablePermissions: organizationPermissions,
            permissions: {
              viewMembers: hasTeamViewPermission,
              addMembers: hasTeamAddPermission,
              disableMembers: hasTeamDisablePermission,
              viewRoles: hasRoleViewPermission,
              createRoles: hasRoleCreatePermission,
              grantPermissions: hasRoleGrantPermission,
              assignRoles: hasRoleAssignPermission,
            },
            isLoading:
              (hasTeamViewPermission && organizationTeamQuery.isPending) ||
              (hasRoleViewPermission &&
                (organizationRolesQuery.isPending ||
                  organizationRoleAssignmentsQuery.isPending)),
            isMutating:
              addTeamMember.isPending ||
              disableTeamMember.isPending ||
              createRole.isPending ||
              grantRolePermissions.isPending ||
              assignRole.isPending,
            errorMessage:
              organizationTeamQuery.error ||
              organizationRolesQuery.error ||
              organizationRoleAssignmentsQuery.error
                ? errorMessage(
                    organizationTeamQuery.error ??
                      organizationRolesQuery.error ??
                      organizationRoleAssignmentsQuery.error,
                    t("Team access information is temporarily unavailable."),
                  )
                : undefined,
            actionError:
              addTeamMember.error ||
              disableTeamMember.error ||
              createRole.error ||
              grantRolePermissions.error ||
              assignRole.error
                ? errorMessage(
                    addTeamMember.error ??
                      disableTeamMember.error ??
                      createRole.error ??
                      grantRolePermissions.error ??
                      assignRole.error,
                    t("The access change could not be completed."),
                  )
                : undefined,
            successMessage: addTeamMember.data
              ? t("{member} was added to the team.", {
                  member: addTeamMember.data.email ?? t("The account"),
                })
              : disableTeamMember.data
                ? t("{member} was disabled.", {
                    member: disableTeamMember.data.email ?? t("The member"),
                  })
                : createRole.data
                  ? t("{role} was created.", { role: createRole.data.name })
                  : grantRolePermissions.data
                    ? t("Permissions were added to {role}.", {
                        role: grantRolePermissions.data.name,
                      })
                    : assignRole.data
                      ? t("The role was assigned.")
                      : undefined,
            onPreviousPage: () => {
              setTeamOffset((current) => Math.max(0, current - teamPageSize));
            },
            onNextPage: () => {
              setTeamOffset((current) => current + teamPageSize);
            },
            onRetry: () => {
              void organizationTeamQuery.refetch();
              void organizationRolesQuery.refetch();
              void organizationRoleAssignmentsQuery.refetch();
            },
            onAddMember: (email) => {
              resetTeamActions();
              addTeamMember.mutate(email);
            },
            onDisableMember: (membershipId) => {
              resetTeamActions();
              disableTeamMember.mutate(membershipId);
            },
            onCreateRole: (name) => {
              resetTeamActions();
              createRole.mutate(name);
            },
            onGrantPermissions: (roleId, permissions) => {
              resetTeamActions();
              grantRolePermissions.mutate({ roleId, permissions });
            },
            onAssignRole: (membershipId, roleId, scope) => {
              resetTeamActions();
              assignRole.mutate({ membershipId, roleId, scope });
            },
          }}
          audit={{
            scopeName: session.user.organizationContext.organization.name,
            records:
              organizationAuditQuery.data?.pages.flatMap(
                (page) => page.items,
              ) ?? [],
            appliedFilters: organizationAuditFilters,
            hasPermission: hasOrganizationAuditPermission,
            hasMore: Boolean(organizationAuditQuery.hasNextPage),
            isLoading: organizationAuditQuery.isPending,
            isLoadingMore: organizationAuditQuery.isFetchingNextPage,
            errorMessage:
              organizationAuditQuery.error && !organizationAuditQuery.data
                ? errorMessage(
                    organizationAuditQuery.error,
                    t(
                      "Organization audit evidence is temporarily unavailable.",
                    ),
                  )
                : undefined,
            loadMoreError:
              organizationAuditQuery.isFetchNextPageError &&
              organizationAuditQuery.error
                ? errorMessage(
                    organizationAuditQuery.error,
                    t(
                      "More audit evidence could not be loaded. Current results are unchanged.",
                    ),
                  )
                : undefined,
            onApplyFilters: setOrganizationAuditFilters,
            onRetry: () => {
              void organizationAuditQuery.refetch();
            },
            onLoadMore: () => {
              void organizationAuditQuery.fetchNextPage();
            },
          }}
          onChangeOrganization={() => {
            clearOrganization.reset();
            clearOrganization.mutate();
          }}
          onLogout={() => {
            logout.reset();
            logout.mutate();
          }}
        />
      );
    }
  }

  return (
    <div className="app-frame">
      {/* Rendered here rather than in index.html so it speaks the reader's
          language along with everything else it sits above. */}
      <a className="skip-link" href="#main-content">
        {t("Skip to main content")}
      </a>
      <BrandHeader />
      {content}
      <footer className="site-footer">
        <div className="page-width">
          {t("Open Giftcard Portal · Secure organization access")}
        </div>
      </footer>
    </div>
  );
}
