using GiftCardPortal.Bff.Backend;

namespace GiftCardPortal.Bff.Contracts;

public sealed record LoginRequest(string Email, string Password);

public sealed record SelectOrganizationRequest(Guid OrganizationId);

public sealed record CreatePortalSubsidiaryRequest(string Name, string Code);

public sealed record AddPortalTeamMemberRequest(string? Email);

public sealed record CreatePortalRoleRequest(string? Name);

public sealed record GrantPortalRolePermissionsRequest(
    IReadOnlyList<string>? Permissions);

public sealed record AssignPortalRoleRequest(
    Guid MembershipId,
    Guid RoleId,
    string? Scope);

public sealed record AllocatePortalCorporateCreditRequest(
    string Amount,
    string Currency,
    string BusinessReference,
    Guid OperationId);

public sealed record ReversePortalCorporateCreditRequest(
    string Reason,
    Guid OperationId);

public sealed record IssuePortalGiftCardRequest(
    string? Amount,
    string? Currency,
    string? ValidFromUtc,
    string? ExpiresAtUtc,
    bool IsTransferable,
    bool IsDivisible,
    string? BusinessReference,
    Guid OperationId);

public sealed record RunPortalGiftCardLifecycleRequest(
    string? Reason,
    Guid OperationId);

public sealed record DistributePortalGiftCardRequest(
    string? ContactType,
    string? RecipientContact,
    string? BusinessReference,
    Guid OperationId);

public sealed record PortalBulkGiftCardBatchItemRequest(
    string? ItemReference,
    string? Amount,
    string? Currency,
    string? ValidFromUtc,
    string? ExpiresAtUtc,
    bool IsTransferable,
    bool IsDivisible,
    string? ContactType,
    string? RecipientContact);

public sealed record CreatePortalBulkGiftCardBatchRequest(
    string? BatchReference,
    IReadOnlyList<PortalBulkGiftCardBatchItemRequest>? Items,
    Guid OperationId);

public sealed record PortalSessionResponse(
    PortalUserResponse User,
    bool ContextWasCleared = false);

public sealed record PortalUserResponse(
    Guid Id,
    string Email,
    string? PhoneNumber,
    string Status,
    string ContextType,
    IReadOnlyList<string> PlatformPermissions,
    PortalOrganizationContextResponse? OrganizationContext);

public sealed record PortalOrganizationContextResponse(
    Guid MembershipId,
    Guid TenantRootOrganizationId,
    PortalOrganizationResponse Organization,
    IReadOnlyList<string> EffectivePermissions);

public sealed record PortalOrganizationPageResponse(
    IReadOnlyList<PortalOrganizationMembershipResponse> Items,
    int Limit,
    int Offset,
    bool HasMore);

public sealed record PortalPlatformOrganizationPageResponse(
    IReadOnlyList<PortalOrganizationResponse> Items,
    int Limit,
    int Offset,
    bool HasMore);

public sealed record PortalSubsidiaryResponse(
    string Name,
    string Code,
    string Status,
    int Depth,
    DateTimeOffset CreatedAtUtc);

public sealed record PortalSubsidiaryPageResponse(
    IReadOnlyList<PortalSubsidiaryResponse> Items,
    int Limit,
    int Offset,
    bool HasMore);

public sealed record PortalTeamMemberResponse(
    Guid Id,
    string? Email,
    string Status,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset? DisabledAtUtc);

public sealed record PortalTeamPageResponse(
    IReadOnlyList<PortalTeamMemberResponse> Items,
    int Limit,
    int Offset,
    bool HasMore);

public sealed record PortalRoleResponse(
    Guid Id,
    string Name,
    IReadOnlyList<string> Permissions,
    DateTimeOffset CreatedAtUtc);

public sealed record PortalRoleAssignmentResponse(
    Guid MembershipId,
    Guid RoleId,
    string Scope,
    DateTimeOffset CreatedAtUtc);

public sealed record PortalCorporateCreditBalanceResponse(
    string Currency,
    double Amount);

public sealed record PortalCorporateCreditReversalSummaryResponse(
    string Reason,
    DateTimeOffset ReversedAtUtc);

