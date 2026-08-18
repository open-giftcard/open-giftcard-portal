using System.Collections.Concurrent;
using System.Globalization;
using System.Net;
using System.Text;
using System.Text.Json;

namespace GiftCardPortal.Bff.Tests;

internal sealed class FakeBackendHandler : HttpMessageHandler
{
    private static readonly string[] EffectivePermissions =
    [
        "organization.corporate_credits.view",
        "organization.gift_cards.distribute",
        "organization.gift_cards.issue",
        "organization.gift_cards.lifecycle.manage",
        "organization.gift_cards.view",
        "organization.audit.view",
        "organization.memberships.create",
        "organization.memberships.disable",
        "organization.memberships.view",
        "role.assign",
        "role.create",
        "role.manage_permissions",
        "role.view",
        "organization.view",
        "organization.create_subsidiary",
    ];
    private static readonly string[] PlatformPermissions =
    [
        "platform.audit.view",
        "platform.organizations.memberships.view",
        "platform.organizations.view",
        "platform.payments.view",
    ];

    public static readonly Guid OrganizationId =
        Guid.Parse("018f5d9a-c17f-7b30-a954-4f28198669b7");

    public static readonly Guid TenantRootOrganizationId =
        Guid.Parse("018f5d98-9cda-7e30-9db6-6037af923ad8");

    public static readonly Guid CorporateCreditAllocationId =
        Guid.Parse("018f5db0-115b-7a69-84a0-991b1cd18d92");

    public static readonly Guid GiftCardId =
        Guid.Parse("018f5dc3-a865-7c11-a2a0-8326b3b96f62");

    public static readonly Guid GiftCardBatchId =
        Guid.Parse("018f5dc3-a865-7c11-a2a0-8326b3b96f80");

    public static readonly Guid GiftCardRetryBatchId =
        Guid.Parse("018f5dc3-a865-7c11-a2a0-8326b3b96f81");

    public static readonly Guid AuditRecordId =
        Guid.Parse("018f5dc3-a865-7c11-a2a0-8326b3b96fa0");

    public static readonly Guid AuditActorUserId =
        Guid.Parse("018f5dc3-a865-7c11-a2a0-8326b3b96fa1");

    public static readonly Guid AuditMembershipId =
        Guid.Parse("018f5dc3-a865-7c11-a2a0-8326b3b96fa2");

    public static readonly Guid AuditCorrelationId =
        Guid.Parse("018f5dc3-a865-7c11-a2a0-8326b3b96fa3");

    public static readonly Guid PaymentProvisionId =
        Guid.Parse("018f5dc3-a865-7c11-a2a0-8326b3b96fc0");

    public static readonly Guid PosClientId =
        Guid.Parse("018f5dc3-a865-7c11-a2a0-8326b3b96fc1");

    public static readonly Guid PosTerminalId =
        Guid.Parse("018f5dc3-a865-7c11-a2a0-8326b3b96fc2");

    public static readonly Guid RefundId =
        Guid.Parse("018f5dc3-a865-7c11-a2a0-8326b3b96fc3");

    public static readonly Guid PaymentLedgerId =
        Guid.Parse("018f5dc3-a865-7c11-a2a0-8326b3b96fc4");

    public static readonly Guid CurrentMembershipId =
        Guid.Parse("018f5d9b-18fd-7c02-9e18-f9b3f594a39c");

    public static readonly Guid TeamMembershipId =
        Guid.Parse("018f5dc3-a865-7c11-a2a0-8326b3b96fb0");

    public static readonly Guid TeamUserId =
        Guid.Parse("018f5dc3-a865-7c11-a2a0-8326b3b96fb1");

    public static readonly Guid RoleId =
        Guid.Parse("018f5dc3-a865-7c11-a2a0-8326b3b96fb2");

    public ConcurrentQueue<HttpRequestMessage> Requests { get; } = new();

    public bool UnauthorizedNextCurrentUserRequest { get; set; }

    public bool ForbidNextCurrentUserRequest { get; set; }

    public bool ForbidNextPlatformOrganizationsRequest { get; set; }

    public bool ForbidNextFinancialSummaryRequest { get; set; }

    public bool ForbidNextFinancialReconciliationRequest { get; set; }

    public bool ForbidNextAuditRecordsRequest { get; set; }

    public bool ForbidNextPaymentReportRequest { get; set; }

    public bool ForbidNextSubsidiariesRequest { get; set; }

    public HttpStatusCode? RejectNextSubsidiaryCreationWith { get; set; }

    public HttpStatusCode? RejectNextFundingAllocationWith { get; set; }

    public HttpStatusCode? RejectNextFundingReversalWith { get; set; }

    public HttpStatusCode? RejectNextGiftCardInventoryWith { get; set; }

    public HttpStatusCode? RejectNextGiftCardIssuanceWith { get; set; }

    public HttpStatusCode? RejectNextGiftCardLifecycleHistoryWith { get; set; }

    public HttpStatusCode? RejectNextGiftCardLifecycleWith { get; set; }

    public HttpStatusCode? RejectNextGiftCardDistributionWith { get; set; }

