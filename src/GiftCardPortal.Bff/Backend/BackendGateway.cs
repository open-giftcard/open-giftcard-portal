using System.Net;
using System.Net.Http.Headers;
using GiftCardPortal.Bff.Errors;
using GiftCardPortal.Bff.Sessions;

namespace GiftCardPortal.Bff.Backend;

public sealed record BackendBulkGiftCardBatchItem(
    string ItemReference,
    double Amount,
    string Currency,
    DateTimeOffset? ValidFromUtc,
    DateTimeOffset ExpiresAtUtc,
    bool IsTransferable,
    bool IsDivisible,
    RecipientContactType ContactType,
    string RecipientContact);

public sealed class BackendGateway(
    IHttpClientFactory httpClientFactory,
    IPortalSessionStore sessionStore,
    SessionTokenProtector tokenProtector,
    SessionRefreshCoordinator refreshCoordinator,
    TimeProvider timeProvider)
{
    private const string ForwardedForHeader = "X-Forwarded-For";

    public Task<TokenPairApiResponse> LoginAsync(
        string email,
        string password,
        IPAddress? clientAddress,
        CancellationToken cancellationToken)
    {
        var client = CreateClient(null, null, clientAddress);
        return client.LoginAsync(
            new LoginApiRequest
            {
                Email = email,
                Password = password,
                PhoneNumber = null,
            },
            cancellationToken);
    }

    public Task<(PortalSession Session, CurrentUserApiResponse User)> GetCurrentUserAsync(
        PortalSession session,
        Guid? organizationId,
        CancellationToken cancellationToken) =>
        ExecuteAuthorizedAsync(
            session,
            organizationId,
            (client, token) => client.GetCurrentUserAsync(token),
            cancellationToken);

    public Task<(
        PortalSession Session,
        UserOrganizationApiResponsePagedApiResponse Organizations)> GetOrganizationsAsync(
        PortalSession session,
        CancellationToken cancellationToken) =>
        ExecuteAuthorizedAsync(
            session,
            null,
            (client, token) => client.ListCurrentUserOrganizationsAsync(200, 0, token),
            cancellationToken);

    public Task<(
        PortalSession Session,
        OrganizationApiResponsePagedApiResponse Organizations)> GetPlatformOrganizationsAsync(
        PortalSession session,
        string? search,
        string? status,
        int? limit,
        int? offset,
        CancellationToken cancellationToken) =>
        ExecuteAuthorizedAsync(
            session,
            null,
            (client, token) => client.ListPlatformOrganizationsAsync(
                search,
                status,
                limit,
                offset,
                token),
            cancellationToken);

    public Task<(PortalSession Session, OrganizationApiResponse Organization)>
        GetPlatformOrganizationAsync(
            PortalSession session,
            Guid organizationId,
            CancellationToken cancellationToken) =>
        ExecuteAuthorizedAsync(
            session,
            null,
            (client, token) => client.GetOrganizationAsync(
                organizationId,
                token),
            cancellationToken);

    public Task<(
        PortalSession Session,
        SubsidiaryApiResponsePagedApiResponse Subsidiaries)> GetSubsidiariesAsync(
        PortalSession session,
        Guid selectedOrganizationId,
        int limit,
        int offset,
        CancellationToken cancellationToken) =>
        ExecuteAuthorizedAsync(
            session,
            selectedOrganizationId,
            (client, token) => client.ListSubsidiariesAsync(
                selectedOrganizationId,
                limit,
                offset,
                token),
            cancellationToken);

    public Task<(PortalSession Session, SubsidiaryApiResponse Subsidiary)>
        CreateSubsidiaryAsync(
            PortalSession session,
            Guid selectedOrganizationId,
            string name,
            string code,
            CancellationToken cancellationToken) =>
        ExecuteAuthorizedAsync(
            session,
            selectedOrganizationId,
            (client, token) => client.CreateSubsidiaryAsync(
                selectedOrganizationId,
                new CreateSubsidiaryApiRequest
                {
                    Name = name,
                    Code = code,
                },
                token),
            cancellationToken);

    public Task<(PortalSession Session, MembershipApiResponsePagedApiResponse Team)>
        GetTeamAsync(
            PortalSession session,
            Guid organizationId,
            Guid? organizationContextId,
            int limit,
            int offset,
            CancellationToken cancellationToken) =>
        ExecuteAuthorizedAsync(
            session,
            organizationContextId,
            (client, token) => client.ListMembershipsAsync(
                organizationId,
                limit,
                offset,
                token),
            cancellationToken);

    public Task<(PortalSession Session, MembershipApiResponse Member)> AddTeamMemberAsync(
        PortalSession session,
        Guid organizationId,
        string email,
        CancellationToken cancellationToken) =>
        ExecuteAuthorizedAsync(
            session,
            organizationId,
            (client, token) => client.CreateMembershipAsync(
                organizationId,
                new CreateMembershipApiRequest
                {
                    UserId = null,
                    Email = email,
                },
                token),
            cancellationToken);

    public Task<(PortalSession Session, MembershipApiResponse Member)>
        DisableTeamMemberAsync(
            PortalSession session,
            Guid organizationId,
            Guid membershipId,
            CancellationToken cancellationToken) =>
        ExecuteAuthorizedAsync(
            session,
            organizationId,
            (client, token) => client.DisableMembershipAsync(
                organizationId,
                membershipId,
                token),
            cancellationToken);

    public Task<(PortalSession Session, ICollection<RoleApiResponse> Roles)> GetRolesAsync(
        PortalSession session,
        Guid organizationId,
        CancellationToken cancellationToken) =>
        ExecuteAuthorizedAsync(
            session,
            organizationId,
            (client, token) => client.ListRolesAsync(organizationId, token),
            cancellationToken);

    public Task<(PortalSession Session, RoleApiResponse Role)> CreateRoleAsync(
        PortalSession session,
        Guid organizationId,
        string name,
        CancellationToken cancellationToken) =>
        ExecuteAuthorizedAsync(
            session,
            organizationId,
            (client, token) => client.CreateRoleAsync(
                organizationId,
                new CreateRoleApiRequest { Name = name },
                token),
            cancellationToken);

    public Task<(PortalSession Session, RoleApiResponse Role)> GrantRolePermissionsAsync(
        PortalSession session,
        Guid organizationId,
        Guid roleId,
        IReadOnlyList<string> permissions,
        CancellationToken cancellationToken) =>
        ExecuteAuthorizedAsync(
            session,
            organizationId,
            (client, token) => client.GrantRolePermissionsAsync(
                organizationId,
                roleId,
                new GrantPermissionsApiRequest
                {
                    Permissions = permissions.ToArray(),
                },
                token),
            cancellationToken);

    public Task<(PortalSession Session, ICollection<RoleAssignmentApiResponse> Assignments)>
        GetRoleAssignmentsAsync(
            PortalSession session,
            Guid organizationId,
            CancellationToken cancellationToken) =>
        ExecuteAuthorizedAsync(
            session,
            organizationId,
            (client, token) => client.ListRoleAssignmentsAsync(organizationId, token),
            cancellationToken);

    public Task<(PortalSession Session, RoleAssignmentApiResponse Assignment)>
        AssignRoleAsync(
            PortalSession session,
            Guid organizationId,
            Guid membershipId,
            Guid roleId,
            RoleScope scope,
            CancellationToken cancellationToken) =>
        ExecuteAuthorizedAsync(
            session,
            organizationId,
            (client, token) => client.AssignRoleAsync(
                organizationId,
                new AssignRoleApiRequest
                {
                    MembershipId = membershipId,
                    RoleId = roleId,
                    Scope = scope,
                    AnchorOrganizationId = organizationId,
                    SelectedOrganizationIds = null,
                },
                token),
            cancellationToken);

    public Task<(PortalSession Session, GiftCardInventoryPageApiResponse Inventory)>
        GetGiftCardInventoryAsync(
            PortalSession session,
            Guid selectedOrganizationId,
            int limit,
            string? cursor,
            CancellationToken cancellationToken) =>
        ExecuteAuthorizedAsync(
            session,
            selectedOrganizationId,
            (client, token) => client.GetGiftCardInventoryAsync(
                selectedOrganizationId,
                limit,
                cursor,
                token),
            cancellationToken);

    public Task<(PortalSession Session, GiftCardApiResponse GiftCard)>
        IssueGiftCardAsync(
            PortalSession session,
            Guid selectedOrganizationId,
            double amount,
            string currency,
            DateTimeOffset? validFromUtc,
            DateTimeOffset expiresAtUtc,
            bool isTransferable,
            bool isDivisible,
            string businessReference,
            string idempotencyKey,
            CancellationToken cancellationToken) =>
        ExecuteAuthorizedAsync(
            session,
            selectedOrganizationId,
            (client, token) => client.IssueGiftCardAsync(
                selectedOrganizationId,
                new IssueGiftCardApiRequest
                {
                    Amount = amount,
                    Currency = currency,
                    ValidFromUtc = validFromUtc,
                    ExpiresAtUtc = expiresAtUtc,
                    IsTransferable = isTransferable,
                    IsDivisible = isDivisible,
                    BusinessReference = businessReference,
                    IdempotencyKey = idempotencyKey,
                },
                token),
            cancellationToken);

    public Task<(PortalSession Session, GiftCardLifecycleHistoryApiResponse History)>
        GetGiftCardLifecycleHistoryAsync(
            PortalSession session,
            Guid selectedOrganizationId,
            Guid giftCardId,
            CancellationToken cancellationToken) =>
        ExecuteAuthorizedAsync(
            session,
            selectedOrganizationId,
            (client, token) => client.GetOrganizationGiftCardLifecycleHistoryAsync(
                selectedOrganizationId,
                giftCardId,
                token),
            cancellationToken);

    public Task<(PortalSession Session, GiftCardLifecycleOperationApiResponse Operation)>
        ExecuteGiftCardLifecycleAsync(
            PortalSession session,
            Guid selectedOrganizationId,
            Guid giftCardId,
            string action,
            string reason,
            string idempotencyKey,
            CancellationToken cancellationToken) =>
        ExecuteAuthorizedAsync(
            session,
            selectedOrganizationId,
            (client, token) =>
            {
                var request = new GiftCardLifecycleCommandApiRequest
                {
                    Reason = reason,
                    IdempotencyKey = idempotencyKey,
                };
                return action switch
                {
                    "suspend" => client.SuspendOrganizationGiftCardAsync(
                        selectedOrganizationId,
                        giftCardId,
                        request,
                        token),
                    "reactivate" => client.ReactivateOrganizationGiftCardAsync(
                        selectedOrganizationId,
                        giftCardId,
                        request,
                        token),
                    "cancel" => client.CancelOrganizationGiftCardAsync(
                        selectedOrganizationId,
                        giftCardId,
                        request,
                        token),
                    "expire" => client.ExpireOrganizationGiftCardAsync(
                        selectedOrganizationId,
                        giftCardId,
                        request,
                        token),
                    _ => throw new ArgumentOutOfRangeException(
                        nameof(action),
                        action,
                        "Unsupported gift-card lifecycle action."),
                };
            },
            cancellationToken);

    public Task<(PortalSession Session, DistributionInvitationApiResponse Distribution)>
        DistributeGiftCardAsync(
            PortalSession session,
            Guid selectedOrganizationId,
            Guid giftCardId,
            RecipientContactType contactType,
            string recipientContact,
            string businessReference,
            string idempotencyKey,
            CancellationToken cancellationToken) =>
        ExecuteAuthorizedAsync(
            session,
            selectedOrganizationId,
            (client, token) => client.DistributeGiftCardAsync(
                selectedOrganizationId,
                giftCardId,
                new DistributeGiftCardApiRequest
                {
                    ContactType = contactType,
                    RecipientContact = recipientContact,
                    BusinessReference = businessReference,
                    IdempotencyKey = idempotencyKey,
                },
                token),
            cancellationToken);

    public Task<(PortalSession Session, BulkGiftCardBatchSummary Batch)>
        AcceptBulkGiftCardBatchAsync(
            PortalSession session,
            Guid selectedOrganizationId,
            string batchReference,
            IReadOnlyList<BackendBulkGiftCardBatchItem> items,
            string idempotencyKey,
            CancellationToken cancellationToken) =>
        ExecuteAuthorizedAsync(
            session,
            selectedOrganizationId,
            (client, token) => client.AcceptAsyncBulkGiftCardBatchAsync(
                selectedOrganizationId,
                new CreateBulkGiftCardBatchApiRequest
                {
                    BatchReference = batchReference,
                    IdempotencyKey = idempotencyKey,
                    Items = items
                        .Select(item => new BulkGiftCardBatchItemApiRequest
                        {
                            ItemReference = item.ItemReference,
                            Amount = item.Amount,
                            Currency = item.Currency,
                            ValidFromUtc = item.ValidFromUtc,
                            ExpiresAtUtc = item.ExpiresAtUtc,
                            IsTransferable = item.IsTransferable,
                            IsDivisible = item.IsDivisible,
                            ContactType = item.ContactType,
                            RecipientContact = item.RecipientContact,
                        })
                        .ToArray(),
                },
                token),
            cancellationToken);

    public Task<(PortalSession Session, BulkGiftCardBatchPage Batch)>
        GetBulkGiftCardBatchPageAsync(
            PortalSession session,
            Guid selectedOrganizationId,
            Guid batchId,
            int? limit,
            string? cursor,
            CancellationToken cancellationToken) =>
        ExecuteAuthorizedAsync(
            session,
            selectedOrganizationId,
            (client, token) => client.GetAsyncBulkGiftCardBatchAsync(
                selectedOrganizationId,
                batchId,
                limit,
                cursor,
                token),
            cancellationToken);

    public Task<(PortalSession Session, BulkGiftCardBatchSummary Batch)>
        RetryBulkGiftCardBatchAsync(
            PortalSession session,
            Guid selectedOrganizationId,
            Guid batchId,
            CancellationToken cancellationToken) =>
        ExecuteAuthorizedAsync(
            session,
            selectedOrganizationId,
            (client, token) => client.RetryAsyncBulkGiftCardBatchAsync(
                selectedOrganizationId,
                batchId,
                token),
            cancellationToken);

    public Task<(
        PortalSession Session,
        ICollection<CorporateCreditBalanceApiResponse> Balances)>
        GetPlatformCorporateCreditBalancesAsync(
            PortalSession session,
            Guid organizationId,
            CancellationToken cancellationToken) =>
        ExecuteAuthorizedAsync(
            session,
            null,
            (client, token) => client.GetCorporateCreditBalancesAsync(
                organizationId,
                token),
            cancellationToken);

    public Task<(
        PortalSession Session,
        CorporateCreditHistoryPageApiResponse History)>
        GetPlatformCorporateCreditHistoryAsync(
            PortalSession session,
            Guid organizationId,
            int limit,
            string? cursor,
            CancellationToken cancellationToken) =>
        ExecuteAuthorizedAsync(
            session,
            null,
            (client, token) => client.GetCorporateCreditAllocationHistoryAsync(
                organizationId,
                limit,
                cursor,
                token),
            cancellationToken);

    public Task<(PortalSession Session, CorporateCreditAllocationApiResponse Allocation)>
        AllocatePlatformCorporateCreditAsync(
            PortalSession session,
            Guid organizationId,
            double amount,
            string currency,
            string businessReference,
            string idempotencyKey,
            CancellationToken cancellationToken) =>
        ExecuteAuthorizedAsync(
            session,
            null,
            (client, token) => client.AllocateCorporateCreditAsync(
                new AllocateCorporateCreditApiRequest
                {
                    OrganizationId = organizationId,
                    Amount = amount,
                    Currency = currency,
                    BusinessReference = businessReference,
                    IdempotencyKey = idempotencyKey,
                },
                token),
            cancellationToken);

    public Task<(PortalSession Session, CorporateCreditReversalApiResponse Reversal)>
        ReversePlatformCorporateCreditAsync(
            PortalSession session,
            Guid allocationId,
            string reason,
            string idempotencyKey,
            CancellationToken cancellationToken) =>
        ExecuteAuthorizedAsync(
            session,
            null,
            (client, token) => client.ReverseCorporateCreditAsync(
                allocationId,
                new ReverseCorporateCreditApiRequest
                {
                    Reason = reason,
                    IdempotencyKey = idempotencyKey,
                },
                token),
            cancellationToken);

    public Task<(PortalSession Session, OrganizationFinancialSummary Summary)>
        GetFinancialSummaryAsync(
            PortalSession session,
            Guid tenantRootOrganizationId,
            CancellationToken cancellationToken) =>
        ExecuteAuthorizedAsync(
            session,
            tenantRootOrganizationId,
            (client, token) => client.GetOrganizationFinancialSummaryAsync(
                tenantRootOrganizationId,
                token),
            cancellationToken);

    public Task<(PortalSession Session, FinancialHistoryPage History)>
        GetFinancialHistoryAsync(
            PortalSession session,
            Guid tenantRootOrganizationId,
            int limit,
            string? cursor,
            string? category,
            string? operation,
            string? currency,
            string? reference,
            DateTimeOffset? occurredFromUtc,
            DateTimeOffset? occurredBeforeUtc,
            CancellationToken cancellationToken) =>
        ExecuteAuthorizedAsync(
            session,
            tenantRootOrganizationId,
            (client, token) => client.GetOrganizationFinancialHistoryAsync(
                tenantRootOrganizationId,
                limit,
                cursor,
                category,
                operation,
                currency,
                reference,
                occurredFromUtc,
                occurredBeforeUtc,
                token),
            cancellationToken);

    /// <summary>
    /// The organization's register of every card it funded, including those an
    /// identity now owns. Distinct from gift-card inventory, which loses sight
    /// of a card the moment it reaches its recipient.
    /// </summary>
    public Task<(PortalSession Session, OrganizationCardRegisterPage Register)>
        GetCardRegisterAsync(
            PortalSession session,
            Guid tenantRootOrganizationId,
            int limit,
            string? cursor,
            string? lifecycleState,
            string? ownershipState,
            string? currency,
            string? reference,
            CancellationToken cancellationToken) =>
        ExecuteAuthorizedAsync(
            session,
            tenantRootOrganizationId,
            (client, token) => client.GetOrganizationCardRegisterAsync(
                tenantRootOrganizationId,
                limit,
                cursor,
                lifecycleState,
                ownershipState,
                currency,
                reference,
                token),
            cancellationToken);

    public Task<(PortalSession Session, PaymentReportPage Report)>
        GetPlatformPaymentReportAsync(
            PortalSession session,
            int limit,
            string? cursor,
            string? storeReference,
            string? state,
            string? currency,
            string? reference,
            DateTimeOffset? occurredFromUtc,
            DateTimeOffset? occurredBeforeUtc,
            CancellationToken cancellationToken) =>
        ExecuteAuthorizedAsync(
            session,
            null,
            (client, token) => client.GetPosPaymentReportAsync(
                limit,
                cursor,
                null,
                null,
                null,
                storeReference,
                state,
                currency,
                reference,
                occurredFromUtc,
                occurredBeforeUtc,
                token),
            cancellationToken);

    public Task<(PortalSession Session, PaymentReceiptReport Receipt)>
        GetPlatformPaymentReceiptAsync(
            PortalSession session,
            Guid paymentProvisionId,
            CancellationToken cancellationToken) =>
        ExecuteAuthorizedAsync(
            session,
            null,
            (client, token) => client.GetPosPaymentReceiptReportAsync(
                paymentProvisionId,
                token),
            cancellationToken);

    public Task<(PortalSession Session, OrganizationReconciliationResult Reconciliation)>
        GetFinancialReconciliationAsync(
            PortalSession session,
            Guid tenantRootOrganizationId,
            CancellationToken cancellationToken) =>
        ExecuteAuthorizedAsync(
            session,
            tenantRootOrganizationId,
            (client, token) => client.ReconcileOrganizationFinancialsAsync(
                tenantRootOrganizationId,
                token),
            cancellationToken);

    public Task<(PortalSession Session, AuditInvestigationPage Audit)>
        GetAuditRecordsAsync(
            PortalSession session,
            Guid organizationId,
            Guid? organizationContextId,
            int limit,
            string? cursor,
            string? operation,
            AuditOutcome? outcome,
            Guid? correlationId,
            CancellationToken cancellationToken) =>
        ExecuteAuthorizedAsync(
            session,
            organizationContextId,
            (client, token) => client.GetOrganizationAuditRecordsAsync(
                organizationId,
                limit,
                cursor,
                operation,
                outcome,
                correlationId,
                token),
            cancellationToken);

    public async Task RevokeBestEffortAsync(
        PortalSession session,
        CancellationToken cancellationToken)
    {
        try
        {
            var client = CreateClient(
                tokenProtector.Unprotect(session.ProtectedAccessToken),
                null);
            await client.RevokeSessionAsync(
                new RevokeSessionApiRequest
                {
                    RefreshToken = tokenProtector.Unprotect(session.ProtectedRefreshToken),
                },
                cancellationToken);
        }
        catch (Exception exception) when (
            exception is ApiException
            or HttpRequestException
            or TaskCanceledException)
        {
            // Logout must always clear the local session. Remote revocation is
            // deliberately best effort when the backend is unavailable.
        }
    }

    private async Task<(PortalSession Session, T Value)> ExecuteAuthorizedAsync<T>(
        PortalSession initialSession,
        Guid? organizationId,
        Func<IBackendApiClient, CancellationToken, Task<T>> operation,
        CancellationToken cancellationToken)
    {
        var session = await RefreshIfExpiringAsync(initialSession, cancellationToken);

        try
        {
            var value = await operation(
                CreateClient(
                    tokenProtector.Unprotect(session.ProtectedAccessToken),
                    organizationId),
                cancellationToken);
            return (session, value);
        }
        catch (ApiException exception) when (exception.StatusCode == StatusCodes.Status401Unauthorized)
        {
            session = await RefreshAfterUnauthorizedAsync(session, cancellationToken);
        }

        try
        {
            var value = await operation(
                CreateClient(
                    tokenProtector.Unprotect(session.ProtectedAccessToken),
                    organizationId),
                cancellationToken);
            return (session, value);
        }
        catch (ApiException exception) when (exception.StatusCode == StatusCodes.Status401Unauthorized)
        {
            await sessionStore.DeleteAsync(session.SessionKeyHash, cancellationToken);
            throw new PortalSessionExpiredException();
        }
    }

    private Task<PortalSession> RefreshIfExpiringAsync(
        PortalSession session,
        CancellationToken cancellationToken) =>
        session.AccessTokenExpiresAtUtc > timeProvider.GetUtcNow().AddSeconds(30)
            ? Task.FromResult(session)
            : RefreshUnderLockAsync(session, false, cancellationToken);

    private Task<PortalSession> RefreshAfterUnauthorizedAsync(
        PortalSession session,
        CancellationToken cancellationToken) =>
        RefreshUnderLockAsync(session, true, cancellationToken);

    private async Task<PortalSession> RefreshUnderLockAsync(
        PortalSession observedSession,
        bool refreshAfterUnauthorized,
        CancellationToken cancellationToken)
    {
        using var refreshLock = await refreshCoordinator.AcquireAsync(
            observedSession.SessionKeyHash,
            cancellationToken);
        await using var distributedRefreshLock =
            await sessionStore.AcquireRefreshLockAsync(
                observedSession.SessionKeyHash,
                cancellationToken);

        var current = await sessionStore.FindAsync(
                observedSession.SessionKeyHash,
                cancellationToken)
            ?? throw new PortalSessionExpiredException();

        var anotherRequestRefreshed =
            !string.Equals(
                current.ProtectedAccessToken,
                observedSession.ProtectedAccessToken,
                StringComparison.Ordinal);
        if (anotherRequestRefreshed
            || (!refreshAfterUnauthorized
                && current.AccessTokenExpiresAtUtc > timeProvider.GetUtcNow().AddSeconds(30)))
        {
            return current;
        }

        if (current.RefreshTokenExpiresAtUtc <= timeProvider.GetUtcNow())
        {
            await sessionStore.DeleteAsync(current.SessionKeyHash, cancellationToken);
            throw new PortalSessionExpiredException();
        }

        try
        {
            var client = CreateClient(null, null);
            var tokenPair = await client.RefreshSessionAsync(
                new RefreshSessionApiRequest
                {
                    RefreshToken = tokenProtector.Unprotect(current.ProtectedRefreshToken),
                },
                cancellationToken);

            var accessToken = RequiredToken(
                tokenPair.AccessToken,
                nameof(tokenPair.AccessToken));
            var refreshToken = RequiredToken(
                tokenPair.RefreshToken,
                nameof(tokenPair.RefreshToken));
            var updated = current with
            {
                ProtectedAccessToken = tokenProtector.Protect(accessToken),
                AccessTokenExpiresAtUtc = tokenPair.AccessTokenExpiresAtUtc,
                ProtectedRefreshToken = tokenProtector.Protect(refreshToken),
                RefreshTokenExpiresAtUtc = tokenPair.RefreshTokenExpiresAtUtc,
                UpdatedAtUtc = timeProvider.GetUtcNow(),
            };
            await sessionStore.UpsertAsync(updated, cancellationToken);
            return updated;
        }
        catch (ApiException exception) when (exception.StatusCode == StatusCodes.Status401Unauthorized)
        {
            await sessionStore.DeleteAsync(current.SessionKeyHash, cancellationToken);
            throw new PortalSessionExpiredException();
        }
    }

    private BackendApiClient CreateClient(
        string? accessToken,
        Guid? organizationId,
        IPAddress? forwardedClientAddress = null)
    {
        var httpClient = httpClientFactory.CreateClient("backend");
        httpClient.DefaultRequestHeaders.Remove(ForwardedForHeader);
        if (forwardedClientAddress is not null)
        {
            var normalizedAddress = forwardedClientAddress.IsIPv4MappedToIPv6
                ? forwardedClientAddress.MapToIPv4()
                : forwardedClientAddress;
            httpClient.DefaultRequestHeaders.TryAddWithoutValidation(
                ForwardedForHeader,
                normalizedAddress.ToString());
        }

        if (!string.IsNullOrWhiteSpace(accessToken))
        {
            httpClient.DefaultRequestHeaders.Authorization =
                new AuthenticationHeaderValue("Bearer", accessToken);
        }

        if (organizationId is not null)
        {
            httpClient.DefaultRequestHeaders.Add(
                "X-Organization-Id",
                organizationId.Value.ToString());
        }

        return new BackendApiClient(httpClient);
    }

    private static string RequiredToken(string? token, string fieldName) =>
        !string.IsNullOrWhiteSpace(token)
            ? token
            : throw new InvalidDataException(
                $"The backend response omitted required field '{fieldName}'.");
}