public sealed record PortalCorporateCreditAllocationResponse(
    Guid Id,
    double Amount,
    string Currency,
    string BusinessReference,
    DateTimeOffset AllocatedAtUtc,
    PortalCorporateCreditReversalSummaryResponse? Reversal);

public sealed record PortalCorporateCreditHistoryPageResponse(
    IReadOnlyList<PortalCorporateCreditAllocationResponse> Items,
    int Limit,
    string? NextCursor);

public sealed record PortalCorporateCreditReversalResponse(
    double Amount,
    string Currency,
    string Reason,
    DateTimeOffset ReversedAtUtc);

public sealed record PortalGiftCardResponse(
    Guid Id,
    string PublicReference,
    string BusinessReference,
    double FundedAmount,
    string Currency,
    string OwnershipState,
    string LifecycleState,
    DateTimeOffset ValidFromUtc,
    DateTimeOffset ExpiresAtUtc,
    bool IsTransferable,
    bool IsDivisible,
    DateTimeOffset IssuedAtUtc);

public sealed record PortalGiftCardInventoryPageResponse(
    IReadOnlyList<PortalGiftCardResponse> Items,
    int Limit,
    string? NextCursor);

public sealed record PortalGiftCardLifecycleEventResponse(
    string Action,
    string PreviousState,
    string NewState,
    string Reason,
    double? ReturnedAmount,
    string? Currency,
    DateTimeOffset OccurredAtUtc);

public sealed record PortalGiftCardLifecycleDetailResponse(
    PortalGiftCardResponse GiftCard,
    IReadOnlyList<PortalGiftCardLifecycleEventResponse> Events);

public sealed record PortalGiftCardDistributionResponse(
    string ContactType,
    string MaskedRecipientContact,
    string State,
    DateTimeOffset ClaimExpiresAtUtc,
    string BusinessReference,
    DateTimeOffset DistributedAtUtc);

public sealed record PortalBulkGiftCardBatchItemResponse(
    int Position,
    string ItemReference,
    string Status,
    string? GiftCardPublicReference,
    string ContactType,
    string MaskedRecipientContact,
    double Amount,
    string Currency,
    string? GiftCardState,
    string? InvitationState,
    DateTimeOffset? DistributedAtUtc,
    string? FailureCode,
    string? FailureMessage,
    DateTimeOffset? SettledAtUtc);

public sealed record PortalBulkGiftCardBatchResponse(
    Guid Id,
    string BatchReference,
    string Status,
    int TotalItems,
    int SucceededItems,
    int FailedItems,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset? CompletedAtUtc,
    Guid? RetryOfBatchId,
    int Limit,
    string? NextCursor,
    IReadOnlyList<PortalBulkGiftCardBatchItemResponse> Items);

public sealed record PortalOrganizationMembershipResponse(
    Guid MembershipId,
    Guid TenantRootOrganizationId,
    PortalOrganizationResponse Organization,
    DateTimeOffset MembershipCreatedAtUtc);

public sealed record PortalOrganizationResponse(
    Guid Id,
    string Name,
    string Code,
    string Status,
    int Depth,
    DateTimeOffset CreatedAtUtc);

public sealed record PortalFinancialCurrencySummaryResponse(
    string Currency,
    double Granted,
    double Reversed,
    double Issued,
    double Distributed,
    double RemainingCorporateCredit,
    double RemainingGiftCardValue,
    double CancelledReturned,
    double ExpiredReturned);

public sealed record PortalFinancialSummaryResponse(
    DateTimeOffset AsOfUtc,
    IReadOnlyList<PortalFinancialCurrencySummaryResponse> Currencies);

public sealed record PortalFinancialHistoryItemResponse(
    string EventKey,
    string Category,
    string Operation,
    string? GiftCardPublicReference,
    string? BusinessReference,
    double? Amount,
    string? Currency,
    string FinancialDirection,
    string? State,
    DateTimeOffset OccurredAtUtc);

public sealed record PortalFinancialHistoryPageResponse(
    IReadOnlyList<PortalFinancialHistoryItemResponse> Items,
    int Limit,
    string? NextCursor);