    public string? RejectNextGiftCardDistributionCode { get; set; }

    public HttpStatusCode? RejectNextGiftCardBatchWith { get; set; }

    public HttpStatusCode? RejectNextGiftCardBatchReadWith { get; set; }

    public HttpStatusCode? RejectNextTeamOperationWith { get; set; }

    public bool UsePlatformContext { get; set; }

    public string? LastCreatedSubsidiaryRequestBody { get; private set; }

    public string? LastFundingAllocationRequestBody { get; private set; }

    public string? LastFundingReversalRequestBody { get; private set; }

    public string? LastGiftCardIssuanceRequestBody { get; private set; }

    public string? LastGiftCardLifecycleRequestBody { get; private set; }

    public string? LastGiftCardDistributionRequestBody { get; private set; }

    public string? LastGiftCardBatchRequestBody { get; private set; }

    public string? LastTeamMemberRequestBody { get; private set; }

    public string? LastRoleRequestBody { get; private set; }

    public string? LastRolePermissionsRequestBody { get; private set; }

    public string? LastRoleAssignmentRequestBody { get; private set; }

    public int TeamDisableCount { get; private set; }

    public int RefreshCount { get; private set; }

    protected override async Task<HttpResponseMessage> SendAsync(
        HttpRequestMessage request,
        CancellationToken cancellationToken)
    {
        Requests.Enqueue(Clone(request));

        var path = request.RequestUri?.AbsolutePath;
        if (path == "/api/v1/auth/login")
        {
            return Json(HttpStatusCode.OK, TokenPair("access-one", "refresh-one"));
        }

        if (path == "/api/v1/auth/refresh")
        {
            RefreshCount++;
            return Json(HttpStatusCode.OK, TokenPair("access-two", "refresh-two"));
        }

        if (path == "/api/v1/auth/revoke")
        {
            return new HttpResponseMessage(HttpStatusCode.NoContent);
        }

        if (path == "/api/v1/me/organizations")
        {
            return Json(
                HttpStatusCode.OK,
                new
                {
                    items = new[]
                    {
                        new
                        {
                            membershipId = CurrentMembershipId,
                            tenantRootOrganizationId = TenantRootOrganizationId,
                            organization = Organization(),
                            membershipCreatedAtUtc = DateTimeOffset.UtcNow,
                        },
                    },
                    limit = 200,
                    offset = 0,
                    hasMore = false,
                });
        }

        if (path == "/api/v1/organizations"
            && request.Method == HttpMethod.Get)
        {
            if (ForbidNextPlatformOrganizationsRequest)
            {
                ForbidNextPlatformOrganizationsRequest = false;
                return new HttpResponseMessage(HttpStatusCode.Forbidden);
            }

            return Json(
                HttpStatusCode.OK,
                new
                {
                    items = new[]
                    {
                        Organization(),
                    },
                    limit = 20,
                    offset = 0,
                    hasMore = false,
                });
        }

        if (path == $"/api/v1/organizations/{OrganizationId}"
            && request.Method == HttpMethod.Get)
        {
            return Json(HttpStatusCode.OK, Organization());
        }

        if (path == "/api/v1/me")
        {
            if (UnauthorizedNextCurrentUserRequest)
            {
                UnauthorizedNextCurrentUserRequest = false;
                return new HttpResponseMessage(HttpStatusCode.Unauthorized);
            }

            if (ForbidNextCurrentUserRequest)
            {
                ForbidNextCurrentUserRequest = false;
                return new HttpResponseMessage(HttpStatusCode.Forbidden);
            }

            var organizationId = request.Headers.TryGetValues(
                "X-Organization-Id",
                out var values)
                ? values.Single()
                : null;
            return Json(
                HttpStatusCode.OK,
                new
                {
                    id = Guid.Parse("018f5d99-7179-7b25-88d0-a9fc17b6361a"),
                    email = "staff@example.test",
                    phoneNumber = (string?)null,
                    status = "Active",
                    contextType = organizationId is not null
                        ? "Organization"
                        : UsePlatformContext
                            ? "Platform"
                            : "Identity",
                    platformPermissions = UsePlatformContext
                        ? PlatformPermissions
                        : Array.Empty<string>(),
                    organizationContext = organizationId is null
                        ? null
                        : new
                        {
                            membershipId = CurrentMembershipId,
                            tenantRootOrganizationId = TenantRootOrganizationId,
                            organization = Organization(),
                            effectivePermissions = EffectivePermissions,
                        },
                });
        }

        var membershipsPath =
            $"/api/v1/organizations/{OrganizationId}/memberships";
        if (path == membershipsPath)
        {
            if (RejectNextTeamOperationWith is { } rejectionStatus)
            {
                RejectNextTeamOperationWith = null;
                return new HttpResponseMessage(rejectionStatus);
            }

            if (request.Method == HttpMethod.Post)
            {
                LastTeamMemberRequestBody =
                    await request.Content!.ReadAsStringAsync(cancellationToken);
                return Json(HttpStatusCode.Created, TeamMember());
            }

            return Json(
                HttpStatusCode.OK,
                new
                {
                    items = new[]
                    {
                        TeamMember(
                            CurrentMembershipId,
                            Guid.Parse("018f5d99-7179-7b25-88d0-a9fc17b6361a"),
                            "staff@example.test"),
                        TeamMember(),
                    },
                    limit = 25,
                    offset = 0,
                    hasMore = false,
                });
        }

        if (path == $"{membershipsPath}/{TeamMembershipId}/disable"
            && request.Method == HttpMethod.Post)
        {
            if (RejectNextTeamOperationWith is { } rejectionStatus)
            {
                RejectNextTeamOperationWith = null;
                return new HttpResponseMessage(rejectionStatus);
            }

            TeamDisableCount++;
            return Json(
                HttpStatusCode.OK,
                TeamMember(status: "Disabled", disabledAtUtc: DateTimeOffset.UtcNow));
        }

        var rolesPath = $"/api/v1/organizations/{OrganizationId}/roles";
        if (path == $"{rolesPath}/assignments")
        {
            if (RejectNextTeamOperationWith is { } rejectionStatus)
            {
                RejectNextTeamOperationWith = null;
                return new HttpResponseMessage(rejectionStatus);
            }

            if (request.Method == HttpMethod.Post)
            {
                LastRoleAssignmentRequestBody =
                    await request.Content!.ReadAsStringAsync(cancellationToken);
                return Json(HttpStatusCode.Created, RoleAssignment());
            }

            return Json(HttpStatusCode.OK, new[] { RoleAssignment() });
        }

        if (path == $"{rolesPath}/{RoleId}/permissions"
            && request.Method == HttpMethod.Post)
        {
            if (RejectNextTeamOperationWith is { } rejectionStatus)
            {
                RejectNextTeamOperationWith = null;
                return new HttpResponseMessage(rejectionStatus);
            }

            LastRolePermissionsRequestBody =
                await request.Content!.ReadAsStringAsync(cancellationToken);
            return Json(HttpStatusCode.OK, Role());
        }

        if (path == rolesPath)
        {
            if (RejectNextTeamOperationWith is { } rejectionStatus)
            {
                RejectNextTeamOperationWith = null;
                return new HttpResponseMessage(rejectionStatus);
            }

            if (request.Method == HttpMethod.Post)
            {
                LastRoleRequestBody =
                    await request.Content!.ReadAsStringAsync(cancellationToken);
                return Json(HttpStatusCode.Created, Role());
            }

            return Json(HttpStatusCode.OK, new[] { Role() });
        }

        if (path ==
            $"/api/v1/organizations/{OrganizationId}/subsidiaries")
        {
            if (ForbidNextSubsidiariesRequest)
            {
                ForbidNextSubsidiariesRequest = false;
                return new HttpResponseMessage(HttpStatusCode.Forbidden);
            }

            if (request.Method == HttpMethod.Post)
            {
                if (RejectNextSubsidiaryCreationWith is { } rejectionStatus)
                {
                    RejectNextSubsidiaryCreationWith = null;
                    return new HttpResponseMessage(rejectionStatus);
                }

                LastCreatedSubsidiaryRequestBody =
                    await request.Content!.ReadAsStringAsync(cancellationToken);
                return Json(
                    HttpStatusCode.Created,
                    Subsidiary("Demo New Branch", "DEMO-NEW"));
            }

            return Json(
                HttpStatusCode.OK,
                new
                {
                    items = new[]
                    {
                        Subsidiary("Demo East Branch", "DEMO-EAST"),
                    },
                    limit = 20,
                    offset = 0,
                    hasMore = false,
                });
        }

        if (path ==
            $"/api/v1/organizations/{OrganizationId}/corporate-credits/balances")
        {
            return Json(
                HttpStatusCode.OK,
                new[] { new { currency = "TRY", amount = 1200.00 } });
        }

        if (path ==
            $"/api/v1/organizations/{OrganizationId}/corporate-credits/allocations")
        {
            return Json(
                HttpStatusCode.OK,
                new
                {
                    items = new[] { CorporateCreditAllocation() },
                    limit = 20,
                    nextCursor = (string?)null,
                });
        }

        if (path == "/api/v1/corporate-credits/allocations"
            && request.Method == HttpMethod.Post)
        {
            if (RejectNextFundingAllocationWith is { } rejectionStatus)
            {
                RejectNextFundingAllocationWith = null;
                return new HttpResponseMessage(rejectionStatus);
            }

            LastFundingAllocationRequestBody =
                await request.Content!.ReadAsStringAsync(cancellationToken);
            return Json(HttpStatusCode.OK, CorporateCreditAllocation());
        }

        if (path ==
                $"/api/v1/corporate-credits/allocations/{CorporateCreditAllocationId}/reversal"
            && request.Method == HttpMethod.Post)
        {
            if (RejectNextFundingReversalWith is { } rejectionStatus)
            {
                RejectNextFundingReversalWith = null;
                return new HttpResponseMessage(rejectionStatus);
            }

            LastFundingReversalRequestBody =
                await request.Content!.ReadAsStringAsync(cancellationToken);
            return Json(
                HttpStatusCode.OK,
                new
                {
                    id = Guid.Parse("018f5db0-115b-7a69-84a0-991b1cd18d93"),
                    allocationId = CorporateCreditAllocationId,
                    organizationId = OrganizationId,
                    ledgerTransactionId =
                        Guid.Parse("018f5db0-115b-7a69-84a0-991b1cd18d94"),
                    amount = 250.00,
                    currency = "TRY",
                    reason = "Duplicate contract",
                    idempotencyKey = "backend-secret-reversal-key",
                    reversedAtUtc = DateTimeOffset.UtcNow,
                });
        }

        if (path ==
                $"/api/v1/organizations/{OrganizationId}/gift-cards/inventory"
            && request.Method == HttpMethod.Get)
        {
            if (RejectNextGiftCardInventoryWith is { } rejectionStatus)
            {
                RejectNextGiftCardInventoryWith = null;
                return new HttpResponseMessage(rejectionStatus);
            }

            return Json(
                HttpStatusCode.OK,
                new
                {
                    items = new[] { GiftCard() },
                    limit = 20,
                    nextCursor = (string?)null,
                });
        }

        if (path == $"/api/v1/organizations/{OrganizationId}/gift-cards"
            && request.Method == HttpMethod.Post)
        {
            if (RejectNextGiftCardIssuanceWith is { } rejectionStatus)
            {
                RejectNextGiftCardIssuanceWith = null;
                return new HttpResponseMessage(rejectionStatus);
            }

            LastGiftCardIssuanceRequestBody =
                await request.Content!.ReadAsStringAsync(cancellationToken);
            return Json(HttpStatusCode.OK, GiftCard());
        }

        var lifecycleBase =
            $"/api/v1/organizations/{OrganizationId}/gift-cards/{GiftCardId}/lifecycle";
        if (path == $"{lifecycleBase}/history"
            && request.Method == HttpMethod.Get)
        {
            if (RejectNextGiftCardLifecycleHistoryWith is { } rejectionStatus)
            {
                RejectNextGiftCardLifecycleHistoryWith = null;
                return new HttpResponseMessage(rejectionStatus);
            }

            return Json(
                HttpStatusCode.OK,
                new
                {
                    giftCard = GiftCard(),
                    events = new[] { GiftCardLifecycleEvent("suspend") },
                });
        }

        if (path?.StartsWith($"{lifecycleBase}/", StringComparison.Ordinal) == true
            && request.Method == HttpMethod.Post)
        {
            if (RejectNextGiftCardLifecycleWith is { } rejectionStatus)
            {
                RejectNextGiftCardLifecycleWith = null;
                return new HttpResponseMessage(rejectionStatus);
            }

            LastGiftCardLifecycleRequestBody =
                await request.Content!.ReadAsStringAsync(cancellationToken);
            return Json(
                HttpStatusCode.OK,
                new
                {
                    @event = GiftCardLifecycleEvent(
                        path[(path.LastIndexOf('/') + 1)..]),
                });
        }

        var distributionPath =
            $"/api/v1/organizations/{OrganizationId}/gift-cards/{GiftCardId}/distributions";
        if (path == distributionPath && request.Method == HttpMethod.Post)
        {
            if (RejectNextGiftCardDistributionWith is { } rejectionStatus)
            {
                RejectNextGiftCardDistributionWith = null;
                if (RejectNextGiftCardDistributionCode is { } code)
                {
                    RejectNextGiftCardDistributionCode = null;
                    return Json(
                        rejectionStatus,
                        new
                        {
                            type = "https://giftcard.example/problems/conflict",
                            title = "Conflict.",
                            status = (int)rejectionStatus,
                            detail = "A safe backend conflict detail.",
                            code,
                        });
                }

                return new HttpResponseMessage(rejectionStatus);
            }

            LastGiftCardDistributionRequestBody =
                await request.Content!.ReadAsStringAsync(cancellationToken);
            return Json(HttpStatusCode.Created, GiftCardDistribution());
        }

        var batchPath =
            $"/api/v1/organizations/{OrganizationId}/gift-cards/bulk-batches";
        var acceptBatchPath = $"{batchPath}/async";
        if (path == acceptBatchPath && request.Method == HttpMethod.Post)
        {
            if (RejectNextGiftCardBatchWith is { } rejectionStatus)
            {
                RejectNextGiftCardBatchWith = null;
                return new HttpResponseMessage(rejectionStatus);
            }

            LastGiftCardBatchRequestBody =
                await request.Content!.ReadAsStringAsync(cancellationToken);
            return Json(HttpStatusCode.Accepted, GiftCardBatchSummary());
        }

        if (path == $"{batchPath}/{GiftCardBatchId}" &&
            request.Method == HttpMethod.Get)
        {
            if (RejectNextGiftCardBatchReadWith is { } rejectionStatus)
            {
                RejectNextGiftCardBatchReadWith = null;
                return new HttpResponseMessage(rejectionStatus);
            }

            return Json(HttpStatusCode.OK, GiftCardBatchPage());
        }

        if (path == $"{batchPath}/{GiftCardBatchId}/retry" &&
            request.Method == HttpMethod.Post)
        {
            return Json(HttpStatusCode.Accepted, GiftCardBatchSummary(
                GiftCardRetryBatchId,
                retryOfBatchId: GiftCardBatchId));
        }

        if (path ==
            $"/api/v1/organizations/{TenantRootOrganizationId}/reports/financial-summary")
        {
            if (ForbidNextFinancialSummaryRequest)
            {
                ForbidNextFinancialSummaryRequest = false;
                return new HttpResponseMessage(HttpStatusCode.Forbidden);
            }

            return Json(
                HttpStatusCode.OK,
                new
                {
                    organizationId = TenantRootOrganizationId,
                    asOfUtc = new DateTimeOffset(
                        2026,
                        7,
                        29,
                        12,
                        30,
                        0,
                        TimeSpan.Zero),
                    currencies = new[]
                    {
                        new
                        {
                            currency = "TRY",
                            granted = 1000m,
                            reversed = 50m,
                            issued = 250m,
                            distributed = 200m,
                            remainingCorporateCredit = 700m,
                            remainingGiftCardValue = 200m,
                            cancelledReturned = 25m,
                            expiredReturned = 25m,
                        },
                    },
                });
        }

        if (path ==
            $"/api/v1/organizations/{TenantRootOrganizationId}/reports/financial-history")
        {
            return Json(
                HttpStatusCode.OK,
                new
                {
                    items = new[]
                    {
                        new
                        {
                            eventKey = "20260729-allocation-1",
                            category = "CorporateCredit",
                            operation = "Allocated",
                            entityId = Guid.Parse(
                                "018f5da0-115b-7a69-84a0-991b1cd18d91"),
                            giftCardId = (Guid?)null,
                            giftCardPublicReference = (string?)null,
                            businessReference = "FUND-2026-001",
                            amount = 1000m,
                            currency = "TRY",
                            financialDirection = "Credit",
                            state = "Committed",
                            actorUserId = Guid.Parse(
                                "018f5d99-7179-7b25-88d0-a9fc17b6361a"),
                            occurredAtUtc = new DateTimeOffset(
                                2026,
                                7,
                                29,
                                12,
                                0,
                                0,
                                TimeSpan.Zero),
                        },
                    },
                    limit = 10,
                    nextCursor = "opaque+next==",
                });
        }

        if (path ==
            $"/api/v1/organizations/{TenantRootOrganizationId}/reports/reconciliation")
        {
            if (ForbidNextFinancialReconciliationRequest)
            {
                ForbidNextFinancialReconciliationRequest = false;
                return new HttpResponseMessage(HttpStatusCode.Forbidden);
            }

            return Json(
                HttpStatusCode.OK,
                new
                {
                    organizationId = TenantRootOrganizationId,
                    checkedAtUtc = new DateTimeOffset(
                        2026,
                        7,
                        29,
                        12,
                        45,
                        0,
                        TimeSpan.Zero),
                    isConsistent = false,
                    transactionsChecked = 12,
                    giftCardsChecked = 3,
                    sharesChecked = 5,
                    activeReservationsChecked = 2,
                    findings = new[]
                    {
                        new
                        {
                            code = "LEDGER_AMOUNT_MISMATCH",
                            severity = 1,
                            entityType = "CorporateCreditAllocation",
                            entityId = "018f5da0-115b-7a69-84a0-991b1cd18d91",
                            currency = "TRY",
                            expectedAmount = 1000m,
                            actualAmount = 950m,
                            message = "The allocation amount differs from Ledger.",
                        },
                        new
                        {
                            code = "sharing.claimed_without_transfer",
                            severity = 1,
                            entityType = "GiftCardShare",
                            entityId = "018f5da0-2c41-7b7e-9d3f-6a2f0d7c4e15",
                            currency = "TRY",
                            expectedAmount = 20m,
                            actualAmount = 0m,
                            message =
                                "A claimed share has no matching Ledger transfer.",
                        },
                    },
                });
        }

        if (path == "/api/v1/platform/reports/payments")
        {
            if (ForbidNextPaymentReportRequest)
            {
                ForbidNextPaymentReportRequest = false;
                return new HttpResponseMessage(HttpStatusCode.Forbidden);
            }

            var payment = PaymentReportItem();
            return Json(
                HttpStatusCode.OK,
                new
                {
                    items = new[] { payment },
                    limit = 20,
                    nextCursor = "payments+next==",
                    totalMatchingPayments = 1,
                    pageTotals = new[] { PaymentTotals() },
                    matchingTotals = new[] { PaymentTotals() },
                });
        }

        if (path == $"/api/v1/platform/reports/payments/{PaymentProvisionId}")
        {
            return Json(
                HttpStatusCode.OK,
                new
                {
                    payment = PaymentReportItem(),
                    refunds = new[]
                    {
                        new
                        {
                            refundId = RefundId,
                            posTerminalId = PosTerminalId,
                            posTerminalCode = "TERM-07",
                            storeReference = "STORE-101",
                            posTransactionReference = "RECEIPT-9001-R1",
                            reason = "Customer return",
                            amount = 12m,
                            refundLedgerTransactionId = PaymentLedgerId,
                            refundedAtUtc = new DateTimeOffset(
                                2026, 8, 5, 11, 15, 0, TimeSpan.Zero),
                        },
                    },
                });
        }

        if (path ==
            $"/api/v1/organizations/{OrganizationId}/audit-records")
        {
            if (ForbidNextAuditRecordsRequest)
            {
                ForbidNextAuditRecordsRequest = false;
                return new HttpResponseMessage(HttpStatusCode.Forbidden);
            }

            return Json(
                HttpStatusCode.OK,
                new
                {
                    items = new[]
                    {
                        new
                        {
                            id = AuditRecordId,
                            actorUserId = AuditActorUserId,
                            actorType = "OrganizationMember",
                            actorMembershipId = AuditMembershipId,
                            organizationScopeId = OrganizationId,
                            operation = "authorization.denied",
                            entityType = "Permission",
                            entityId = "organization.audit.view",
                            outcome = "Failure",
                            correlationId = AuditCorrelationId,
                            occurredAtUtc = new DateTimeOffset(
                                2026,
                                7,
                                30,
                                8,
                                15,
                                0,
                                TimeSpan.Zero),
                            metadata = new Dictionary<string, string>
                            {
                                ["required_permission"] =
                                    "organization.audit.view",
                                ["reason"] = "Permission check failed",
                            },
                        },
                    },
                    limit = 25,
                    nextCursor = "audit+next==",
                });
        }

        return new HttpResponseMessage(HttpStatusCode.NotFound);
    }

