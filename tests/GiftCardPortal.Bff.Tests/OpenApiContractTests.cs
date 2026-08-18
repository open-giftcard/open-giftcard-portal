using System.Text.Json;

namespace GiftCardPortal.Bff.Tests;

public sealed class OpenApiContractTests
{
    private readonly JsonDocument _document = JsonDocument.Parse(
        File.ReadAllText(
            Path.Combine(
                AppContext.BaseDirectory,
                "contracts",
                "backend.openapi.json")));

    [Fact]
    public void SnapshotContainsRequiredPortalOperations()
    {
        var paths = _document.RootElement.GetProperty("paths");

        AssertOperation(paths, "/api/v1/auth/login", "post", "Login");
        AssertOperation(paths, "/api/v1/auth/refresh", "post", "RefreshSession");
        AssertOperation(paths, "/api/v1/auth/revoke", "post", "RevokeSession");
        AssertOperation(paths, "/api/v1/me", "get", "GetCurrentUser");
        AssertOperation(
            paths,
            "/api/v1/me/organizations",
            "get",
            "ListCurrentUserOrganizations");
        AssertOperation(
            paths,
            "/api/v1/organizations",
            "get",
            "ListPlatformOrganizations");
        AssertOperation(
            paths,
            "/api/v1/organizations/{id}",
            "get",
            "GetOrganization");
        AssertOperation(
            paths,
            "/api/v1/organizations/{organizationId}/subsidiaries",
            "get",
            "ListSubsidiaries");
        AssertOperation(
            paths,
            "/api/v1/organizations/{organizationId}/subsidiaries",
            "post",
            "CreateSubsidiary");
        AssertOperation(
            paths,
            "/api/v1/organizations/{organizationId}/memberships",
            "get",
            "ListMemberships");
        AssertOperation(
            paths,
            "/api/v1/organizations/{organizationId}/memberships",
            "post",
            "CreateMembership");
        AssertOperation(
            paths,
            "/api/v1/organizations/{organizationId}/memberships/{membershipId}/disable",
            "post",
            "DisableMembership");
        AssertOperation(
            paths,
            "/api/v1/organizations/{organizationId}/roles",
            "get",
            "ListRoles");
        AssertOperation(
            paths,
            "/api/v1/organizations/{organizationId}/roles",
            "post",
            "CreateRole");
        AssertOperation(
            paths,
            "/api/v1/organizations/{organizationId}/roles/{roleId}/permissions",
            "post",
            "GrantRolePermissions");
        AssertOperation(
            paths,
            "/api/v1/organizations/{organizationId}/roles/assignments",
            "get",
            "ListRoleAssignments");
        AssertOperation(
            paths,
            "/api/v1/organizations/{organizationId}/roles/assignments",
            "post",
            "AssignRole");
        AssertOperation(
            paths,
            "/api/v1/corporate-credits/allocations",
            "post",
            "AllocateCorporateCredit");
        AssertOperation(
            paths,
            "/api/v1/corporate-credits/allocations/{allocationId}/reversal",
            "post",
            "ReverseCorporateCredit");
        AssertOperation(
            paths,
            "/api/v1/organizations/{organizationId}/corporate-credits/balances",
            "get",
            "GetCorporateCreditBalances");
        AssertOperation(
            paths,
            "/api/v1/organizations/{organizationId}/corporate-credits/allocations",
            "get",
            "GetCorporateCreditAllocationHistory");
        AssertOperation(
            paths,
            "/api/v1/organizations/{organizationId}/gift-cards",
            "post",
            "IssueGiftCard");
        AssertOperation(
            paths,
            "/api/v1/organizations/{organizationId}/gift-cards/inventory",
            "get",
            "GetGiftCardInventory");
        AssertOperation(
            paths,
            "/api/v1/organizations/{organizationId}/gift-cards/{giftCardId}/lifecycle/history",
            "get",
            "GetOrganizationGiftCardLifecycleHistory");
        AssertOperation(
            paths,
            "/api/v1/organizations/{organizationId}/gift-cards/{giftCardId}/lifecycle/suspend",
            "post",
            "SuspendOrganizationGiftCard");
        AssertOperation(
            paths,
            "/api/v1/organizations/{organizationId}/gift-cards/{giftCardId}/lifecycle/reactivate",
            "post",
            "ReactivateOrganizationGiftCard");
        AssertOperation(
            paths,
            "/api/v1/organizations/{organizationId}/gift-cards/{giftCardId}/lifecycle/cancel",
            "post",
            "CancelOrganizationGiftCard");
        AssertOperation(
            paths,
            "/api/v1/organizations/{organizationId}/gift-cards/{giftCardId}/lifecycle/expire",
            "post",
            "ExpireOrganizationGiftCard");
        AssertOperation(
            paths,
            "/api/v1/organizations/{organizationId}/gift-cards/{giftCardId}/distributions",
            "post",
            "DistributeGiftCard");
        AssertOperation(
            paths,
            "/api/v1/organizations/{organizationId}/gift-card-batches",
            "post",
            "CreateBulkGiftCardBatch");
        AssertOperation(
            paths,
            "/api/v1/organizations/{organizationId}/gift-card-batches/{batchId}",
            "get",
            "GetBulkGiftCardBatch");
        AssertOperation(
            paths,
            "/api/v1/organizations/{organizationId}/gift-cards/bulk-batches/async",
            "post",
            "AcceptAsyncBulkGiftCardBatch");
        AssertOperation(
            paths,
            "/api/v1/organizations/{organizationId}/gift-cards/bulk-batches/{batchId}",
            "get",
            "GetAsyncBulkGiftCardBatch");
        AssertOperation(
            paths,
            "/api/v1/organizations/{organizationId}/gift-cards/bulk-batches/{batchId}/retry",
            "post",
            "RetryAsyncBulkGiftCardBatch");
        AssertOperation(
            paths,
            "/api/v1/organizations/{organizationId}/reports/financial-summary",
            "get",
            "GetOrganizationFinancialSummary");
        AssertOperation(
            paths,
            "/api/v1/organizations/{organizationId}/reports/financial-history",
            "get",
            "GetOrganizationFinancialHistory");
        AssertOperation(
            paths,
            "/api/v1/organizations/{organizationId}/reports/reconciliation",
            "get",
            "ReconcileOrganizationFinancials");
        AssertOperation(
            paths,
            "/api/v1/platform/reports/payments",
            "get",
            "GetPosPaymentReport");
        AssertOperation(
            paths,
            "/api/v1/platform/reports/payments/{paymentProvisionId}",
            "get",
            "GetPosPaymentReceiptReport");
    }