/// <summary>
/// One funded card as the issuing organization may see it.
///
/// <see cref="RemainingBalance"/> is null for a card an identity already owns.
/// That is ADR-052 and not an omission: the funded amount is the company's own
/// figure, while what the recipient has left to spend is a record of their
/// spending and is theirs. The backend suppresses it in SQL; this contract
/// carries the absence rather than substituting a zero.
/// </summary>
public sealed record PortalCardRegisterItemResponse(
    Guid GiftCardId,
    string PublicReference,
    string LifecycleState,
    string OwnershipState,
    double FundedAmount,
    string Currency,
    double? RemainingBalance,
    string? MaskedRecipientContact,
    DateTimeOffset ValidFromUtc,
    DateTimeOffset ExpiresAtUtc,
    DateTimeOffset IssuedAtUtc,
    DateTimeOffset? DistributedAtUtc,
    DateTimeOffset? ClaimedAtUtc);

public sealed record PortalCardRegisterPageResponse(
    IReadOnlyList<PortalCardRegisterItemResponse> Items,
    int Limit,
    string? NextCursor);

public sealed record PortalReconciliationFindingResponse(
    string Code,
    string Severity,
    string EntityType,
    string? TechnicalReference,
    string? Currency,
    double? ExpectedAmount,
    double? ActualAmount,
    string Message);

public sealed record PortalFinancialReconciliationResponse(
    DateTimeOffset CheckedAtUtc,
    bool IsConsistent,
    int TransactionsChecked,
    int GiftCardsChecked,
    int SharesChecked,
    int ActiveReservationsChecked,
    IReadOnlyList<PortalReconciliationFindingResponse> Findings);

public sealed record PortalAuditInvestigationItemResponse(
    Guid ActorUserReference,
    string ActorType,
    string Operation,
    string EntityType,
    string EntityReference,
    string Outcome,
    Guid CorrelationReference,
    DateTimeOffset OccurredAtUtc,
    IReadOnlyDictionary<string, string> Metadata);

public sealed record PortalAuditInvestigationPageResponse(
    IReadOnlyList<PortalAuditInvestigationItemResponse> Items,
    int Limit,
    string? NextCursor);

public sealed record PortalPaymentReportItemResponse(
    Guid Id,
    string GiftCardPublicReference,
    string PosClientCode,
    string PosClientDisplayName,
    string PosTerminalCode,
    string StoreReference,
    string? PosTransactionReference,
    double ProvisionedAmount,
    double? ConfirmedAmount,
    double RefundedAmount,
    double NetAmount,
    string Currency,
    string State,
    bool IsFullyReversed,
    int RefundCount,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset? SettledAtUtc);

public sealed record PortalPaymentReportCurrencyTotalsResponse(
    string Currency,
    long PaymentCount,
    long ConfirmedPaymentCount,
    long RefundCount,
    long FullyReversedPaymentCount,
    double ProvisionedAmount,
    double ConfirmedAmount,
    double RefundedAmount,
    double NetAmount);

public sealed record PortalPaymentReportPageResponse(
    IReadOnlyList<PortalPaymentReportItemResponse> Items,
    int Limit,
    string? NextCursor,
    long TotalMatchingPayments,
    IReadOnlyList<PortalPaymentReportCurrencyTotalsResponse> MatchingTotals);

public sealed record PortalPaymentRefundResponse(
    string PosTerminalCode,
    string StoreReference,
    string? PosTransactionReference,
    string Reason,
    double Amount,
    DateTimeOffset RefundedAtUtc);

public sealed record PortalPaymentReceiptResponse(
    PortalPaymentReportItemResponse Payment,
    IReadOnlyList<PortalPaymentRefundResponse> Refunds);

public static class PortalContractMapper
{
    public static PortalSessionResponse ToPortalResponse(
        this CurrentUserApiResponse user,
        bool contextWasCleared = false) =>
        new(
            new PortalUserResponse(
                user.Id,
                Required(user.Email, nameof(user.Email)),
                user.PhoneNumber,
                Required(user.Status, nameof(user.Status)),
                Required(user.ContextType, nameof(user.ContextType)),
                user.PlatformPermissions?.ToArray() ?? [],
                user.OrganizationContext is null
                    ? null
                    : new PortalOrganizationContextResponse(
                        user.OrganizationContext.MembershipId,
                        user.OrganizationContext.TenantRootOrganizationId,
                        user.OrganizationContext.Organization.ToPortalResponse(),
                        user.OrganizationContext.EffectivePermissions?.ToArray() ?? [])),
            contextWasCleared);