    private static object PaymentReportItem() =>
        new
        {
            paymentProvisionId = PaymentProvisionId,
            fundingOrganizationId = TenantRootOrganizationId,
            giftCardId = GiftCardId,
            giftCardPublicReference = "DEMO-PAY-0042",
            posClientId = PosClientId,
            posClientCode = "POS-NORTH",
            posClientDisplayName = "North Retail POS",
            posTerminalId = PosTerminalId,
            posTerminalCode = "TERM-07",
            storeReference = "STORE-101",
            posTransactionReference = "RECEIPT-9001",
            provisionedAmount = 50m,
            confirmedAmount = 50m,
            refundedAmount = 12m,
            netAmount = 38m,
            currency = "TRY",
            state = "Confirmed",
            isFullyReversed = false,
            refundCount = 1,
            createdAtUtc = new DateTimeOffset(2026, 8, 5, 11, 0, 0, TimeSpan.Zero),
            settledAtUtc = new DateTimeOffset(2026, 8, 5, 11, 1, 0, TimeSpan.Zero),
            redemptionLedgerTransactionId = PaymentLedgerId,
        };

    private static object PaymentTotals() =>
        new
        {
            currency = "TRY",
            paymentCount = 1,
            confirmedPaymentCount = 1,
            refundCount = 1,
            fullyReversedPaymentCount = 0,
            provisionedAmount = 50m,
            confirmedAmount = 50m,
            refundedAmount = 12m,
            netAmount = 38m,
        };