    [Fact]
    public void LoginContractCarriesEmailPasswordAndOptionalPhone()
    {
        var schema = _document.RootElement
            .GetProperty("components")
            .GetProperty("schemas")
            .GetProperty("LoginApiRequest");
        var properties = schema.GetProperty("properties");

        Assert.True(properties.TryGetProperty("email", out _));
        Assert.True(properties.TryGetProperty("password", out _));
        Assert.True(properties.TryGetProperty("phoneNumber", out var phone));
        Assert.True(phone.GetProperty("nullable").GetBoolean());
    }

    [Fact]
    public void OrganizationDiscoveryIsPagedAndBearerProtected()
    {
        var operation = _document.RootElement
            .GetProperty("paths")
            .GetProperty("/api/v1/me/organizations")
            .GetProperty("get");
        var parameters = operation.GetProperty("parameters")
            .EnumerateArray()
            .Select(parameter => parameter.GetProperty("name").GetString()!)
            .ToArray();

        Assert.Contains("limit", parameters);
        Assert.Contains("offset", parameters);
        Assert.DoesNotContain("X-Organization-Id", parameters);
        var security = _document.RootElement.GetProperty("security");
        Assert.NotEmpty(security.EnumerateArray());
        var schemes = _document.RootElement
            .GetProperty("components")
            .GetProperty("securitySchemes");
        Assert.True(schemes.TryGetProperty("Bearer", out _));
    }

    [Fact]
    public void PlatformDirectorySupportsDocumentedSearchFiltersAndPaging()
    {
        var operation = _document.RootElement
            .GetProperty("paths")
            .GetProperty("/api/v1/organizations")
            .GetProperty("get");
        var parameters = operation.GetProperty("parameters")
            .EnumerateArray()
            .Select(parameter => parameter.GetProperty("name").GetString()!)
            .ToArray();

        Assert.Equal(
            ["search", "status", "limit", "offset"],
            parameters);
        Assert.DoesNotContain("X-Organization-Id", parameters);
    }

    [Fact]
    public void SubsidiariesUseOnlyParentPathPagingAndSafeCreateFields()
    {
        var path = _document.RootElement
            .GetProperty("paths")
            .GetProperty("/api/v1/organizations/{organizationId}/subsidiaries");
        var listParameters = path.GetProperty("get")
            .GetProperty("parameters")
            .EnumerateArray()
            .Select(parameter => parameter.GetProperty("name").GetString()!)
            .ToArray();
        var createSchema = _document.RootElement
            .GetProperty("components")
            .GetProperty("schemas")
            .GetProperty("CreateSubsidiaryApiRequest")
            .GetProperty("properties");

        Assert.Equal(["organizationId", "limit", "offset"], listParameters);
        Assert.Equal(
            ["name", "code"],
            createSchema.EnumerateObject().Select(property => property.Name));
    }

