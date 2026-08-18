using System.Globalization;
using System.Text.Json;
using GiftCardPortal.Bff.Backend;
using GiftCardPortal.Bff.Contracts;
using GiftCardPortal.Bff.Errors;
using GiftCardPortal.Bff.Sessions;
using Microsoft.AspNetCore.Antiforgery;

namespace GiftCardPortal.Bff.Endpoints;

public static class PortalEndpoints
{
    private static readonly Dictionary<string, string>
        FinancialHistoryCategories =
            new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
            {
                ["CorporateCredit"] = "CorporateCredit",
                ["GiftCard"] = "GiftCard",
                ["Distribution"] = "Distribution",
                ["Lifecycle"] = "Lifecycle",
            };

    private static readonly Dictionary<string, string> PaymentStates =
        new(StringComparer.OrdinalIgnoreCase)
        {
            ["Active"] = "Active",
            ["Confirmed"] = "Confirmed",
            ["Cancelled"] = "Cancelled",
            ["Expired"] = "Expired",
        };

    public static IEndpointRouteBuilder MapPortalEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/bff");

        group.MapGet("/antiforgery", (HttpContext context, IAntiforgery antiforgery) =>
        {
            var tokens = antiforgery.GetAndStoreTokens(context);
            return Results.Ok(new { token = tokens.RequestToken });
        });

        group.MapPost("/auth/login", LoginAsync);
        group.MapPost("/auth/logout", LogoutAsync);
        group.MapGet("/session", GetSessionAsync);
        group.MapGet("/organizations", GetOrganizationsAsync);
        group.MapGet("/platform/organizations", GetPlatformOrganizationsAsync);
        group.MapGet("/platform/payments", GetPlatformPaymentsAsync);
        group.MapGet(
            "/platform/payments/{paymentProvisionId:guid}",
            GetPlatformPaymentReceiptAsync);
        group.MapGet(
            "/platform/organizations/{organizationId:guid}",
            GetPlatformOrganizationAsync);
        group.MapGet(
            "/platform/organizations/{organizationId:guid}/funding/balances",
            GetPlatformFundingBalancesAsync);
        group.MapGet(
            "/platform/organizations/{organizationId:guid}/funding/allocations",
            GetPlatformFundingHistoryAsync);
        group.MapPost(
            "/platform/organizations/{organizationId:guid}/funding/allocations",
            AllocatePlatformFundingAsync);
        group.MapPost(
            "/platform/funding/allocations/{allocationId:guid}/reversal",
            ReversePlatformFundingAsync);
        group.MapGet(
            "/platform/organizations/{organizationId:guid}/team",
            GetPlatformTeamAsync);
        group.MapGet("/organization/subsidiaries", GetSubsidiariesAsync);
        group.MapPost("/organization/subsidiaries", CreateSubsidiaryAsync);
        group.MapGet("/organization/team", GetOrganizationTeamAsync);
        group.MapPost("/organization/team", AddOrganizationTeamMemberAsync);
        group.MapPost(
            "/organization/team/{membershipId:guid}/disable",
            DisableOrganizationTeamMemberAsync);
        group.MapGet("/organization/roles", GetOrganizationRolesAsync);
        group.MapPost("/organization/roles", CreateOrganizationRoleAsync);
        group.MapPost(
            "/organization/roles/{roleId:guid}/permissions",
            GrantOrganizationRolePermissionsAsync);
        group.MapGet(
            "/organization/role-assignments",
            GetOrganizationRoleAssignmentsAsync);
        group.MapPost(
            "/organization/role-assignments",
            AssignOrganizationRoleAsync);
        group.MapGet("/gift-cards/inventory", GetGiftCardInventoryAsync);
        group.MapPost("/gift-cards", IssueGiftCardAsync);
        group.MapGet(
            "/gift-cards/{giftCardId:guid}/lifecycle",
            GetGiftCardLifecycleAsync);
        group.MapPost(
            "/gift-cards/{giftCardId:guid}/lifecycle/{action}",
            RunGiftCardLifecycleAsync);
        group.MapPost(
            "/gift-cards/{giftCardId:guid}/distribution",
            DistributeGiftCardAsync);
        group.MapPost("/gift-card-batches", CreateBulkGiftCardBatchAsync);
        group.MapGet(
            "/gift-card-batches/{batchId:guid}",
            GetBulkGiftCardBatchAsync);
        group.MapPost(
            "/gift-card-batches/{batchId:guid}/retry",
            RetryBulkGiftCardBatchAsync);
        group.MapGet("/finance/summary", GetFinancialSummaryAsync);
        group.MapGet("/finance/history", GetFinancialHistoryAsync);
        group.MapGet("/finance/reconciliation", GetFinancialReconciliationAsync);
        group.MapGet("/gift-cards/register", GetCardRegisterAsync);
        group.MapGet("/organization/audit-records", GetOrganizationAuditRecordsAsync);
        group.MapGet(
            "/platform/organizations/{organizationId:guid}/audit-records",
            GetPlatformAuditRecordsAsync);
        group.MapPost("/organization-context", SelectOrganizationAsync);
        group.MapDelete("/organization-context", ClearOrganizationAsync);