    private static object TokenPair(string accessToken, string refreshToken) =>
        new
        {
            accessToken,
            accessTokenExpiresAtUtc = DateTimeOffset.UtcNow.AddMinutes(15),
            refreshToken,
            refreshTokenExpiresAtUtc = DateTimeOffset.UtcNow.AddDays(7),
        };

    private static object Organization() =>
        new
        {
            id = OrganizationId,
            name = "Test Organization",
            code = "DEMO-TEST",
            status = "Active",
            depth = 0,
            createdAtUtc = DateTimeOffset.UtcNow,
        };

    private static object Subsidiary(string name, string code) =>
        new
        {
            id = Guid.Parse("018f5db0-115b-7a69-84a0-991b1cd18d91"),
            parentOrganizationId = OrganizationId,
            name,
            code,
            status = "Active",
            depth = 1,
            createdAtUtc = DateTimeOffset.UtcNow,
        };

    private static object CorporateCreditAllocation() =>
        new
        {
            id = CorporateCreditAllocationId,
            organizationId = OrganizationId,
            ledgerTransactionId =
                Guid.Parse("018f5db0-115b-7a69-84a0-991b1cd18d95"),
            amount = 250.00,
            currency = "TRY",
            businessReference = "CONTRACT-42",
            idempotencyKey = "backend-secret-allocation-key",
            allocatedByUserId =
                Guid.Parse("018f5db0-115b-7a69-84a0-991b1cd18d96"),
            allocatedAtUtc = DateTimeOffset.UtcNow,
            reversal = (object?)null,
        };