    public static PortalOrganizationPageResponse ToPortalResponse(
        this UserOrganizationApiResponsePagedApiResponse page) =>
        new(
            (page.Items ?? []).Select(item => new PortalOrganizationMembershipResponse(
                    item.MembershipId,
                    item.TenantRootOrganizationId,
                    item.Organization.ToPortalResponse(),
                    item.MembershipCreatedAtUtc))
                .ToArray(),
            page.Limit,
            page.Offset,
            page.HasMore);

    public static PortalPlatformOrganizationPageResponse ToPortalResponse(
        this OrganizationApiResponsePagedApiResponse page) =>
        new(
            (page.Items ?? []).Select(item => item.ToPortalResponse()).ToArray(),
            page.Limit,
            page.Offset,
            page.HasMore);

    public static PortalOrganizationResponse ToPortalResponse(
        this OrganizationApiResponse organization) =>
        new(
            organization.Id,
            Required(organization.Name, nameof(organization.Name)),
            Required(organization.Code, nameof(organization.Code)),
            Required(organization.Status, nameof(organization.Status)),
            organization.Depth,
            organization.CreatedAtUtc);

    public static PortalSubsidiaryPageResponse ToPortalResponse(
        this SubsidiaryApiResponsePagedApiResponse page) =>
        new(
            (page.Items ?? [])
                .Select(item => item.ToPortalResponse())
                .ToArray(),
            page.Limit,
            page.Offset,
            page.HasMore);

    public static PortalSubsidiaryResponse ToPortalResponse(
        this SubsidiaryApiResponse subsidiary) =>
        new(
            Required(subsidiary.Name, nameof(subsidiary.Name)),
            Required(subsidiary.Code, nameof(subsidiary.Code)),
            Required(subsidiary.Status, nameof(subsidiary.Status)),
            subsidiary.Depth,
            subsidiary.CreatedAtUtc);

    public static PortalTeamPageResponse ToPortalResponse(
        this MembershipApiResponsePagedApiResponse page) =>
        new(
            (page.Items ?? []).Select(item => item.ToPortalResponse()).ToArray(),
            page.Limit,
            page.Offset,
            page.HasMore);

    public static PortalTeamMemberResponse ToPortalResponse(
        this MembershipApiResponse membership) =>
        new(
            membership.Id,
            membership.Email,
            Required(membership.Status, nameof(membership.Status)),
            membership.CreatedAtUtc,
            membership.DisabledAtUtc);

    public static PortalRoleResponse ToPortalResponse(this RoleApiResponse role) =>
        new(
            role.Id,
            Required(role.Name, nameof(role.Name)),
            role.Permissions?.Order(StringComparer.Ordinal).ToArray() ?? [],
            role.CreatedAtUtc);

    public static PortalRoleAssignmentResponse ToPortalResponse(
        this RoleAssignmentApiResponse assignment) =>
        new(
            assignment.MembershipId,
            assignment.RoleId,
            Required(assignment.Scope, nameof(assignment.Scope)),
            assignment.CreatedAtUtc);

    public static IReadOnlyList<PortalCorporateCreditBalanceResponse> ToPortalResponse(
        this ICollection<CorporateCreditBalanceApiResponse> balances) =>
        balances
            .Select(balance => new PortalCorporateCreditBalanceResponse(
                Required(balance.Currency, nameof(balance.Currency)),
                balance.Amount))
            .ToArray();

    public static PortalCorporateCreditHistoryPageResponse ToPortalResponse(
        this CorporateCreditHistoryPageApiResponse page) =>
        new(
            (page.Items ?? [])
                .Select(item => new PortalCorporateCreditAllocationResponse(
                    item.Id,
                    item.Amount,
                    Required(item.Currency, nameof(item.Currency)),
                    Required(item.BusinessReference, nameof(item.BusinessReference)),
                    item.AllocatedAtUtc,
                    item.Reversal is null
                        ? null
                        : new PortalCorporateCreditReversalSummaryResponse(
                            Required(item.Reversal.Reason, nameof(item.Reversal.Reason)),
                            item.Reversal.ReversedAtUtc)))
                .ToArray(),
            page.Limit,
            page.NextCursor);