    [Fact]
    public void TeamContractSupportsEmailLookupAndReadableAssignments()
    {
        var schemas = _document.RootElement
            .GetProperty("components")
            .GetProperty("schemas");
        var createMembership = schemas
            .GetProperty("CreateMembershipApiRequest")
            .GetProperty("properties");
        var membership = schemas
            .GetProperty("MembershipApiResponse")
            .GetProperty("properties");
        var assignmentPath = _document.RootElement
            .GetProperty("paths")
            .GetProperty("/api/v1/organizations/{organizationId}/roles/assignments");

        Assert.Equal(
            ["userId", "email"],
            createMembership.EnumerateObject().Select(property => property.Name));
        Assert.True(createMembership.GetProperty("userId").GetProperty("nullable").GetBoolean());
        Assert.True(createMembership.GetProperty("email").GetProperty("nullable").GetBoolean());
        Assert.True(membership.TryGetProperty("email", out var email));
        Assert.True(email.GetProperty("nullable").GetBoolean());
        Assert.True(assignmentPath.TryGetProperty("get", out _));
        Assert.True(assignmentPath.TryGetProperty("post", out _));
    }

    [Fact]
    public void FinancialHistoryExposesTheAcceptedAuthoritativeSearchInputs()
    {
        var operation = _document.RootElement
            .GetProperty("paths")
            .GetProperty(
                "/api/v1/organizations/{organizationId}/reports/financial-history")
            .GetProperty("get");
        var parameters = operation.GetProperty("parameters")
            .EnumerateArray()
            .Select(parameter => parameter.GetProperty("name").GetString()!)
            .ToArray();

        Assert.Equal(
            [
                "organizationId",
                "limit",
                "cursor",
                "category",
                "operation",
                "currency",
                "reference",
                "occurredFromUtc",
                "occurredBeforeUtc",
            ],
            parameters);
    }

    [Fact]
    public void AuditInvestigationExposesOnlyTheAcceptedExactFiltersAndPaging()
    {
        var operation = _document.RootElement
            .GetProperty("paths")
            .GetProperty("/api/v1/organizations/{organizationId}/audit-records")
            .GetProperty("get");
        var parameters = operation
            .GetProperty("parameters")
            .EnumerateArray()
            .Select(parameter => parameter.GetProperty("name").GetString()!)
            .ToArray();

        Assert.Equal(
            [
                "organizationId",
                "limit",
                "cursor",
                "operation",
                "outcome",
                "correlationId",
            ],
            parameters);
        Assert.Equal(
            [1, 2],
            _document.RootElement
                .GetProperty("components")
                .GetProperty("schemas")
                .GetProperty("AuditOutcome")
                .GetProperty("enum")
                .EnumerateArray()
                .Select(value => value.GetInt32()));
        // PartnerClient = 6 arrived with the partners module; the previous pin
        // predated it, so this assertion silently described a stale backend.
        Assert.Equal(
            [1, 2, 3, 4, 5, 6],
            _document.RootElement
                .GetProperty("components")
                .GetProperty("schemas")
                .GetProperty("AuditActorType")
                .GetProperty("enum")
                .EnumerateArray()
                .Select(value => value.GetInt32()));
    }

    [Fact]
    public void GiftCardInventoryAndIssuanceUseTheDocumentedInputs()
    {
        var inventory = _document.RootElement
            .GetProperty("paths")
            .GetProperty(
                "/api/v1/organizations/{organizationId}/gift-cards/inventory")
            .GetProperty("get");
        var inventoryParameters = inventory.GetProperty("parameters")
            .EnumerateArray()
            .Select(parameter => parameter.GetProperty("name").GetString()!)
            .ToArray();
        var issuanceProperties = _document.RootElement
            .GetProperty("components")
            .GetProperty("schemas")
            .GetProperty("IssueGiftCardApiRequest")
            .GetProperty("properties")
            .EnumerateObject()
            .Select(property => property.Name)
            .ToArray();

        Assert.Equal(["organizationId", "limit", "cursor"], inventoryParameters);
        Assert.Equal(
            [
                "amount",
                "currency",
                "validFromUtc",
                "expiresAtUtc",
                "isTransferable",
                "isDivisible",
                "businessReference",
                "idempotencyKey",
            ],
            issuanceProperties);
    }