    private static object GiftCard() =>
        new
        {
            id = GiftCardId,
            publicReference = "GC-0123456789ABCDEF0123",
            fundingOrganizationId = TenantRootOrganizationId,
            issuingOrganizationId = OrganizationId,
            ownerOrganizationId = OrganizationId,
            ownerUserId = (Guid?)null,
            ownershipState = "OrganizationInventory",
            lifecycleState = "Active",
            ledgerAccountId =
                Guid.Parse("018f5dc3-a865-7c11-a2a0-8326b3b96f63"),
            issuanceLedgerTransactionId =
                Guid.Parse("018f5dc3-a865-7c11-a2a0-8326b3b96f64"),
            fundedAmount = 150.00,
            currency = "TRY",
            validFromUtc = DateTimeOffset.Parse(
                "2026-08-01T09:00:00Z",
                CultureInfo.InvariantCulture),
            expiresAtUtc = DateTimeOffset.Parse(
                "2027-08-01T09:00:00Z",
                CultureInfo.InvariantCulture),
            isTransferable = true,
            isDivisible = false,
            sourceGiftCardId =
                Guid.Parse("018f5dc3-a865-7c11-a2a0-8326b3b96f65"),
            rootGiftCardId =
                Guid.Parse("018f5dc3-a865-7c11-a2a0-8326b3b96f66"),
            generation = 1,
            distributionInvitationId =
                Guid.Parse("018f5dc3-a865-7c11-a2a0-8326b3b96f67"),
            distributedAtUtc = DateTimeOffset.Parse(
                "2026-08-02T09:00:00Z",
                CultureInfo.InvariantCulture),
            claimedAtUtc = (DateTimeOffset?)null,
            businessReference = "EMPLOYEE-AWARD-42",
            idempotencyKey = "backend-secret-gift-card-key",
            issuedByUserId =
                Guid.Parse("018f5dc3-a865-7c11-a2a0-8326b3b96f68"),
            issuedByMembershipId =
                Guid.Parse("018f5dc3-a865-7c11-a2a0-8326b3b96f69"),
            issuedAtUtc = DateTimeOffset.Parse(
                "2026-08-01T09:00:00Z",
                CultureInfo.InvariantCulture),
        };