    public static PortalCorporateCreditAllocationResponse ToPortalResponse(
        this CorporateCreditAllocationApiResponse allocation) =>
        new(
            allocation.Id,
            allocation.Amount,
            Required(allocation.Currency, nameof(allocation.Currency)),
            Required(allocation.BusinessReference, nameof(allocation.BusinessReference)),
            allocation.AllocatedAtUtc,
            null);

    public static PortalCorporateCreditReversalResponse ToPortalResponse(
        this CorporateCreditReversalApiResponse reversal) =>
        new(
            reversal.Amount,
            Required(reversal.Currency, nameof(reversal.Currency)),
            Required(reversal.Reason, nameof(reversal.Reason)),
            reversal.ReversedAtUtc);

    public static PortalGiftCardInventoryPageResponse ToPortalResponse(
        this GiftCardInventoryPageApiResponse page) =>
        new(
            (page.Items ?? [])
                .Select(item => item.ToPortalResponse())
                .ToArray(),
            page.Limit,
            page.NextCursor);

    public static PortalGiftCardResponse ToPortalResponse(
        this GiftCardApiResponse giftCard) =>
        new(
            giftCard.Id,
            Required(giftCard.PublicReference, nameof(giftCard.PublicReference)),
            Required(giftCard.BusinessReference, nameof(giftCard.BusinessReference)),
            giftCard.FundedAmount,
            Required(giftCard.Currency, nameof(giftCard.Currency)),
            Required(giftCard.OwnershipState, nameof(giftCard.OwnershipState)),
            Required(giftCard.LifecycleState, nameof(giftCard.LifecycleState)),
            giftCard.ValidFromUtc,
            giftCard.ExpiresAtUtc,
            giftCard.IsTransferable,
            giftCard.IsDivisible,
            giftCard.IssuedAtUtc);

    public static PortalGiftCardLifecycleDetailResponse ToPortalResponse(
        this GiftCardLifecycleHistoryApiResponse history) =>
        new(
            history.GiftCard.ToPortalResponse(),
            (history.Events ?? [])
                .Select(item => item.ToPortalResponse())
                .ToArray());

    public static PortalGiftCardLifecycleEventResponse ToPortalResponse(
        this GiftCardLifecycleEventResult lifecycleEvent) =>
        new(
            ((int)lifecycleEvent.Action) switch
            {
                1 => "Suspend",
                2 => "Reactivate",
                3 => "Cancel",
                4 => "Expire",
                _ => throw new InvalidOperationException(
                    "The backend returned an unsupported lifecycle action."),
            },
            Required(lifecycleEvent.PreviousState, nameof(lifecycleEvent.PreviousState)),
            Required(lifecycleEvent.NewState, nameof(lifecycleEvent.NewState)),
            Required(lifecycleEvent.Reason, nameof(lifecycleEvent.Reason)),
            lifecycleEvent.ReturnedAmount,
            lifecycleEvent.Currency,
            lifecycleEvent.OccurredAtUtc);

    public static PortalGiftCardDistributionResponse ToPortalResponse(
        this DistributionInvitationApiResponse distribution) =>
        new(
            ContactTypeLabel(distribution.ContactType),
            Required(
                distribution.MaskedRecipientContact,
                nameof(distribution.MaskedRecipientContact)),
            Required(distribution.State, nameof(distribution.State)),
            distribution.ClaimExpiresAtUtc,
            Required(distribution.BusinessReference, nameof(distribution.BusinessReference)),
            distribution.DistributedAtUtc);

    public static PortalBulkGiftCardBatchResponse ToPortalResponse(
        this BulkGiftCardBatchSummary batch) =>
        new(
            batch.Id,
            Required(batch.BatchReference, nameof(batch.BatchReference)),
            Required(batch.Status, nameof(batch.Status)),
            batch.TotalItems,
            batch.SucceededItems,
            batch.FailedItems,
            batch.CreatedAtUtc,
            batch.CompletedAtUtc,
            batch.RetryOfBatchId,
            200,
            null,
            []);

