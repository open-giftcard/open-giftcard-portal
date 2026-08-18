export interface PortalOrganization {
  id: string;
  name: string;
  code: string;
  status: string;
  depth: number;
  createdAtUtc: string;
}

export interface PortalOrganizationContext {
  membershipId: string;
  tenantRootOrganizationId: string;
  organization: PortalOrganization;
  effectivePermissions: string[];
}

export interface PortalUser {
  id: string;
  email: string;
  phoneNumber: string | null;
  status: string;
  contextType: string;
  platformPermissions: string[];
  organizationContext: PortalOrganizationContext | null;
}

export interface PortalSession {
  user: PortalUser;
  contextWasCleared: boolean;
}

export interface PortalOrganizationMembership {
  membershipId: string;
  tenantRootOrganizationId: string;
  organization: PortalOrganization;
  membershipCreatedAtUtc: string;
}

export interface PortalOrganizationPage {
  items: PortalOrganizationMembership[];
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface PortalPlatformOrganizationPage {
  items: PortalOrganization[];
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface PortalSubsidiary {
  name: string;
  code: string;
  status: string;
  depth: number;
  createdAtUtc: string;
}

export interface PortalSubsidiaryPage {
  items: PortalSubsidiary[];
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface PortalTeamMember {
  id: string;
  email: string | null;
  status: string;
  createdAtUtc: string;
  disabledAtUtc: string | null;
}

export interface PortalTeamPage {
  items: PortalTeamMember[];
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface PortalRole {
  id: string;
  name: string;
  permissions: string[];
  createdAtUtc: string;
}

export type PortalRoleScope = "Organization" | "Subtree";

export interface PortalRoleAssignment {
  membershipId: string;
  roleId: string;
  scope: string;
  createdAtUtc: string;
}

export interface PortalCorporateCreditBalance {
  currency: string;
  amount: number;
}

export interface PortalCorporateCreditReversalSummary {
  reason: string;
  reversedAtUtc: string;
}

export interface PortalCorporateCreditAllocation {
  id: string;
  amount: number;
  currency: string;
  businessReference: string;
  allocatedAtUtc: string;
  reversal: PortalCorporateCreditReversalSummary | null;
}

export interface PortalCorporateCreditHistoryPage {
  items: PortalCorporateCreditAllocation[];
  limit: number;
  nextCursor: string | null;
}

export interface PortalCorporateCreditReversal {
  amount: number;
  currency: string;
  reason: string;
  reversedAtUtc: string;
}

export interface PortalGiftCard {
  id: string;
  publicReference: string;
  businessReference: string;
  fundedAmount: number;
  currency: string;
  ownershipState: string;
  lifecycleState: string;
  validFromUtc: string;
  expiresAtUtc: string;
  isTransferable: boolean;
  isDivisible: boolean;
  issuedAtUtc: string;
}

export interface PortalGiftCardInventoryPage {
  items: PortalGiftCard[];
  limit: number;
  nextCursor: string | null;
}

export type PortalGiftCardLifecycleAction =
  "suspend" | "reactivate" | "cancel" | "expire";

export interface PortalGiftCardLifecycleEvent {
  action: string;
  previousState: string;
  newState: string;
  reason: string;
  returnedAmount: number | null;
  currency: string | null;
  occurredAtUtc: string;
}

export interface PortalGiftCardLifecycleDetail {
  giftCard: PortalGiftCard;
  events: PortalGiftCardLifecycleEvent[];
}

export type PortalRecipientContactType = "email" | "phone";

export interface PortalGiftCardDistribution {
  contactType: string;
  maskedRecipientContact: string;
  state: string;
  claimExpiresAtUtc: string;
  businessReference: string;
  distributedAtUtc: string;
}

export interface PortalBulkGiftCardBatchItem {
  position: number;
  itemReference: string;
  status: string;
  giftCardPublicReference: string | null;
  contactType: string;
  maskedRecipientContact: string;
  amount: number;
  currency: string;
  giftCardState: string | null;
  invitationState: string | null;
  distributedAtUtc: string | null;
  failureCode: string | null;
  failureMessage: string | null;
  settledAtUtc: string | null;
}

export interface PortalBulkGiftCardBatch {
  id: string;
  batchReference: string;
  status: string;
  totalItems: number;
  succeededItems: number;
  failedItems: number;
  createdAtUtc: string;
  completedAtUtc: string | null;
  retryOfBatchId: string | null;
  limit: number;
  nextCursor: string | null;
  items: PortalBulkGiftCardBatchItem[];
}

export interface PortalFinancialCurrencySummary {
  currency: string;
  granted: number;
  reversed: number;
  issued: number;
  distributed: number;
  remainingCorporateCredit: number;
  remainingGiftCardValue: number;
  cancelledReturned: number;
  expiredReturned: number;
}

export interface PortalFinancialSummary {
  asOfUtc: string;
  currencies: PortalFinancialCurrencySummary[];
}

export interface PortalFinancialHistoryItem {
  eventKey: string;
  category: string;
  operation: string;
  giftCardPublicReference: string | null;
  businessReference: string | null;
  amount: number | null;
  currency: string | null;
  financialDirection: string;
  state: string | null;
  occurredAtUtc: string;
}

export interface PortalFinancialHistoryPage {
  items: PortalFinancialHistoryItem[];
  limit: number;
  nextCursor: string | null;
}

export type PortalFinancialHistoryCategory =
  "" | "CorporateCredit" | "GiftCard" | "Distribution" | "Lifecycle";

export interface PortalFinancialHistoryFilters {
  category: PortalFinancialHistoryCategory;
  operation: string;
  currency: string;
  reference: string;
  occurredFrom: string;
  occurredThrough: string;
}

export interface PortalReconciliationFinding {
  code: string;
  severity: "Error" | "Warning" | "Unknown";
  entityType: string;
  technicalReference: string | null;
  currency: string | null;
  expectedAmount: number | null;
  actualAmount: number | null;
  message: string;
}

export type PortalAuditOutcomeFilter = "" | "Success" | "Failure";

export interface PortalAuditFilters {
  operation: string;
  outcome: PortalAuditOutcomeFilter;
  correlationId: string;
}

export interface PortalAuditItem {
  actorUserReference: string;
  actorType: string;
  operation: string;
  entityType: string;
  entityReference: string;
  outcome: "Success" | "Failure";
  correlationReference: string;
  occurredAtUtc: string;
  metadata: Record<string, string>;
}

export interface PortalAuditPage {
  items: PortalAuditItem[];
  limit: number;
  nextCursor: string | null;
}

export interface PortalFinancialReconciliation {
  checkedAtUtc: string;
  isConsistent: boolean;
  transactionsChecked: number;
  giftCardsChecked: number;
  sharesChecked: number;
  activeReservationsChecked: number;
  findings: PortalReconciliationFinding[];
}

export type PortalPaymentState =
  "" | "Active" | "Confirmed" | "Cancelled" | "Expired";

export interface PortalPaymentFilters {
  storeReference: string;
  state: PortalPaymentState;
  currency: string;
  reference: string;
  occurredFrom: string;
  occurredThrough: string;
}

export interface PortalPaymentReportItem {
  id: string;
  giftCardPublicReference: string;
  posClientCode: string;
  posClientDisplayName: string;
  posTerminalCode: string;
  storeReference: string;
  posTransactionReference: string | null;
  provisionedAmount: number;
  confirmedAmount: number | null;
  refundedAmount: number;
  netAmount: number;
  currency: string;
  state: string;
  isFullyReversed: boolean;
  refundCount: number;
  createdAtUtc: string;
  settledAtUtc: string | null;
}

export interface PortalPaymentReportCurrencyTotals {
  currency: string;
  paymentCount: number;
  confirmedPaymentCount: number;
  refundCount: number;
  fullyReversedPaymentCount: number;
  provisionedAmount: number;
  confirmedAmount: number;
  refundedAmount: number;
  netAmount: number;
}

export interface PortalPaymentReportPage {
  items: PortalPaymentReportItem[];
  limit: number;
  nextCursor: string | null;
  totalMatchingPayments: number;
  matchingTotals: PortalPaymentReportCurrencyTotals[];
}

export interface PortalPaymentRefund {
  posTerminalCode: string;
  storeReference: string;
  posTransactionReference: string | null;
  reason: string;
  amount: number;
  refundedAtUtc: string;
}

export interface PortalPaymentReceipt {
  payment: PortalPaymentReportItem;
  refunds: PortalPaymentRefund[];
}

export type PortalCardLifecycleState =
  "" | "Active" | "Suspended" | "Cancelled" | "Expired" | "AwaitingClaim";

export type PortalCardOwnershipState =
  "" | "OrganizationInventory" | "AwaitingClaim" | "IdentityOwned";

export interface PortalCardRegisterFilters {
  lifecycleState: PortalCardLifecycleState;
  ownershipState: PortalCardOwnershipState;
  currency: string;
  reference: string;
}

/**
 * `remainingBalance` is null once an identity owns the card. That is the
 * ADR-052 boundary and not missing data: the company funded the card and may
 * see that figure, but what the recipient has left is a record of their
 * spending. Render the absence; never fall back to zero.
 */
export interface PortalCardRegisterItem {
  giftCardId: string;
  publicReference: string;
  lifecycleState: string;
  ownershipState: string;
  fundedAmount: number;
  currency: string;
  remainingBalance: number | null;
  maskedRecipientContact: string | null;
  validFromUtc: string;
  expiresAtUtc: string;
  issuedAtUtc: string;
  distributedAtUtc: string | null;
  claimedAtUtc: string | null;
}

export interface PortalCardRegisterPage {
  items: PortalCardRegisterItem[];
  limit: number;
  nextCursor: string | null;
}

export interface ProblemDetails {
  status?: number;
  title?: string;
  type?: string;
}