    private static object GiftCardLifecycleEvent(string action)
    {
        var (actionName, previousState, newState) = action switch
        {
            "suspend" => ("Suspend", "Active", "Suspended"),
            "reactivate" => ("Reactivate", "Suspended", "Active"),
            "cancel" => ("Cancel", "Active", "Cancelled"),
            "expire" => ("Expire", "Active", "Expired"),
            _ => throw new InvalidOperationException("Unsupported fake lifecycle action."),
        };
        var isTerminal = action is "cancel" or "expire";
        return new
        {
            id = Guid.Parse("018f5dc3-a865-7c11-a2a0-8326b3b96f71"),
            giftCardId = GiftCardId,
            fundingOrganizationId = TenantRootOrganizationId,
            issuingOrganizationId = OrganizationId,
            action = actionName,
            previousState,
            newState,
            actorType = "OrganizationMember",
            actorUserId =
                Guid.Parse("018f5dc3-a865-7c11-a2a0-8326b3b96f72"),
            actorMembershipId =
                Guid.Parse("018f5dc3-a865-7c11-a2a0-8326b3b96f73"),
            correlationId =
                Guid.Parse("018f5dc3-a865-7c11-a2a0-8326b3b96f74"),
            reason = "Card reported missing",
            idempotencyKey = "backend-secret-lifecycle-key",
            ledgerTransactionId = isTerminal
                ? Guid.Parse("018f5dc3-a865-7c11-a2a0-8326b3b96f75")
                : (Guid?)null,
            returnedAmount = isTerminal ? 150.00 : (double?)null,
            currency = isTerminal ? "TRY" : null,
            occurredAtUtc = DateTimeOffset.Parse(
                "2026-08-03T09:00:00Z",
                CultureInfo.InvariantCulture),
        };
    }