    public static PortalBulkGiftCardBatchResponse ToPortalResponse(
        this BulkGiftCardBatchPage batch) =>
        new(
            batch.Id,
            Required(batch.BatchReference, nameof(batch.BatchReference)),
            Required(batch.Status, nameof(batch.Status)),
            batch.TotalItems,
            batch.SucceededItems,
            batch.FailedItems,
            batch.CreatedAtUtc,
            batch.CompletedAtUtc,
            batch.RetryOfBatchId,
            batch.Limit,
            batch.NextCursor,
            (batch.Items ?? [])
                .Select(item => new PortalBulkGiftCardBatchItemResponse(
                    item.Position,
                    Required(item.ItemReference, nameof(item.ItemReference)),
                    Required(item.Status, nameof(item.Status)),
                    item.GiftCardPublicReference,
                    ContactTypeLabel(item.ContactType),
                    Required(
                        item.MaskedRecipientContact,
                        nameof(item.MaskedRecipientContact)),
                    item.Amount,
                    Required(item.Currency, nameof(item.Currency)),
                    item.GiftCardState,
                    item.InvitationState,
                    item.DistributedAtUtc,
                    item.FailureCode,
                    item.FailureMessage,
                    item.SettledAtUtc))
                .ToArray());

    public static PortalFinancialSummaryResponse ToPortalResponse(
        this OrganizationFinancialSummary summary) =>
        new(
            summary.AsOfUtc,
            (summary.Currencies ?? [])
                .Select(item => new PortalFinancialCurrencySummaryResponse(
                    Required(item.Currency, nameof(item.Currency)),
                    item.Granted,
                    item.Reversed,
                    item.Issued,
                    item.Distributed,
                    item.RemainingCorporateCredit,
                    item.RemainingGiftCardValue,
                    item.CancelledReturned,
                    item.ExpiredReturned))
                .ToArray());

    public static PortalFinancialHistoryPageResponse ToPortalResponse(
        this FinancialHistoryPage page) =>
        new(
            (page.Items ?? [])
                .Select(item => new PortalFinancialHistoryItemResponse(
                    Required(item.EventKey, nameof(item.EventKey)),
                    Required(item.Category, nameof(item.Category)),
                    Required(item.Operation, nameof(item.Operation)),
                    item.GiftCardPublicReference,
                    item.BusinessReference,
                    item.Amount,
                    item.Currency,
                    Required(item.FinancialDirection, nameof(item.FinancialDirection)),
                    item.State,
                    item.OccurredAtUtc))
                .ToArray(),
            page.Limit,
            page.NextCursor);

    public static PortalCardRegisterPageResponse ToPortalResponse(
        this OrganizationCardRegisterPage page) =>
        new(
            (page.Items ?? [])
                .Select(item => new PortalCardRegisterItemResponse(
                    item.GiftCardId,
                    Required(item.PublicReference, nameof(item.PublicReference)),
                    Required(item.LifecycleState, nameof(item.LifecycleState)),
                    Required(item.OwnershipState, nameof(item.OwnershipState)),
                    item.FundedAmount,
                    Required(item.Currency, nameof(item.Currency)),
                    item.RemainingBalance,
                    item.MaskedRecipientContact,
                    item.ValidFromUtc,
                    item.ExpiresAtUtc,
                    item.IssuedAtUtc,
                    item.DistributedAtUtc,
                    item.ClaimedAtUtc))
                .ToArray(),
            page.Limit,
            page.NextCursor);

    public static PortalFinancialReconciliationResponse ToPortalResponse(
        this OrganizationReconciliationResult reconciliation) =>
        new(
            reconciliation.CheckedAtUtc,
            reconciliation.IsConsistent,
            reconciliation.TransactionsChecked,
            reconciliation.GiftCardsChecked,
            reconciliation.SharesChecked,
            reconciliation.ActiveReservationsChecked,
            (reconciliation.Findings ?? [])
                .Select(item => new PortalReconciliationFindingResponse(
                    Required(item.Code, nameof(item.Code)),
                    item.Severity switch
                    {
                        ReconciliationSeverity._1 => "Error",
                        ReconciliationSeverity._2 => "Warning",
                        _ => "Unknown",
                    },
                    Required(item.EntityType, nameof(item.EntityType)),
                    item.EntityId,
                    item.Currency,
                    item.ExpectedAmount,
                    item.ActualAmount,
                    Required(item.Message, nameof(item.Message))))
                .ToArray());