        return endpoints;
    }

    private static async Task<IResult> LoginAsync(
        LoginRequest request,
        HttpContext context,
        BackendGateway backend,
        PortalSessionManager sessions,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Email)
            || string.IsNullOrWhiteSpace(request.Password))
        {
            return Results.Problem(
                statusCode: StatusCodes.Status400BadRequest,
                title: "Enter your email and password.",
                type: "https://giftcard.example/problems/invalid-login-request");
        }

        PortalSession? session = null;
        try
        {
            var tokenPair = await backend.LoginAsync(
                request.Email.Trim(),
                request.Password,
                context.Connection.RemoteIpAddress,
                cancellationToken);
            session = await sessions.CreateAsync(context, tokenPair, cancellationToken);
            var (_, user) = await backend.GetCurrentUserAsync(
                session,
                null,
                cancellationToken);
            return Results.Ok(user.ToPortalResponse());
        }
        catch (ApiException exception) when (
            exception.StatusCode is StatusCodes.Status400BadRequest
                or StatusCodes.Status401Unauthorized)
        {
            await sessions.DeleteAsync(context, session, cancellationToken);
            return Results.Problem(
                statusCode: StatusCodes.Status401Unauthorized,
                title: "The email or password is incorrect.",
                type: "https://giftcard.example/problems/invalid-credentials");
        }
        catch (ApiException exception) when (
            exception.StatusCode == StatusCodes.Status429TooManyRequests)
        {
            await sessions.DeleteAsync(context, session, cancellationToken);
            return Results.Problem(
                statusCode: StatusCodes.Status429TooManyRequests,
                title: "Too many sign-in attempts. Try again later.",
                type: "https://giftcard.example/problems/login-rate-limited");
        }
        catch
        {
            await sessions.DeleteAsync(context, session, cancellationToken);
            throw;
        }
    }

    private static async Task<IResult> LogoutAsync(
        HttpContext context,
        BackendGateway backend,
        PortalSessionManager sessions,
        CancellationToken cancellationToken)
    {
        var session = await sessions.FindAsync(context, cancellationToken);
        try
        {
            if (session is not null)
            {
                await backend.RevokeBestEffortAsync(session, cancellationToken);
            }
        }
        finally
        {
            await sessions.DeleteAsync(context, session, cancellationToken);
        }

        return Results.NoContent();
    }

    private static async Task<IResult> GetSessionAsync(
        HttpContext context,
        BackendGateway backend,
        PortalSessionManager sessions,
        CancellationToken cancellationToken)
    {
        var session = await RequireSessionAsync(context, sessions, cancellationToken);
        try
        {
            var (refreshedSession, user) = await backend.GetCurrentUserAsync(
                session,
                session.SelectedOrganizationId,
                cancellationToken);
            if (session.SelectedOrganizationId is not null
                && user.OrganizationContext?.Organization.Id
                    == session.SelectedOrganizationId
                && refreshedSession.SelectedTenantRootOrganizationId
                    != user.OrganizationContext.TenantRootOrganizationId)
            {
                await sessions.SetOrganizationAsync(
                    refreshedSession,
                    session.SelectedOrganizationId,
                    user.OrganizationContext.TenantRootOrganizationId,
                    cancellationToken);
            }

            return Results.Ok(user.ToPortalResponse());
        }
        catch (ApiException exception) when (
            session.SelectedOrganizationId is not null
            && exception.StatusCode is StatusCodes.Status400BadRequest
                or StatusCodes.Status404NotFound)
        {
            session = await sessions.SetOrganizationAsync(
                session,
                null,
                null,
                cancellationToken);
            var (_, user) = await backend.GetCurrentUserAsync(
                session,
                null,
                cancellationToken);
            return Results.Ok(user.ToPortalResponse(contextWasCleared: true));
        }
        catch (ApiException exception) when (
            exception.StatusCode == StatusCodes.Status403Forbidden)
        {
            throw Forbidden();
        }
    }

    private static async Task<IResult> GetOrganizationsAsync(
        HttpContext context,
        BackendGateway backend,
        PortalSessionManager sessions,
        CancellationToken cancellationToken)
    {
        var session = await RequireSessionAsync(context, sessions, cancellationToken);
        try
        {
            var (_, organizations) = await backend.GetOrganizationsAsync(
                session,
                cancellationToken);
            return Results.Ok(organizations.ToPortalResponse());
        }
        catch (ApiException exception) when (
            exception.StatusCode == StatusCodes.Status403Forbidden)
        {
            throw Forbidden();
        }
    }

    private static async Task<IResult> SelectOrganizationAsync(
        SelectOrganizationRequest request,
        HttpContext context,
        BackendGateway backend,
        PortalSessionManager sessions,
        CancellationToken cancellationToken)
    {
        var session = await RequireSessionAsync(context, sessions, cancellationToken);

        try
        {
            var (refreshedSession, organizations) = await backend.GetOrganizationsAsync(
                session,
                cancellationToken);
            if (!(organizations.Items ?? [])
                .Any(item => item.Organization.Id == request.OrganizationId))
            {
                return Results.Problem(
                    statusCode: StatusCodes.Status400BadRequest,
                    title: "Choose an organization from the available list.",
                    type: "https://giftcard.example/problems/invalid-organization-selection");
            }

            var (verifiedSession, user) = await backend.GetCurrentUserAsync(
                refreshedSession,
                request.OrganizationId,
                cancellationToken);
            if (user.OrganizationContext?.Organization.Id != request.OrganizationId)
            {
                throw new InvalidOperationException(
                    "The backend returned a different organization context.");
            }

            await sessions.SetOrganizationAsync(
                verifiedSession,
                request.OrganizationId,
                user.OrganizationContext.TenantRootOrganizationId,
                cancellationToken);
            return Results.Ok(user.ToPortalResponse());
        }
        catch (ApiException exception) when (
            exception.StatusCode is StatusCodes.Status400BadRequest
                or StatusCodes.Status404NotFound)
        {
            await sessions.SetOrganizationAsync(session, null, null, cancellationToken);
            return Results.Problem(
                statusCode: StatusCodes.Status400BadRequest,
                title: "That organization is no longer available.",
                type: "https://giftcard.example/problems/invalid-organization-selection");
        }
        catch (ApiException exception) when (
            exception.StatusCode == StatusCodes.Status403Forbidden)
        {
            throw Forbidden();
        }
    }

    private static async Task<IResult> GetPlatformOrganizationsAsync(
        string? search,
        string? status,
        int? limit,
        int? offset,
        HttpContext context,
        BackendGateway backend,
        PortalSessionManager sessions,
        CancellationToken cancellationToken)
    {
        var session = await RequireSessionAsync(context, sessions, cancellationToken);
        try
        {
            var (_, organizations) = await backend.GetPlatformOrganizationsAsync(
                session,
                search,
                status,
                limit,
                offset,
                cancellationToken);
            return Results.Ok(organizations.ToPortalResponse());
        }
        catch (ApiException exception) when (
            exception.StatusCode == StatusCodes.Status400BadRequest)
        {
            throw new PortalProblemException(
                StatusCodes.Status400BadRequest,
                "Adjust the customer directory filters and try again.",
                "https://giftcard.example/problems/invalid-platform-organization-query");
        }
        catch (ApiException exception) when (
            exception.StatusCode == StatusCodes.Status403Forbidden)
        {
            throw Forbidden();
        }
    }

    private static async Task<IResult> GetPlatformOrganizationAsync(
        Guid organizationId,
        HttpContext context,
        BackendGateway backend,
        PortalSessionManager sessions,
        CancellationToken cancellationToken)
    {
        var session = await RequireSessionAsync(context, sessions, cancellationToken);
        try
        {
            var (_, organization) = await backend.GetPlatformOrganizationAsync(
                session,
                organizationId,
                cancellationToken);
            return Results.Ok(organization.ToPortalResponse());
        }
        catch (ApiException exception) when (
            exception.StatusCode == StatusCodes.Status404NotFound)
        {
            throw new PortalProblemException(
                StatusCodes.Status404NotFound,
                "That customer is no longer available.",
                "https://giftcard.example/problems/platform-organization-not-found");
        }
        catch (ApiException exception) when (
            exception.StatusCode == StatusCodes.Status403Forbidden)
        {
            throw Forbidden();
        }
    }

    private static async Task<IResult> GetPlatformFundingBalancesAsync(
        Guid organizationId,
        HttpContext context,
        BackendGateway backend,
        PortalSessionManager sessions,
        CancellationToken cancellationToken)
    {
        var session = await RequireSessionAsync(context, sessions, cancellationToken);
        try
        {
            var (_, balances) = await backend.GetPlatformCorporateCreditBalancesAsync(
                session,
                organizationId,
                cancellationToken);
            return Results.Ok(balances.ToPortalResponse());
        }
        catch (ApiException exception) when (
            exception.StatusCode == StatusCodes.Status403Forbidden)
        {
            throw Forbidden();
        }
    }

    private static async Task<IResult> GetPlatformFundingHistoryAsync(
        Guid organizationId,
        int? limit,
        string? cursor,
        HttpContext context,
        BackendGateway backend,
        PortalSessionManager sessions,
        CancellationToken cancellationToken)
    {
        if (limit is <= 0 or > 200)
        {
            throw new PortalProblemException(
                StatusCodes.Status400BadRequest,
                "Choose an allocation history page size between 1 and 200.",
                "https://giftcard.example/problems/invalid-funding-history-query");
        }

        var session = await RequireSessionAsync(context, sessions, cancellationToken);
        try
        {
            var (_, history) = await backend.GetPlatformCorporateCreditHistoryAsync(
                session,
                organizationId,
                limit ?? 20,
                cursor,
                cancellationToken);
            return Results.Ok(history.ToPortalResponse());
        }
        catch (ApiException exception) when (
            exception.StatusCode == StatusCodes.Status400BadRequest)
        {
            throw new PortalProblemException(
                StatusCodes.Status400BadRequest,
                "The allocation history cursor is no longer valid. Reload the history.",
                "https://giftcard.example/problems/invalid-funding-history-query");
        }
        catch (ApiException exception) when (
            exception.StatusCode == StatusCodes.Status403Forbidden)
        {
            throw Forbidden();
        }
    }

    private static async Task<IResult> AllocatePlatformFundingAsync(
        Guid organizationId,
        AllocatePortalCorporateCreditRequest request,
        HttpContext context,
        BackendGateway backend,
        PortalSessionManager sessions,
        CancellationToken cancellationToken)
    {
        if (request.OperationId == Guid.Empty
            || string.IsNullOrWhiteSpace(request.Currency)
            || string.IsNullOrWhiteSpace(request.BusinessReference)
            || !decimal.TryParse(
                request.Amount,
                NumberStyles.AllowLeadingSign | NumberStyles.AllowDecimalPoint,
                CultureInfo.InvariantCulture,
                out var amount))
        {
            throw InvalidFundingIntent();
        }

        var session = await RequireSessionAsync(context, sessions, cancellationToken);
        try
        {
            var (_, allocation) = await backend.AllocatePlatformCorporateCreditAsync(
                session,
                organizationId,
                (double)amount,
                request.Currency.Trim(),
                request.BusinessReference.Trim(),
                $"portal-allocation-{request.OperationId:N}",
                cancellationToken);
            return Results.Ok(allocation.ToPortalResponse());
        }
        catch (ApiException exception) when (
            exception.StatusCode == StatusCodes.Status400BadRequest)
        {
            throw InvalidFundingIntent();
        }
        catch (ApiException exception) when (
            exception.StatusCode == StatusCodes.Status403Forbidden)
        {
            throw Forbidden();
        }
        catch (ApiException exception) when (
            exception.StatusCode == StatusCodes.Status409Conflict)
        {
            throw new PortalProblemException(
                StatusCodes.Status409Conflict,
                "This operation identity was already used for different funding details. Review and submit a new intent.",
                "https://giftcard.example/problems/funding-conflict");
        }
    }

    private static async Task<IResult> ReversePlatformFundingAsync(
        Guid allocationId,
        ReversePortalCorporateCreditRequest request,
        HttpContext context,
        BackendGateway backend,
        PortalSessionManager sessions,
        CancellationToken cancellationToken)
    {
        if (request.OperationId == Guid.Empty || string.IsNullOrWhiteSpace(request.Reason))
        {
            throw new PortalProblemException(
                StatusCodes.Status400BadRequest,
                "Enter a reversal reason and review the operation again.",
                "https://giftcard.example/problems/invalid-funding-reversal");
        }

        var session = await RequireSessionAsync(context, sessions, cancellationToken);
        try
        {
            var (_, reversal) = await backend.ReversePlatformCorporateCreditAsync(
                session,
                allocationId,
                request.Reason.Trim(),
                $"portal-reversal-{request.OperationId:N}",
                cancellationToken);
            return Results.Ok(reversal.ToPortalResponse());
        }
        catch (ApiException exception) when (
            exception.StatusCode == StatusCodes.Status400BadRequest)
        {
            throw new PortalProblemException(
                StatusCodes.Status400BadRequest,
                "Check the reversal reason and try again.",
                "https://giftcard.example/problems/invalid-funding-reversal");
        }
        catch (ApiException exception) when (
            exception.StatusCode == StatusCodes.Status403Forbidden)
        {
            throw Forbidden();
        }
        catch (ApiException exception) when (
            exception.StatusCode == StatusCodes.Status404NotFound)
        {
            throw new PortalProblemException(
                StatusCodes.Status404NotFound,
                "That allocation is no longer available.",
                "https://giftcard.example/problems/funding-allocation-not-found");
        }
        catch (ApiException exception) when (
            exception.StatusCode == StatusCodes.Status409Conflict)
        {
            throw new PortalProblemException(
                StatusCodes.Status409Conflict,
                "That allocation was already reversed or the operation no longer matches. Reload funding history.",
                "https://giftcard.example/problems/funding-reversal-conflict");
        }
    }

    private static async Task<IResult> GetSubsidiariesAsync(
        int? limit,
        int? offset,
        HttpContext context,
        BackendGateway backend,
        PortalSessionManager sessions,
        CancellationToken cancellationToken)
    {
        if (limit is <= 0 or > 50 || offset < 0)
        {
            throw new PortalProblemException(
                StatusCodes.Status400BadRequest,
                "Choose a subsidiary page size between 1 and 50 and a non-negative offset.",
                "https://giftcard.example/problems/invalid-subsidiary-query");
        }

        var session = await RequireOrganizationSessionAsync(
            context,
            sessions,
            cancellationToken);
        try
        {
            var (_, subsidiaries) = await backend.GetSubsidiariesAsync(
                session,
                session.SelectedOrganizationId!.Value,
                limit ?? 20,
                offset ?? 0,
                cancellationToken);
            return Results.Ok(subsidiaries.ToPortalResponse());
        }
        catch (ApiException exception) when (
            exception.StatusCode == StatusCodes.Status400BadRequest)
        {
            throw new PortalProblemException(
                StatusCodes.Status400BadRequest,
                "Adjust the subsidiary page and try again.",
                "https://giftcard.example/problems/invalid-subsidiary-query");
        }
        catch (ApiException exception) when (
            exception.StatusCode == StatusCodes.Status404NotFound)
        {
            throw new PortalProblemException(
                StatusCodes.Status404NotFound,
                "The selected organization is no longer available.",
                "https://giftcard.example/problems/organization-not-found");
        }
        catch (ApiException exception) when (
            exception.StatusCode == StatusCodes.Status403Forbidden)
        {
            throw Forbidden();
        }
    }

    private static async Task<IResult> CreateSubsidiaryAsync(
        CreatePortalSubsidiaryRequest request,
        HttpContext context,
        BackendGateway backend,
        PortalSessionManager sessions,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Name)
            || string.IsNullOrWhiteSpace(request.Code))
        {
            throw new PortalProblemException(
                StatusCodes.Status400BadRequest,
                "Enter a subsidiary name and code.",
                "https://giftcard.example/problems/invalid-subsidiary");
        }

        var session = await RequireOrganizationSessionAsync(
            context,
            sessions,
            cancellationToken);
        try
        {
            var (_, subsidiary) = await backend.CreateSubsidiaryAsync(
                session,
                session.SelectedOrganizationId!.Value,
                request.Name.Trim(),
                request.Code.Trim(),
                cancellationToken);
            return Results.Created(
                "/bff/organization/subsidiaries",
                subsidiary.ToPortalResponse());
        }
        catch (ApiException exception) when (
            exception.StatusCode == StatusCodes.Status400BadRequest)
        {
            throw new PortalProblemException(
                StatusCodes.Status400BadRequest,
                "Check the subsidiary name and code and try again.",
                "https://giftcard.example/problems/invalid-subsidiary");
        }
        catch (ApiException exception) when (
            exception.StatusCode == StatusCodes.Status404NotFound)
        {
            throw new PortalProblemException(
                StatusCodes.Status404NotFound,
                "The selected organization is no longer available.",
                "https://giftcard.example/problems/organization-not-found");
        }
        catch (ApiException exception) when (
            exception.StatusCode == StatusCodes.Status409Conflict)
        {
            throw new PortalProblemException(
                StatusCodes.Status409Conflict,
                "That subsidiary code is already in use for this organization.",
                "https://giftcard.example/problems/subsidiary-conflict");
        }
        catch (ApiException exception) when (
            exception.StatusCode == StatusCodes.Status403Forbidden)
        {
            throw Forbidden();
        }
    }

    private static async Task<IResult> GetOrganizationTeamAsync(
        int? limit,
        int? offset,
        HttpContext context,
        BackendGateway backend,
        PortalSessionManager sessions,
        CancellationToken cancellationToken)
    {
        ValidateTeamPage(limit, offset);
        var session = await RequireOrganizationSessionAsync(
            context,
            sessions,
            cancellationToken);
        try
        {
            var (_, team) = await backend.GetTeamAsync(
                session,
                session.SelectedOrganizationId!.Value,
                session.SelectedOrganizationId,
                limit ?? 25,
                offset ?? 0,
                cancellationToken);
            return Results.Ok(team.ToPortalResponse());
        }
        catch (ApiException exception) when (IsTeamApiError(exception))
        {
            throw TeamProblem(exception);
        }
    }

    private static async Task<IResult> GetPlatformTeamAsync(
        Guid organizationId,
        int? limit,
        int? offset,
        HttpContext context,
        BackendGateway backend,
        PortalSessionManager sessions,
        CancellationToken cancellationToken)
    {
        ValidateTeamPage(limit, offset);
        var session = await RequireSessionAsync(context, sessions, cancellationToken);
        try
        {
            var (_, team) = await backend.GetTeamAsync(
                session,
                organizationId,
                null,
                limit ?? 25,
                offset ?? 0,
                cancellationToken);
            return Results.Ok(team.ToPortalResponse());
        }
        catch (ApiException exception) when (IsTeamApiError(exception))
        {
            throw TeamProblem(exception);
        }
    }

    private static async Task<IResult> AddOrganizationTeamMemberAsync(
        AddPortalTeamMemberRequest request,
        HttpContext context,
        BackendGateway backend,
        PortalSessionManager sessions,
        CancellationToken cancellationToken)
    {
        var email = request.Email?.Trim();
        if (string.IsNullOrWhiteSpace(email) || email.Length > 320)
        {
            throw InvalidTeamIntent(
                "Enter the email address of an existing active account.");
        }

        var session = await RequireOrganizationSessionAsync(
            context,
            sessions,
            cancellationToken);
        try
        {
            var (_, member) = await backend.AddTeamMemberAsync(
                session,
                session.SelectedOrganizationId!.Value,
                email,
                cancellationToken);
            return Results.Created("/bff/organization/team", member.ToPortalResponse());
        }
        catch (ApiException exception) when (IsTeamApiError(exception))
        {
            throw TeamProblem(exception);
        }
    }

    private static async Task<IResult> DisableOrganizationTeamMemberAsync(
        Guid membershipId,
        HttpContext context,
        BackendGateway backend,
        PortalSessionManager sessions,
        CancellationToken cancellationToken)
    {
        if (membershipId == Guid.Empty)
        {
            throw InvalidTeamIntent("Choose a current team member.");
        }

        var session = await RequireOrganizationSessionAsync(
            context,
            sessions,
            cancellationToken);
        try
        {
            var (refreshedSession, user) = await backend.GetCurrentUserAsync(
                session,
                session.SelectedOrganizationId,
                cancellationToken);
            if (user.OrganizationContext?.MembershipId == membershipId)
            {
                throw new PortalProblemException(
                    StatusCodes.Status409Conflict,
                    "You cannot disable your own membership.",
                    "https://giftcard.example/problems/self-membership-disable");
            }

            var (_, member) = await backend.DisableTeamMemberAsync(
                refreshedSession,
                session.SelectedOrganizationId!.Value,
                membershipId,
                cancellationToken);
            return Results.Ok(member.ToPortalResponse());
        }
        catch (ApiException exception) when (IsTeamApiError(exception))
        {
            throw TeamProblem(exception);
        }
    }

    private static async Task<IResult> GetOrganizationRolesAsync(
        HttpContext context,
        BackendGateway backend,
        PortalSessionManager sessions,
        CancellationToken cancellationToken)
    {
        var session = await RequireOrganizationSessionAsync(
            context,
            sessions,
            cancellationToken);
        try
        {
            var (_, roles) = await backend.GetRolesAsync(
                session,
                session.SelectedOrganizationId!.Value,
                cancellationToken);
            return Results.Ok(roles.Select(role => role.ToPortalResponse()).ToArray());
        }
        catch (ApiException exception) when (IsTeamApiError(exception))
        {
            throw TeamProblem(exception);
        }
    }

    private static async Task<IResult> CreateOrganizationRoleAsync(
        CreatePortalRoleRequest request,
        HttpContext context,
        BackendGateway backend,
        PortalSessionManager sessions,
        CancellationToken cancellationToken)
    {
        var name = request.Name?.Trim();
        if (string.IsNullOrWhiteSpace(name) || name.Length is < 2 or > 100)
        {
            throw InvalidTeamIntent("Enter a role name between 2 and 100 characters.");
        }

        var session = await RequireOrganizationSessionAsync(
            context,
            sessions,
            cancellationToken);
        try
        {
            var (_, role) = await backend.CreateRoleAsync(
                session,
                session.SelectedOrganizationId!.Value,
                name,
                cancellationToken);
            return Results.Created("/bff/organization/roles", role.ToPortalResponse());
        }
        catch (ApiException exception) when (IsTeamApiError(exception))
        {
            throw TeamProblem(exception);
        }
    }

    private static async Task<IResult> GrantOrganizationRolePermissionsAsync(
        Guid roleId,
        GrantPortalRolePermissionsRequest request,
        HttpContext context,
        BackendGateway backend,
        PortalSessionManager sessions,
        CancellationToken cancellationToken)
    {
        var permissions = request.Permissions?
            .Where(permission => !string.IsNullOrWhiteSpace(permission))
            .Select(permission => permission.Trim())
            .Distinct(StringComparer.Ordinal)
            .ToArray();
        if (roleId == Guid.Empty
            || permissions is null
            || permissions.Length is < 1 or > 100
            || permissions.Any(permission => permission.Length > 200))
        {
            throw InvalidTeamIntent(
                "Choose a current role and 1 to 100 available permissions.");
        }

        var session = await RequireOrganizationSessionAsync(
            context,
            sessions,
            cancellationToken);
        try
        {
            var (_, role) = await backend.GrantRolePermissionsAsync(
                session,
                session.SelectedOrganizationId!.Value,
                roleId,
                permissions,
                cancellationToken);
            return Results.Ok(role.ToPortalResponse());
        }
        catch (ApiException exception) when (IsTeamApiError(exception))
        {
            throw TeamProblem(exception);
        }
    }

    private static async Task<IResult> GetOrganizationRoleAssignmentsAsync(
        HttpContext context,
        BackendGateway backend,
        PortalSessionManager sessions,
        CancellationToken cancellationToken)
    {
        var session = await RequireOrganizationSessionAsync(
            context,
            sessions,
            cancellationToken);
        try
        {
            var (_, assignments) = await backend.GetRoleAssignmentsAsync(
                session,
                session.SelectedOrganizationId!.Value,
                cancellationToken);
            return Results.Ok(
                assignments.Select(assignment => assignment.ToPortalResponse()).ToArray());
        }
        catch (ApiException exception) when (IsTeamApiError(exception))
        {
            throw TeamProblem(exception);
        }
    }

    private static async Task<IResult> AssignOrganizationRoleAsync(
        AssignPortalRoleRequest request,
        HttpContext context,
        BackendGateway backend,
        PortalSessionManager sessions,
        CancellationToken cancellationToken)
    {
        var scope = request.Scope?.Trim().ToLowerInvariant() switch
        {
            "organization" => RoleScope._1,
            "subtree" => RoleScope._2,
            _ => (RoleScope?)null,
        };
        if (request.MembershipId == Guid.Empty
            || request.RoleId == Guid.Empty
            || scope is null)
        {
            throw InvalidTeamIntent(
                "Choose a current member, role, and supported assignment scope.");
        }

        var session = await RequireOrganizationSessionAsync(
            context,
            sessions,
            cancellationToken);
        try
        {
            var (_, assignment) = await backend.AssignRoleAsync(
                session,
                session.SelectedOrganizationId!.Value,
                request.MembershipId,
                request.RoleId,
                scope.Value,
                cancellationToken);
            return Results.Created(
                "/bff/organization/role-assignments",
                assignment.ToPortalResponse());
        }
        catch (ApiException exception) when (IsTeamApiError(exception))
        {
            throw TeamProblem(exception);
        }
    }

    private static void ValidateTeamPage(int? limit, int? offset)
    {
        if (limit is <= 0 or > 50 || offset < 0)
        {
            throw InvalidTeamIntent(
                "Choose a team page size between 1 and 50 and a non-negative offset.");
        }
    }

    private static bool IsTeamApiError(ApiException exception) =>
        exception.StatusCode is StatusCodes.Status400BadRequest
            or StatusCodes.Status403Forbidden
            or StatusCodes.Status404NotFound
            or StatusCodes.Status409Conflict;

    private static PortalProblemException TeamProblem(ApiException exception) =>
        exception.StatusCode switch
        {
            StatusCodes.Status400BadRequest => InvalidTeamIntent(
                "Review the team or role details and try again."),
            StatusCodes.Status403Forbidden => Forbidden(),
            StatusCodes.Status404NotFound => new PortalProblemException(
                StatusCodes.Status404NotFound,
                "That team member, role, or organization is no longer available.",
                "https://giftcard.example/problems/team-resource-not-found"),
            StatusCodes.Status409Conflict => new PortalProblemException(
                StatusCodes.Status409Conflict,
                "The team or role state changed. Reload and review the action again.",
                "https://giftcard.example/problems/team-conflict"),
            _ => throw new ArgumentOutOfRangeException(nameof(exception)),
        };

    private static PortalProblemException InvalidTeamIntent(string title) =>
        new(
            StatusCodes.Status400BadRequest,
            title,
            "https://giftcard.example/problems/invalid-team-intent");

    private static async Task<IResult> ClearOrganizationAsync(
        HttpContext context,
        BackendGateway backend,
        PortalSessionManager sessions,
        CancellationToken cancellationToken)
    {
        var session = await RequireSessionAsync(context, sessions, cancellationToken);
        session = await sessions.SetOrganizationAsync(
            session,
            null,
            null,
            cancellationToken);
        var (_, user) = await backend.GetCurrentUserAsync(session, null, cancellationToken);
        return Results.Ok(user.ToPortalResponse());
    }

    private static async Task<IResult> GetGiftCardInventoryAsync(
        int? limit,
        string? cursor,
        HttpContext context,
        BackendGateway backend,
        PortalSessionManager sessions,
        CancellationToken cancellationToken)
    {
        if (limit is <= 0 or > 200)
        {
            throw new PortalProblemException(
                StatusCodes.Status400BadRequest,
                "Choose an inventory page size between 1 and 200.",
                "https://giftcard.example/problems/invalid-gift-card-inventory-query");
        }

        var session = await RequireGiftCardSessionAsync(
            context,
            sessions,
            cancellationToken);
        try
        {
            var (_, inventory) = await backend.GetGiftCardInventoryAsync(
                session,
                session.SelectedOrganizationId!.Value,
                limit ?? 20,
                cursor,
                cancellationToken);
            return Results.Ok(inventory.ToPortalResponse());
        }
        catch (ApiException exception) when (
            exception.StatusCode == StatusCodes.Status400BadRequest)
        {
            throw new PortalProblemException(
                StatusCodes.Status400BadRequest,
                "The inventory page is no longer valid. Reload the Cards workspace.",
                "https://giftcard.example/problems/invalid-gift-card-inventory-query");
        }
        catch (ApiException exception) when (
            exception.StatusCode == StatusCodes.Status403Forbidden)
        {
            throw Forbidden();
        }
    }

    private static async Task<IResult> IssueGiftCardAsync(
        IssuePortalGiftCardRequest request,
        HttpContext context,
        BackendGateway backend,
        PortalSessionManager sessions,
        CancellationToken cancellationToken)
    {
        if (request.OperationId == Guid.Empty
            || string.IsNullOrWhiteSpace(request.Currency)
            || string.IsNullOrWhiteSpace(request.BusinessReference)
            || !decimal.TryParse(
                request.Amount,
                NumberStyles.AllowLeadingSign | NumberStyles.AllowDecimalPoint,
                CultureInfo.InvariantCulture,
                out var amount)
            || !DateTimeOffset.TryParse(
                request.ExpiresAtUtc,
                CultureInfo.InvariantCulture,
                DateTimeStyles.RoundtripKind,
                out var expiresAtUtc))
        {
            throw InvalidGiftCardIntent();
        }

        DateTimeOffset? validFromUtc = null;
        if (!string.IsNullOrWhiteSpace(request.ValidFromUtc))
        {
            if (!DateTimeOffset.TryParse(
                request.ValidFromUtc,
                CultureInfo.InvariantCulture,
                DateTimeStyles.RoundtripKind,
                out var parsedValidFromUtc))
            {
                throw InvalidGiftCardIntent();
            }

            validFromUtc = parsedValidFromUtc;
        }

        var session = await RequireGiftCardSessionAsync(
            context,
            sessions,
            cancellationToken);
        try
        {
            var (_, giftCard) = await backend.IssueGiftCardAsync(
                session,
                session.SelectedOrganizationId!.Value,
                (double)amount,
                request.Currency.Trim(),
                validFromUtc,
                expiresAtUtc,
                request.IsTransferable,
                request.IsDivisible,
                request.BusinessReference.Trim(),
                $"portal-gift-card-issue-{request.OperationId:N}",
                cancellationToken);
            return Results.Ok(giftCard.ToPortalResponse());
        }
        catch (ApiException exception) when (
            exception.StatusCode == StatusCodes.Status400BadRequest)
        {
            throw InvalidGiftCardIntent();
        }
        catch (ApiException exception) when (
            exception.StatusCode == StatusCodes.Status403Forbidden)
        {
            throw Forbidden();
        }
        catch (ApiException exception) when (
            exception.StatusCode == StatusCodes.Status409Conflict)
        {
            throw new PortalProblemException(
                StatusCodes.Status409Conflict,
                "The card could not be issued because the funding or operation state changed. Review a new issuance intent.",
                "https://giftcard.example/problems/gift-card-issuance-conflict");
        }
    }

    private static async Task<IResult> GetGiftCardLifecycleAsync(
        Guid giftCardId,
        HttpContext context,
        BackendGateway backend,
        PortalSessionManager sessions,
        CancellationToken cancellationToken)
    {
        if (giftCardId == Guid.Empty)
        {
            throw InvalidGiftCardSelection();
        }

        var session = await RequireGiftCardSessionAsync(
            context,
            sessions,
            cancellationToken);
        try
        {
            var (_, history) = await backend.GetGiftCardLifecycleHistoryAsync(
                session,
                session.SelectedOrganizationId!.Value,
                giftCardId,
                cancellationToken);
            return Results.Ok(history.ToPortalResponse());
        }
        catch (ApiException exception) when (
            exception.StatusCode == StatusCodes.Status403Forbidden)
        {
            throw Forbidden();
        }
        catch (ApiException exception) when (
            exception.StatusCode == StatusCodes.Status404NotFound)
        {
            throw GiftCardNotFound();
        }
    }

    private static async Task<IResult> RunGiftCardLifecycleAsync(
        Guid giftCardId,
        string action,
        RunPortalGiftCardLifecycleRequest request,
        HttpContext context,
        BackendGateway backend,
        PortalSessionManager sessions,
        CancellationToken cancellationToken)
    {
        var normalizedAction = action.Trim().ToLowerInvariant();
        if (giftCardId == Guid.Empty ||
            normalizedAction is not ("suspend" or "reactivate" or "cancel" or "expire") ||
            request.OperationId == Guid.Empty ||
            string.IsNullOrWhiteSpace(request.Reason))
        {
            throw InvalidGiftCardLifecycleIntent();
        }

        var session = await RequireGiftCardSessionAsync(
            context,
            sessions,
            cancellationToken);
        try
        {
            var (_, operation) = await backend.ExecuteGiftCardLifecycleAsync(
                session,
                session.SelectedOrganizationId!.Value,
                giftCardId,
                normalizedAction,
                request.Reason.Trim(),
                $"portal-gift-card-lifecycle-{normalizedAction}-{request.OperationId:N}",
                cancellationToken);
            return Results.Ok(operation.Event.ToPortalResponse());
        }
        catch (ApiException exception) when (
            exception.StatusCode == StatusCodes.Status400BadRequest)
        {
            throw InvalidGiftCardLifecycleIntent();
        }
        catch (ApiException exception) when (
            exception.StatusCode == StatusCodes.Status403Forbidden)
        {
            throw Forbidden();
        }
        catch (ApiException exception) when (
            exception.StatusCode == StatusCodes.Status404NotFound)
        {
            throw GiftCardNotFound();
        }
        catch (ApiException exception) when (
            exception.StatusCode == StatusCodes.Status409Conflict)
        {
            throw new PortalProblemException(
                StatusCodes.Status409Conflict,
                "The card changed or this lifecycle action is no longer valid. Refresh its detail and review the action again.",
                "https://giftcard.example/problems/gift-card-lifecycle-conflict");
        }
    }

    private static async Task<IResult> DistributeGiftCardAsync(
        Guid giftCardId,
        DistributePortalGiftCardRequest request,
        HttpContext context,
        BackendGateway backend,
        PortalSessionManager sessions,
        CancellationToken cancellationToken)
    {
        if (giftCardId == Guid.Empty ||
            request.OperationId == Guid.Empty ||
            !TryParseContactType(request.ContactType, out var contactType) ||
            string.IsNullOrWhiteSpace(request.RecipientContact) ||
            string.IsNullOrWhiteSpace(request.BusinessReference))
        {
            throw InvalidGiftCardDistributionIntent();
        }

        var session = await RequireGiftCardSessionAsync(
            context,
            sessions,
            cancellationToken);
        try
        {
            var (_, distribution) = await backend.DistributeGiftCardAsync(
                session,
                session.SelectedOrganizationId!.Value,
                giftCardId,
                contactType,
                request.RecipientContact.Trim(),
                request.BusinessReference.Trim(),
                $"portal-gift-card-distribute-{request.OperationId:N}",
                cancellationToken);
            return Results.Ok(distribution.ToPortalResponse());
        }
        catch (ApiException exception) when (
            exception.StatusCode == StatusCodes.Status400BadRequest)
        {
            throw InvalidGiftCardDistributionIntent();
        }
        catch (ApiException exception) when (
            exception.StatusCode == StatusCodes.Status403Forbidden)
        {
            throw Forbidden();
        }
        catch (ApiException exception) when (
            exception.StatusCode == StatusCodes.Status404NotFound)
        {
            throw GiftCardNotFound();
        }
        catch (ApiException<ProblemDetails> exception) when (
            exception.StatusCode == StatusCodes.Status409Conflict)
        {
            throw GiftCardDistributionConflict(exception);
        }
        catch (ApiException exception) when (
            exception.StatusCode == StatusCodes.Status409Conflict)
        {
            throw GiftCardDistributionConflict(exception);
        }
    }

    private static async Task<IResult> CreateBulkGiftCardBatchAsync(
        CreatePortalBulkGiftCardBatchRequest request,
        HttpContext context,
        BackendGateway backend,
        PortalSessionManager sessions,
        CancellationToken cancellationToken)
    {
        if (request.OperationId == Guid.Empty ||
            string.IsNullOrWhiteSpace(request.BatchReference) ||
            request.Items is null ||
            request.Items.Count is < 1 or > 2000)
        {
            throw InvalidBulkGiftCardBatchIntent();
        }

        var items = new List<BackendBulkGiftCardBatchItem>(request.Items.Count);
        foreach (var item in request.Items)
        {
            if (item is null ||
                string.IsNullOrWhiteSpace(item.ItemReference) ||
                string.IsNullOrWhiteSpace(item.Currency) ||
                string.IsNullOrWhiteSpace(item.RecipientContact) ||
                !TryParseContactType(item.ContactType, out var contactType) ||
                !decimal.TryParse(
                    item.Amount,
                    NumberStyles.AllowLeadingSign | NumberStyles.AllowDecimalPoint,
                    CultureInfo.InvariantCulture,
                    out var amount) ||
                !DateTimeOffset.TryParse(
                    item.ExpiresAtUtc,
                    CultureInfo.InvariantCulture,
                    DateTimeStyles.RoundtripKind,
                    out var expiresAtUtc))
            {
                throw InvalidBulkGiftCardBatchIntent();
            }

            DateTimeOffset? validFromUtc = null;
            if (!string.IsNullOrWhiteSpace(item.ValidFromUtc))
            {
                if (!DateTimeOffset.TryParse(
                    item.ValidFromUtc,
                    CultureInfo.InvariantCulture,
                    DateTimeStyles.RoundtripKind,
                    out var parsedValidFromUtc))
                {
                    throw InvalidBulkGiftCardBatchIntent();
                }

                validFromUtc = parsedValidFromUtc;
            }

            items.Add(new BackendBulkGiftCardBatchItem(
                item.ItemReference.Trim(),
                (double)amount,
                item.Currency.Trim(),
                validFromUtc,
                expiresAtUtc,
                item.IsTransferable,
                item.IsDivisible,
                contactType,
                item.RecipientContact.Trim()));
        }

        var session = await RequireGiftCardSessionAsync(
            context,
            sessions,
            cancellationToken);
        try
        {
            var (_, batch) = await backend.AcceptBulkGiftCardBatchAsync(
                session,
                session.SelectedOrganizationId!.Value,
                request.BatchReference.Trim(),
                items,
                $"portal-gift-card-batch-{request.OperationId:N}",
                cancellationToken);
            return Results.Accepted(
                $"/bff/gift-card-batches/{batch.Id}",
                batch.ToPortalResponse());
        }
        catch (ApiException exception) when (
            exception.StatusCode == StatusCodes.Status400BadRequest)
        {
            throw InvalidBulkGiftCardBatchIntent();
        }
        catch (ApiException exception) when (
            exception.StatusCode == StatusCodes.Status403Forbidden)
        {
            throw Forbidden();
        }
        catch (ApiException exception) when (
            exception.StatusCode == StatusCodes.Status409Conflict)
        {
            throw new PortalProblemException(
                StatusCodes.Status409Conflict,
                "That batch reference or operation conflicts with existing work. Review the returned state or start a new batch.",
                "https://giftcard.example/problems/gift-card-batch-conflict");
        }
    }

    private static async Task<IResult> GetBulkGiftCardBatchAsync(
        Guid batchId,
        int? limit,
        string? cursor,
        HttpContext context,
        BackendGateway backend,
        PortalSessionManager sessions,
        CancellationToken cancellationToken)
    {
        if (batchId == Guid.Empty || limit is < 1 or > 200)
        {
            throw InvalidBulkGiftCardBatchSelection();
        }

        var session = await RequireGiftCardSessionAsync(
            context,
            sessions,
            cancellationToken);
        try
        {
            var (_, batch) = await backend.GetBulkGiftCardBatchPageAsync(
                session,
                session.SelectedOrganizationId!.Value,
                batchId,
                limit,
                cursor,
                cancellationToken);
            return Results.Ok(batch.ToPortalResponse());
        }
        catch (ApiException exception) when (
            exception.StatusCode == StatusCodes.Status400BadRequest)
        {
            throw InvalidBulkGiftCardBatchSelection();
        }
        catch (ApiException exception) when (
            exception.StatusCode == StatusCodes.Status403Forbidden)
        {
            throw Forbidden();
        }
        catch (ApiException exception) when (
            exception.StatusCode == StatusCodes.Status404NotFound)
        {
            throw new PortalProblemException(
                StatusCodes.Status404NotFound,
                "That batch is no longer available in the selected organization.",
                "https://giftcard.example/problems/gift-card-batch-not-found");
        }
    }

    private static async Task<IResult> RetryBulkGiftCardBatchAsync(
        Guid batchId,
        HttpContext context,
        BackendGateway backend,
        PortalSessionManager sessions,
        CancellationToken cancellationToken)
    {
        if (batchId == Guid.Empty)
        {
            throw InvalidBulkGiftCardBatchSelection();
        }

        var session = await RequireGiftCardSessionAsync(
            context,
            sessions,
            cancellationToken);
        try
        {
            var (_, batch) = await backend.RetryBulkGiftCardBatchAsync(
                session,
                session.SelectedOrganizationId!.Value,
                batchId,
                cancellationToken);
            return Results.Accepted(
                $"/bff/gift-card-batches/{batch.Id}",
                batch.ToPortalResponse());
        }
        catch (ApiException exception) when (
            exception.StatusCode == StatusCodes.Status400BadRequest)
        {
            throw InvalidBulkGiftCardBatchSelection();
        }
        catch (ApiException exception) when (
            exception.StatusCode == StatusCodes.Status403Forbidden)
        {
            throw Forbidden();
        }
        catch (ApiException exception) when (
            exception.StatusCode == StatusCodes.Status404NotFound)
        {
            throw new PortalProblemException(
                StatusCodes.Status404NotFound,
                "That batch is no longer available in the selected organization.",
                "https://giftcard.example/problems/gift-card-batch-not-found");
        }
        catch (ApiException exception) when (
            exception.StatusCode == StatusCodes.Status409Conflict)
        {
            throw new PortalProblemException(
                StatusCodes.Status409Conflict,
                "Only a completed batch with failed rows can be retried.",
                "https://giftcard.example/problems/gift-card-batch-retry-conflict");
        }
    }

    private static async Task<IResult> GetFinancialSummaryAsync(
        HttpContext context,
        BackendGateway backend,
        PortalSessionManager sessions,
        CancellationToken cancellationToken)
    {
        var session = await RequireFinanceSessionAsync(
            context,
            sessions,
            cancellationToken);
        try
        {
            var (_, summary) = await backend.GetFinancialSummaryAsync(
                session,
                session.SelectedTenantRootOrganizationId!.Value,
                cancellationToken);
            return Results.Ok(summary.ToPortalResponse());
        }
        catch (ApiException exception) when (
            exception.StatusCode == StatusCodes.Status403Forbidden)
        {
            throw Forbidden();
        }
    }

    private static async Task<IResult> GetFinancialHistoryAsync(
        int? limit,
        string? cursor,
        string? category,
        string? operation,
        string? currency,
        string? reference,
        DateOnly? occurredFrom,
        DateOnly? occurredThrough,
        HttpContext context,
        BackendGateway backend,
        PortalSessionManager sessions,
        CancellationToken cancellationToken)
    {
        if (limit is <= 0 or > 50)
        {
            throw new PortalProblemException(
                StatusCodes.Status400BadRequest,
                "Choose a history page size between 1 and 50.",
                "https://giftcard.example/problems/invalid-financial-history-query");
        }

        var filters = NormalizeFinancialHistoryFilters(
            category,
            operation,
            currency,
            reference,
            occurredFrom,
            occurredThrough);
        var session = await RequireFinanceSessionAsync(
            context,
            sessions,
            cancellationToken);
        try
        {
            var (_, history) = await backend.GetFinancialHistoryAsync(
                session,
                session.SelectedTenantRootOrganizationId!.Value,
                limit ?? 10,
                cursor,
                filters.Category,
                filters.Operation,
                filters.Currency,
                filters.Reference,
                filters.OccurredFromUtc,
                filters.OccurredBeforeUtc,
                cancellationToken);
            return Results.Ok(history.ToPortalResponse());
        }
        catch (ApiException exception) when (
            exception.StatusCode == StatusCodes.Status400BadRequest)
        {
            throw new PortalProblemException(
                StatusCodes.Status400BadRequest,
                "The search filters or financial history page are no longer valid. Review the filters and search again.",
                "https://giftcard.example/problems/invalid-financial-history-query");
        }
        catch (ApiException exception) when (
            exception.StatusCode == StatusCodes.Status403Forbidden)
        {
            throw Forbidden();
        }
    }

    /// <summary>
    /// The register is rooted at the funding tenant, like the finance reports,
    /// because the question it answers is "what did we pay for", not "what is
    /// sitting in this department's inventory".
    /// </summary>
    private static async Task<IResult> GetCardRegisterAsync(
        int? limit,
        string? cursor,
        string? lifecycleState,
        string? ownershipState,
        string? currency,
        string? reference,
        HttpContext context,
        PortalSessionManager sessions,
        BackendGateway backend,
        CancellationToken cancellationToken)
    {
        if (limit is < 1 or > 50)
        {
            throw InvalidCardRegisterQuery(
                "Choose a register page size between 1 and 50.");
        }

        var session = await RequireFinanceSessionAsync(
            context,
            sessions,
            cancellationToken);
        try
        {
            var (_, register) = await backend.GetCardRegisterAsync(
                session,
                session.SelectedTenantRootOrganizationId!.Value,
                limit ?? 25,
                cursor,
                NormalizeRegisterFilter(lifecycleState, "lifecycle state"),
                NormalizeRegisterFilter(ownershipState, "ownership state"),
                NormalizeRegisterFilter(currency, "currency")?.ToUpperInvariant(),
                NormalizeRegisterFilter(reference, "reference"),
                cancellationToken);
            return Results.Ok(register.ToPortalResponse());
        }
        catch (ApiException exception) when (
            exception.StatusCode == StatusCodes.Status400BadRequest)
        {
            // A cursor is bound to the filter set that produced it, so changing
            // a filter while holding one is the common way to land here.
            throw InvalidCardRegisterQuery(
                "The register filters or page are no longer valid. Review the filters and search again.");
        }
        catch (ApiException exception) when (
            exception.StatusCode == StatusCodes.Status403Forbidden)
        {
            throw Forbidden();
        }
    }

    private static string? NormalizeRegisterFilter(string? value, string fieldName)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        var normalized = value.Trim();
        return normalized.Length <= 64
            ? normalized
            : throw InvalidCardRegisterQuery(
                $"The {fieldName} filter must be at most 64 characters.");
    }

    private static PortalProblemException InvalidCardRegisterQuery(string detail) =>
        new(
            StatusCodes.Status400BadRequest,
            detail,
            "https://giftcard.example/problems/invalid-card-register-query");

    private static FinancialHistoryFilters NormalizeFinancialHistoryFilters(
        string? category,
        string? operation,
        string? currency,
        string? reference,
        DateOnly? occurredFrom,
        DateOnly? occurredThrough)
    {
        var normalizedCategory = NormalizeOptionalText(category, 64, "category");
        if (normalizedCategory is not null
            && !FinancialHistoryCategories.TryGetValue(
                normalizedCategory,
                out normalizedCategory))
        {
            throw InvalidFinancialHistoryQuery(
                "Choose Corporate credit, Gift card, Distribution, or Lifecycle.");
        }

        var normalizedOperation = NormalizeOptionalText(
            operation,
            128,
            "operation");
        var normalizedCurrency = NormalizeOptionalText(currency, 3, "currency")
            ?.ToUpperInvariant();
        if (normalizedCurrency is not null
            && (normalizedCurrency.Length != 3
                || !normalizedCurrency.All(char.IsAsciiLetter)))
        {
            throw InvalidFinancialHistoryQuery(
                "Currency must be a three-letter code.");
        }

        var normalizedReference = NormalizeOptionalText(
            reference,
            200,
            "reference");
        if (occurredFrom is not null
            && occurredThrough is not null
            && occurredFrom > occurredThrough)
        {
            throw InvalidFinancialHistoryQuery(
                "The from date cannot be later than the through date.");
        }

        if (occurredThrough == DateOnly.MaxValue)
        {
            throw InvalidFinancialHistoryQuery(
                "The through date is outside the supported range.");
        }

        return new FinancialHistoryFilters(
            normalizedCategory,
            normalizedOperation,
            normalizedCurrency,
            normalizedReference,
            occurredFrom is null
                ? null
                : new DateTimeOffset(
                    occurredFrom.Value.ToDateTime(TimeOnly.MinValue),
                    TimeSpan.Zero),
            occurredThrough is null
                ? null
                : new DateTimeOffset(
                    occurredThrough.Value
                        .AddDays(1)
                        .ToDateTime(TimeOnly.MinValue),
                    TimeSpan.Zero));
    }

    private static string? NormalizeOptionalText(
        string? value,
        int maximumLength,
        string fieldName)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        var normalized = value.Trim();
        if (normalized.Length > maximumLength)
        {
            throw InvalidFinancialHistoryQuery(
                $"{char.ToUpperInvariant(fieldName[0])}{fieldName[1..]} must be at most {maximumLength} characters.");
        }

        return normalized;
    }

    private static PortalProblemException InvalidFinancialHistoryQuery(
        string title) =>
        new(
            StatusCodes.Status400BadRequest,
            title,
            "https://giftcard.example/problems/invalid-financial-history-query");

    private sealed record FinancialHistoryFilters(
        string? Category,
        string? Operation,
        string? Currency,
        string? Reference,
        DateTimeOffset? OccurredFromUtc,
        DateTimeOffset? OccurredBeforeUtc);

    private static async Task<IResult> GetPlatformPaymentsAsync(
        int? limit,
        string? cursor,
        string? storeReference,
        string? state,
        string? currency,
        string? reference,
        DateOnly? occurredFrom,
        DateOnly? occurredThrough,
        HttpContext context,
        BackendGateway backend,
        PortalSessionManager sessions,
        CancellationToken cancellationToken)
    {
        if (limit is <= 0 or > 50)
        {
            throw InvalidPaymentReportQuery(
                "Choose a payment page size between 1 and 50.");
        }

        var filters = NormalizePaymentReportFilters(
            storeReference,
            state,
            currency,
            reference,
            occurredFrom,
            occurredThrough);
        var session = await RequireSessionAsync(context, sessions, cancellationToken);
        try
        {
            var (_, report) = await backend.GetPlatformPaymentReportAsync(
                session,
                limit ?? 20,
                cursor,
                filters.StoreReference,
                filters.State,
                filters.Currency,
                filters.Reference,
                filters.OccurredFromUtc,
                filters.OccurredBeforeUtc,
                cancellationToken);
            return Results.Ok(report.ToPortalResponse());
        }
        catch (ApiException exception) when (
            exception.StatusCode == StatusCodes.Status400BadRequest)
        {
            throw InvalidPaymentReportQuery(
                "The payment filters or result page are no longer valid. Review the filters and search again.");
        }
        catch (ApiException exception) when (
            exception.StatusCode == StatusCodes.Status403Forbidden)
        {
            throw Forbidden();
        }
    }

    private static async Task<IResult> GetPlatformPaymentReceiptAsync(
        Guid paymentProvisionId,
        HttpContext context,
        BackendGateway backend,
        PortalSessionManager sessions,
        CancellationToken cancellationToken)
    {
        if (paymentProvisionId == Guid.Empty)
        {
            throw InvalidPaymentReportQuery(
                "Open a payment returned by the current report.");
        }

        var session = await RequireSessionAsync(context, sessions, cancellationToken);
        try
        {
            var (_, receipt) = await backend.GetPlatformPaymentReceiptAsync(
                session,
                paymentProvisionId,
                cancellationToken);
            return Results.Ok(receipt.ToPortalResponse());
        }
        catch (ApiException exception) when (
            exception.StatusCode == StatusCodes.Status403Forbidden)
        {
            throw Forbidden();
        }
        catch (ApiException exception) when (
            exception.StatusCode == StatusCodes.Status404NotFound)
        {
            throw new PortalProblemException(
                StatusCodes.Status404NotFound,
                "That payment is no longer available in the report.",
                "https://giftcard.example/problems/payment-report-not-found");
        }
    }

    private static PaymentReportFilters NormalizePaymentReportFilters(
        string? storeReference,
        string? state,
        string? currency,
        string? reference,
        DateOnly? occurredFrom,
        DateOnly? occurredThrough)
    {
        var normalizedStore = PaymentText(storeReference, 64, "Store reference")
            ?.ToUpperInvariant();
        var normalizedState = PaymentText(state, 16, "Payment state");
        if (normalizedState is not null
            && !PaymentStates.TryGetValue(normalizedState, out normalizedState))
        {
            throw InvalidPaymentReportQuery(
                "Choose Active, Confirmed, Cancelled, or Expired.");
        }

        var normalizedCurrency = PaymentText(currency, 3, "Currency")
            ?.ToUpperInvariant();
        if (normalizedCurrency is not null
            && (normalizedCurrency.Length != 3
                || !normalizedCurrency.All(char.IsAsciiLetter)))
        {
            throw InvalidPaymentReportQuery(
                "Currency must be a three-letter code.");
        }

        var normalizedReference = PaymentText(reference, 200, "Reference");
        if (occurredFrom is not null
            && occurredThrough is not null
            && occurredFrom > occurredThrough)
        {
            throw InvalidPaymentReportQuery(
                "The from date cannot be later than the through date.");
        }

        if (occurredThrough == DateOnly.MaxValue)
        {
            throw InvalidPaymentReportQuery(
                "The through date is outside the supported range.");
        }

        return new PaymentReportFilters(
            normalizedStore,
            normalizedState,
            normalizedCurrency,
            normalizedReference,
            occurredFrom is null
                ? null
                : new DateTimeOffset(
                    occurredFrom.Value.ToDateTime(TimeOnly.MinValue),
                    TimeSpan.Zero),
            occurredThrough is null
                ? null
                : new DateTimeOffset(
                    occurredThrough.Value.AddDays(1).ToDateTime(TimeOnly.MinValue),
                    TimeSpan.Zero));
    }

    private static string? PaymentText(
        string? value,
        int maximumLength,
        string field)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        var normalized = value.Trim();
        if (normalized.Length > maximumLength)
        {
            throw InvalidPaymentReportQuery(
                $"{field} must be at most {maximumLength} characters.");
        }

        return normalized;
    }

    private static PortalProblemException InvalidPaymentReportQuery(string title) =>
        new(
            StatusCodes.Status400BadRequest,
            title,
            "https://giftcard.example/problems/invalid-payment-report-query");

    private sealed record PaymentReportFilters(
        string? StoreReference,
        string? State,
        string? Currency,
        string? Reference,
        DateTimeOffset? OccurredFromUtc,
        DateTimeOffset? OccurredBeforeUtc);

    private static async Task<IResult> GetFinancialReconciliationAsync(
        HttpContext context,
        BackendGateway backend,
        PortalSessionManager sessions,
        CancellationToken cancellationToken)
    {
        var session = await RequireFinanceSessionAsync(
            context,
            sessions,
            cancellationToken);
        try
        {
            var (_, reconciliation) = await backend.GetFinancialReconciliationAsync(
                session,
                session.SelectedTenantRootOrganizationId!.Value,
                cancellationToken);
            return Results.Ok(reconciliation.ToPortalResponse());
        }
        catch (ApiException exception) when (
            exception.StatusCode == StatusCodes.Status403Forbidden)
        {
            throw Forbidden();
        }
    }

    private static async Task<IResult> GetOrganizationAuditRecordsAsync(
        int? limit,
        string? cursor,
        string? operation,
        string? outcome,
        string? correlationId,
        HttpContext context,
        BackendGateway backend,
        PortalSessionManager sessions,
        CancellationToken cancellationToken)
    {
        var query = NormalizeAuditQuery(
            limit,
            cursor,
            operation,
            outcome,
            correlationId);
        var session = await RequireOrganizationSessionAsync(
            context,
            sessions,
            cancellationToken);
        return await GetAuditRecordsCoreAsync(
            session,
            session.SelectedOrganizationId!.Value,
            session.SelectedOrganizationId,
            query,
            backend,
            cancellationToken);
    }

    private static async Task<IResult> GetPlatformAuditRecordsAsync(
        Guid organizationId,
        int? limit,
        string? cursor,
        string? operation,
        string? outcome,
        string? correlationId,
        HttpContext context,
        BackendGateway backend,
        PortalSessionManager sessions,
        CancellationToken cancellationToken)
    {
        var query = NormalizeAuditQuery(
            limit,
            cursor,
            operation,
            outcome,
            correlationId);
        var session = await RequireSessionAsync(context, sessions, cancellationToken);
        return await GetAuditRecordsCoreAsync(
            session,
            organizationId,
            null,
            query,
            backend,
            cancellationToken);
    }

    private static async Task<IResult> GetAuditRecordsCoreAsync(
        PortalSession session,
        Guid organizationId,
        Guid? organizationContextId,
        AuditQuery query,
        BackendGateway backend,
        CancellationToken cancellationToken)
    {
        try
        {
            var (_, audit) = await backend.GetAuditRecordsAsync(
                session,
                organizationId,
                organizationContextId,
                query.Limit,
                query.Cursor,
                query.Operation,
                query.Outcome,
                query.CorrelationId,
                cancellationToken);
            return Results.Ok(audit.ToPortalResponse());
        }
        catch (ApiException exception) when (
            exception.StatusCode == StatusCodes.Status400BadRequest)
        {
            throw new PortalProblemException(
                StatusCodes.Status400BadRequest,
                "The audit filters or result page are no longer valid. Review the filters and search again.",
                "https://giftcard.example/problems/invalid-audit-query");
        }
        catch (ApiException exception) when (
            exception.StatusCode == StatusCodes.Status403Forbidden)
        {
            throw Forbidden();
        }
    }

    private static AuditQuery NormalizeAuditQuery(
        int? limit,
        string? cursor,
        string? operation,
        string? outcome,
        string? correlationId)
    {
        var normalizedLimit = limit ?? 25;
        if (normalizedLimit is < 1 or > 50)
        {
            throw InvalidAuditQuery("Audit page size must be between 1 and 50.");
        }

        var normalizedCursor = string.IsNullOrWhiteSpace(cursor)
            ? null
            : cursor.Trim();
        if (normalizedCursor?.Length > 256)
        {
            throw InvalidAuditQuery("The audit result page is no longer valid.");
        }

        var normalizedOperation = string.IsNullOrWhiteSpace(operation)
            ? null
            : operation.Trim();
        if (normalizedOperation?.Length > 128)
        {
            throw InvalidAuditQuery(
                "Operation must be at most 128 characters.");
        }

        AuditOutcome? normalizedOutcome = outcome?.Trim().ToLowerInvariant() switch
        {
            null or "" => null,
            "success" => (AuditOutcome)1,
            "failure" => (AuditOutcome)2,
            _ => throw InvalidAuditQuery("Choose Success or Failure."),
        };

        Guid? normalizedCorrelationId = null;
        if (!string.IsNullOrWhiteSpace(correlationId))
        {
            if (!Guid.TryParse(correlationId.Trim(), out var parsedCorrelationId)
                || parsedCorrelationId == Guid.Empty)
            {
                throw InvalidAuditQuery(
                    "Enter a valid correlation reference.");
            }

            normalizedCorrelationId = parsedCorrelationId;
        }

        return new AuditQuery(
            normalizedLimit,
            normalizedCursor,
            normalizedOperation,
            normalizedOutcome,
            normalizedCorrelationId);
    }

    private static PortalProblemException InvalidAuditQuery(string title) =>
        new(
            StatusCodes.Status400BadRequest,
            title,
            "https://giftcard.example/problems/invalid-audit-query");

    private sealed record AuditQuery(
        int Limit,
        string? Cursor,
        string? Operation,
        AuditOutcome? Outcome,
        Guid? CorrelationId);

    private static async Task<PortalSession> RequireSessionAsync(
        HttpContext context,
        PortalSessionManager sessions,
        CancellationToken cancellationToken) =>
        await sessions.FindAsync(context, cancellationToken)
        ?? throw new PortalSessionExpiredException();

    private static async Task<PortalSession> RequireFinanceSessionAsync(
        HttpContext context,
        PortalSessionManager sessions,
        CancellationToken cancellationToken)
    {
        var session = await RequireSessionAsync(context, sessions, cancellationToken);
        if (session.SelectedOrganizationId is null
            || session.SelectedTenantRootOrganizationId is null)
        {
            throw new PortalProblemException(
                StatusCodes.Status409Conflict,
                "Choose an organization before opening Finance.",
                "https://giftcard.example/problems/organization-context-required");
        }

        return session;
    }

    private static async Task<PortalSession> RequireOrganizationSessionAsync(
        HttpContext context,
        PortalSessionManager sessions,
        CancellationToken cancellationToken)
    {
        var session = await RequireSessionAsync(context, sessions, cancellationToken);
        if (session.SelectedOrganizationId is null)
        {
            throw new PortalProblemException(
                StatusCodes.Status409Conflict,
                "Choose an organization before opening the Organization workspace.",
                "https://giftcard.example/problems/organization-context-required");
        }

        return session;
    }

    private static async Task<PortalSession> RequireGiftCardSessionAsync(
        HttpContext context,
        PortalSessionManager sessions,
        CancellationToken cancellationToken)
    {
        var session = await RequireSessionAsync(context, sessions, cancellationToken);
        if (session.SelectedOrganizationId is null)
        {
            throw new PortalProblemException(
                StatusCodes.Status409Conflict,
                "Choose an organization before opening the Cards workspace.",
                "https://giftcard.example/problems/organization-context-required");
        }

        return session;
    }

    private static PortalProblemException Forbidden() =>
        new(
            StatusCodes.Status403Forbidden,
            "You do not have access to complete this action.",
            "https://giftcard.example/problems/forbidden");

    private static PortalProblemException InvalidFundingIntent() =>
        new(
            StatusCodes.Status400BadRequest,
            "Enter a valid amount, currency, and business reference, then review the allocation again.",
            "https://giftcard.example/problems/invalid-funding-intent");

    private static PortalProblemException InvalidGiftCardIntent() =>
        new(
            StatusCodes.Status400BadRequest,
            "Enter a valid amount, currency, expiration, and business reference, then review the issuance again.",
            "https://giftcard.example/problems/invalid-gift-card-intent");

    private static PortalProblemException InvalidGiftCardSelection() =>
        new(
            StatusCodes.Status400BadRequest,
            "Choose a gift card from the current inventory.",
            "https://giftcard.example/problems/invalid-gift-card-selection");

    private static PortalProblemException InvalidGiftCardLifecycleIntent() =>
        new(
            StatusCodes.Status400BadRequest,
            "Enter a reason and review a supported lifecycle action again.",
            "https://giftcard.example/problems/invalid-gift-card-lifecycle-intent");

    private static PortalProblemException GiftCardNotFound() =>
        new(
            StatusCodes.Status404NotFound,
            "That gift card is no longer available in the selected organization.",
            "https://giftcard.example/problems/gift-card-not-found");

    private static bool TryParseContactType(
        string? value,
        out RecipientContactType contactType)
    {
        contactType = value?.Trim().ToLowerInvariant() switch
        {
            "email" => (RecipientContactType)1,
            "phone" => (RecipientContactType)2,
            _ => default,
        };
        return (int)contactType is 1 or 2;
    }

    private static PortalProblemException InvalidGiftCardDistributionIntent() =>
        new(
            StatusCodes.Status400BadRequest,
            "Choose email or phone, enter the recipient contact and business reference, then review the delivery again.",
            "https://giftcard.example/problems/invalid-gift-card-distribution-intent");

    private static PortalProblemException GiftCardDistributionConflict(
        ApiException exception)
    {
        var code = exception is ApiException<ProblemDetails> problemException &&
            problemException.Result.AdditionalProperties.TryGetValue(
                "code",
                out var value)
            ? value switch
            {
                string text => text,
                JsonElement { ValueKind: JsonValueKind.String } element =>
                    element.GetString(),
                _ => null,
            }
            : null;

        var (title, type) = code switch
        {
            "gift_card.not_yet_valid" => (
                "This gift card is not yet valid. Check its valid-from time before delivering it.",
                "gift-card-not-yet-valid"),
            "gift_card.expired" => (
                "This gift card has expired and can no longer be delivered.",
                "gift-card-expired"),
            "gift_card.distribution.ineligible" or
            "distribution.gift_card.ineligible" => (
                "This gift card is no longer available for distribution from the selected organization.",
                "gift-card-distribution-ineligible"),
            "distribution.idempotency_key.reused" => (
                "This delivery was already submitted with different details. Return to inventory and start a new delivery.",
                "gift-card-distribution-intent-reused"),
            "distribution.concurrent_conflict" => (
                "Another distribution changed this gift card at the same time. Refresh inventory before trying again.",
                "gift-card-distribution-concurrent-conflict"),
            _ => (
                "The card changed or this delivery intent conflicts with an existing operation. Refresh inventory and review a new delivery.",
                "gift-card-distribution-conflict"),
        };

        return new PortalProblemException(
            StatusCodes.Status409Conflict,
            title,
            $"https://giftcard.example/problems/{type}");
    }

    private static PortalProblemException InvalidBulkGiftCardBatchIntent() =>
        new(
            StatusCodes.Status400BadRequest,
            "Review a batch with 1 to 2,000 complete, uniquely referenced delivery rows.",
            "https://giftcard.example/problems/invalid-gift-card-batch-intent");

    private static PortalProblemException InvalidBulkGiftCardBatchSelection() =>
        new(
            StatusCodes.Status400BadRequest,
            "Open a batch returned by the current Cards workspace.",
            "https://giftcard.example/problems/invalid-gift-card-batch-selection");
}