    private static object GiftCardDistribution() =>
        new
        {
            id = Guid.Parse("018f5dc3-a865-7c11-a2a0-8326b3b96f81"),
            fundingOrganizationId = TenantRootOrganizationId,
            issuingOrganizationId = OrganizationId,
            giftCardId = GiftCardId,
            contactType = "Email",
            maskedRecipientContact = "r***@example.com",
            state = "Pending",
            claimExpiresAtUtc = DateTimeOffset.Parse(
                "2026-08-04T09:00:00Z",
                CultureInfo.InvariantCulture),
            failedClaimAttempts = 0,
            businessReference = "EMPLOYEE-DELIVERY-42",
            idempotencyKey = "backend-secret-distribution-key",
            distributedByUserId =
                Guid.Parse("018f5dc3-a865-7c11-a2a0-8326b3b96f82"),
            distributedByMembershipId =
                Guid.Parse("018f5dc3-a865-7c11-a2a0-8326b3b96f83"),
            distributedAtUtc = DateTimeOffset.Parse(
                "2026-08-03T09:00:00Z",
                CultureInfo.InvariantCulture),
            claimedByUserId = (Guid?)null,
            claimedAtUtc = (DateTimeOffset?)null,
        };

    private static object GiftCardBatchSummary(
        Guid? id = null,
        Guid? retryOfBatchId = null) =>
        new
        {
            id = id ?? GiftCardBatchId,
            fundingOrganizationId = TenantRootOrganizationId,
            issuingOrganizationId = OrganizationId,
            batchReference = "BENEFITS-2026-08",
            status = "Pending",
            totalItems = retryOfBatchId.HasValue ? 1 : 2,
            succeededItems = 0,
            failedItems = 0,
            createdAtUtc = DateTimeOffset.Parse(
                "2026-08-03T09:00:00Z",
                CultureInfo.InvariantCulture),
            completedAtUtc = (DateTimeOffset?)null,
            retryOfBatchId,
        };