    public static PortalAuditInvestigationPageResponse ToPortalResponse(
        this AuditInvestigationPage page) =>
        new(
            (page.Items ?? [])
                .Select(item => new PortalAuditInvestigationItemResponse(
                    item.ActorUserId,
                    ((int)item.ActorType) switch
                    {
                        1 => "Platform operator",
                        2 => "Organization member",
                        3 => "System",
                        4 => "Identity user",
                        5 => "POS client",
                        _ => throw new InvalidDataException(
                            "The backend returned an unsupported audit actor type."),
                    },
                    Required(item.Operation, nameof(item.Operation)),
                    Required(item.EntityType, nameof(item.EntityType)),
                    Required(item.EntityId, nameof(item.EntityId)),
                    ((int)item.Outcome) switch
                    {
                        1 => "Success",
                        2 => "Failure",
                        _ => throw new InvalidDataException(
                            "The backend returned an unsupported audit outcome."),
                    },
                    item.CorrelationId,
                    item.OccurredAtUtc,
                    new SortedDictionary<string, string>(
                        item.Metadata
                            ?? new Dictionary<string, string>(),
                        StringComparer.Ordinal)))
                .ToArray(),
            page.Limit,
            page.NextCursor);

    public static PortalPaymentReportPageResponse ToPortalResponse(
        this PaymentReportPage page) =>
        new(
            (page.Items ?? []).Select(ToPortalResponse).ToArray(),
            page.Limit,
            page.NextCursor,
            page.TotalMatchingPayments,
            (page.MatchingTotals ?? [])
                .Select(item => new PortalPaymentReportCurrencyTotalsResponse(
                    Required(item.Currency, nameof(item.Currency)),
                    item.PaymentCount,
                    item.ConfirmedPaymentCount,
                    item.RefundCount,
                    item.FullyReversedPaymentCount,
                    item.ProvisionedAmount,
                    item.ConfirmedAmount,
                    item.RefundedAmount,
                    item.NetAmount))
                .ToArray());

    public static PortalPaymentReceiptResponse ToPortalResponse(
        this PaymentReceiptReport receipt) =>
        new(
            ToPortalResponse(receipt.Payment),
            (receipt.Refunds ?? [])
                .Select(item => new PortalPaymentRefundResponse(
                    Required(item.PosTerminalCode, nameof(item.PosTerminalCode)),
                    Required(item.StoreReference, nameof(item.StoreReference)),
                    item.PosTransactionReference,
                    Required(item.Reason, nameof(item.Reason)),
                    item.Amount,
                    item.RefundedAtUtc))
                .ToArray());

    private static PortalPaymentReportItemResponse ToPortalResponse(
        PaymentReportItem item) =>
        new(
            item.PaymentProvisionId,
            Required(item.GiftCardPublicReference, nameof(item.GiftCardPublicReference)),
            Required(item.PosClientCode, nameof(item.PosClientCode)),
            Required(item.PosClientDisplayName, nameof(item.PosClientDisplayName)),
            Required(item.PosTerminalCode, nameof(item.PosTerminalCode)),
            Required(item.StoreReference, nameof(item.StoreReference)),
            item.PosTransactionReference,
            item.ProvisionedAmount,
            item.ConfirmedAmount,
            item.RefundedAmount,
            item.NetAmount,
            Required(item.Currency, nameof(item.Currency)),
            Required(item.State, nameof(item.State)),
            item.IsFullyReversed,
            item.RefundCount,
            item.CreatedAtUtc,
            item.SettledAtUtc);

    private static string Required(string? value, string fieldName) =>
        !string.IsNullOrWhiteSpace(value)
            ? value
            : throw new InvalidDataException(
                $"The backend response omitted required field '{fieldName}'.");

    private static string ContactTypeLabel(RecipientContactType type) =>
        ((int)type) switch
        {
            1 => "Email",
            2 => "Phone",
            _ => throw new InvalidDataException(
                "The backend returned an unsupported recipient contact type."),
        };
}