    [Fact]
    public void GiftCardLifecycleUsesTheDocumentedAdministrativeIntentAndHistory()
    {
        var paths = _document.RootElement.GetProperty("paths");
        var historyParameters = paths
            .GetProperty(
                "/api/v1/organizations/{organizationId}/gift-cards/{giftCardId}/lifecycle/history")
            .GetProperty("get")
            .GetProperty("parameters")
            .EnumerateArray()
            .Select(parameter => parameter.GetProperty("name").GetString()!)
            .ToArray();
        var commandProperties = _document.RootElement
            .GetProperty("components")
            .GetProperty("schemas")
            .GetProperty("GiftCardLifecycleCommandApiRequest")
            .GetProperty("properties")
            .EnumerateObject()
            .Select(property => property.Name)
            .ToArray();

        Assert.Equal(["organizationId", "giftCardId"], historyParameters);
        Assert.Equal(["reason", "idempotencyKey"], commandProperties);
    }

    [Fact]
    public void DistributionAndBulkUseTheDocumentedRecipientAndAsyncBatchShapes()
    {
        var schemas = _document.RootElement
            .GetProperty("components")
            .GetProperty("schemas");
        var distributionProperties = schemas
            .GetProperty("DistributeGiftCardApiRequest")
            .GetProperty("properties")
            .EnumerateObject()
            .Select(property => property.Name)
            .ToArray();
        var batchProperties = schemas
            .GetProperty("CreateBulkGiftCardBatchApiRequest")
            .GetProperty("properties")
            .EnumerateObject()
            .Select(property => property.Name)
            .ToArray();
        var itemProperties = schemas
            .GetProperty("BulkGiftCardBatchItemApiRequest")
            .GetProperty("properties")
            .EnumerateObject()
            .Select(property => property.Name)
            .ToArray();
        var contactTypes = schemas
            .GetProperty("RecipientContactType")
            .GetProperty("enum")
            .EnumerateArray()
            .Select(value => value.GetInt32())
            .ToArray();
        var outcomeProperties = schemas
            .GetProperty("BulkGiftCardBatchItemResult")
            .GetProperty("properties")
            .EnumerateObject()
            .Select(property => property.Name)
            .ToArray();
        var pageProperties = schemas
            .GetProperty("BulkGiftCardBatchPage")
            .GetProperty("properties")
            .EnumerateObject()
            .Select(property => property.Name)
            .ToArray();

        Assert.Equal(
            ["contactType", "recipientContact", "businessReference", "idempotencyKey"],
            distributionProperties);
        Assert.Equal(["batchReference", "idempotencyKey", "items"], batchProperties);
        Assert.Equal(
            [
                "itemReference",
                "amount",
                "currency",
                "validFromUtc",
                "expiresAtUtc",
                "isTransferable",
                "isDivisible",
                "contactType",
                "recipientContact",
            ],
            itemProperties);
        Assert.Equal([1, 2], contactTypes);
        Assert.Contains("status", outcomeProperties);
        Assert.Contains("failureCode", outcomeProperties);
        Assert.Contains("failureMessage", outcomeProperties);
        Assert.Contains("settledAtUtc", outcomeProperties);
        Assert.Contains("succeededItems", pageProperties);
        Assert.Contains("failedItems", pageProperties);
        Assert.Contains("nextCursor", pageProperties);
        Assert.Contains("retryOfBatchId", pageProperties);
    }

    [Fact]
    public void ReconciliationIsReadOnlyAndUsesTheDocumentedSeverities()
    {
        var operation = _document.RootElement
            .GetProperty("paths")
            .GetProperty(
                "/api/v1/organizations/{organizationId}/reports/reconciliation")
            .GetProperty("get");
        var parameters = operation.GetProperty("parameters")
            .EnumerateArray()
            .Select(parameter => parameter.GetProperty("name").GetString()!)
            .ToArray();
        var severities = _document.RootElement
            .GetProperty("components")
            .GetProperty("schemas")
            .GetProperty("ReconciliationSeverity")
            .GetProperty("enum")
            .EnumerateArray()
            .Select(value => value.GetInt32())
            .ToArray();

        Assert.Equal(["organizationId"], parameters);
        Assert.Equal([1, 2], severities);
    }

    [Fact]
    public void ReconciliationResultCountsSharesAndActiveReservations()
    {
        var properties = _document.RootElement
            .GetProperty("components")
            .GetProperty("schemas")
            .GetProperty("OrganizationReconciliationResult")
            .GetProperty("properties")
            .EnumerateObject()
            .Select(property => property.Name)
            .ToArray();

        Assert.Contains("sharesChecked", properties);
        Assert.Contains("activeReservationsChecked", properties);
    }

    private static void AssertOperation(
        JsonElement paths,
        string path,
        string method,
        string operationId)
    {
        var operation = paths.GetProperty(path).GetProperty(method);
        Assert.Equal(operationId, operation.GetProperty("operationId").GetString());
    }
}