    private static object GiftCardBatchPage() =>
        new
        {
            id = GiftCardBatchId,
            fundingOrganizationId = TenantRootOrganizationId,
            issuingOrganizationId = OrganizationId,
            batchReference = "BENEFITS-2026-08",
            status = "Completed",
            totalItems = 2,
            succeededItems = 1,
            failedItems = 1,
            createdByUserId =
                Guid.Parse("018f5dc3-a865-7c11-a2a0-8326b3b96f84"),
            createdByMembershipId =
                Guid.Parse("018f5dc3-a865-7c11-a2a0-8326b3b96f85"),
            createdAtUtc = DateTimeOffset.Parse(
                "2026-08-03T09:00:00Z",
                CultureInfo.InvariantCulture),
            completedAtUtc = DateTimeOffset.Parse(
                "2026-08-03T09:00:01Z",
                CultureInfo.InvariantCulture),
            retryOfBatchId = (Guid?)null,
            limit = 200,
            nextCursor = "opaque+next==",
            items = new[]
            {
                new
                {
                    position = 1,
                    itemReference = "BENEFIT-001",
                    status = "Succeeded",
                    giftCardId = (Guid?)Guid.Parse(
                        "018f5dc3-a865-7c11-a2a0-8326b3b96f86"),
                    giftCardPublicReference = (string?)"GC-BATCH000000000000001",
                    invitationId = (Guid?)Guid.Parse(
                        "018f5dc3-a865-7c11-a2a0-8326b3b96f87"),
                    contactType = "Email",
                    maskedRecipientContact = "a***@example.com",
                    amount = 100.00,
                    currency = "TRY",
                    giftCardState = (string?)"AwaitingClaim",
                    invitationState = (string?)"Pending",
                    distributedAtUtc = (DateTimeOffset?)DateTimeOffset.Parse(
                        "2026-08-03T09:00:00Z",
                        CultureInfo.InvariantCulture),
                    failureCode = (string?)null,
                    failureMessage = (string?)null,
                    settledAtUtc = DateTimeOffset.Parse(
                        "2026-08-03T09:00:00Z",
                        CultureInfo.InvariantCulture),
                },
                new
                {
                    position = 2,
                    itemReference = "BENEFIT-002",
                    status = "Failed",
                    giftCardId = (Guid?)null,
                    giftCardPublicReference = (string?)null,
                    invitationId = (Guid?)null,
                    contactType = "Phone",
                    maskedRecipientContact = "+90***4567",
                    amount = 75.00,
                    currency = "TRY",
                    giftCardState = (string?)null,
                    invitationState = (string?)null,
                    distributedAtUtc = (DateTimeOffset?)null,
                    failureCode = (string?)"insufficient_corporate_credit",
                    failureMessage = (string?)"Corporate credit is no longer sufficient for this row.",
                    settledAtUtc = DateTimeOffset.Parse(
                        "2026-08-03T09:00:00Z",
                        CultureInfo.InvariantCulture),
                },
            },
        };

    private static object TeamMember(
        Guid? membershipId = null,
        Guid? userId = null,
        string email = "operator@example.test",
        string status = "Active",
        DateTimeOffset? disabledAtUtc = null) =>
        new
        {
            id = membershipId ?? TeamMembershipId,
            organizationId = OrganizationId,
            userId = userId ?? TeamUserId,
            email,
            status,
            createdAtUtc = DateTimeOffset.Parse(
                "2026-07-31T09:00:00Z",
                CultureInfo.InvariantCulture),
            disabledAtUtc,
        };

    private static object Role() =>
        new
        {
            id = RoleId,
            organizationId = OrganizationId,
            name = "Gift card operator",
            permissions = new[]
            {
                "organization.gift_cards.view",
                "organization.gift_cards.issue",
            },
            createdAtUtc = DateTimeOffset.Parse(
                "2026-07-31T09:05:00Z",
                CultureInfo.InvariantCulture),
        };

    private static object RoleAssignment() =>
        new
        {
            id = Guid.Parse("018f5dc3-a865-7c11-a2a0-8326b3b96fb3"),
            organizationId = OrganizationId,
            membershipId = TeamMembershipId,
            roleId = RoleId,
            scope = "Organization",
            anchorOrganizationId = OrganizationId,
            selectedOrganizationIds = (Guid[]?)null,
            createdAtUtc = DateTimeOffset.Parse(
                "2026-07-31T09:10:00Z",
                CultureInfo.InvariantCulture),
        };

    private static HttpResponseMessage Json(HttpStatusCode status, object body) =>
        new(status)
        {
            Content = new StringContent(
                JsonSerializer.Serialize(body),
                Encoding.UTF8,
                "application/json"),
        };

    private static HttpRequestMessage Clone(HttpRequestMessage request)
    {
        var clone = new HttpRequestMessage(request.Method, request.RequestUri);
        foreach (var header in request.Headers)
        {
            clone.Headers.TryAddWithoutValidation(header.Key, header.Value);
        }

        return clone;
    }
}
