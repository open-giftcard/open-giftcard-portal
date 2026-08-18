using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace GiftCardPortal.Bff.Tests;

public sealed class TeamAdministrationTests
{
    private static readonly string[] DuplicatePermissions =
    [
        "organization.gift_cards.issue",
        "organization.gift_cards.issue",
    ];

    [Fact]
    public async Task OrganizationRosterUsesSelectedContextAndHidesBackendAuthorityIds()
    {
        await using var factory = new TestApplicationFactory();
        using var client = factory.CreateCookieClient();
        var token = await LoginAsync(client);
        await SelectOrganizationAsync(client, token);

        using var response = await client.GetAsync("/bff/organization/team");
        var body = await response.Content.ReadAsStringAsync();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.DoesNotContain("organizationId", body, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("userId", body, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("operator@example.test", body, StringComparison.Ordinal);
        AssertRequestHeader(
            factory,
            $"/api/v1/organizations/{FakeBackendHandler.OrganizationId}/memberships",
            FakeBackendHandler.OrganizationId.ToString());
    }

    [Fact]
    public async Task PlatformRosterDoesNotSendAnOrganizationContextHeader()
    {
        await using var factory = new TestApplicationFactory();
        factory.Backend.UsePlatformContext = true;
        using var client = factory.CreateCookieClient();
        await LoginAsync(client);

        using var response = await client.GetAsync(
            $"/bff/platform/organizations/{FakeBackendHandler.OrganizationId}/team");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        AssertRequestHeader(
            factory,
            $"/api/v1/organizations/{FakeBackendHandler.OrganizationId}/memberships",
            null);
    }

    [Fact]
    public async Task AddMemberAcceptsOnlyEmailAndDoesNotForwardAUserId()
    {
        await using var factory = new TestApplicationFactory();
        using var client = factory.CreateCookieClient();
        var token = await LoginAsync(client);
        await SelectOrganizationAsync(client, token);

        using var request = Unsafe(
            HttpMethod.Post,
            "/bff/organization/team",
            token,
            new { email = " operator@example.test " });
        using var response = await client.SendAsync(request);
        using var backendBody = JsonDocument.Parse(
            factory.Backend.LastTeamMemberRequestBody!);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.Equal(
            "operator@example.test",
            backendBody.RootElement.GetProperty("email").GetString());
        Assert.Equal(
            JsonValueKind.Null,
            backendBody.RootElement.GetProperty("userId").ValueKind);
    }

    [Fact]
    public async Task SelfDisableIsRejectedBeforeTheBackendMutation()
    {
        await using var factory = new TestApplicationFactory();
        using var client = factory.CreateCookieClient();
        var token = await LoginAsync(client);
        await SelectOrganizationAsync(client, token);

        using var request = Unsafe(
            HttpMethod.Post,
            $"/bff/organization/team/{FakeBackendHandler.CurrentMembershipId}/disable",
            token);
        using var response = await client.SendAsync(request);

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal(0, factory.Backend.TeamDisableCount);
    }

    [Fact]
    public async Task RoleOperationsAnchorAssignmentsToTheSelectedOrganization()
    {
        await using var factory = new TestApplicationFactory();
        using var client = factory.CreateCookieClient();
        var token = await LoginAsync(client);
        await SelectOrganizationAsync(client, token);

        using var createRole = Unsafe(
            HttpMethod.Post,
            "/bff/organization/roles",
            token,
            new { name = " Gift card operator " });
        using var createRoleResponse = await client.SendAsync(createRole);
        using var grant = Unsafe(
            HttpMethod.Post,
            $"/bff/organization/roles/{FakeBackendHandler.RoleId}/permissions",
            token,
            new
            {
                permissions = DuplicatePermissions,
            });
        using var grantResponse = await client.SendAsync(grant);
        using var assign = Unsafe(
            HttpMethod.Post,
            "/bff/organization/role-assignments",
            token,
            new
            {
                membershipId = FakeBackendHandler.TeamMembershipId,
                roleId = FakeBackendHandler.RoleId,
                scope = "Organization",
            });
        using var assignResponse = await client.SendAsync(assign);
        using var assignment = JsonDocument.Parse(
            factory.Backend.LastRoleAssignmentRequestBody!);
        using var permissions = JsonDocument.Parse(
            factory.Backend.LastRolePermissionsRequestBody!);
        var responseBody = await assignResponse.Content.ReadAsStringAsync();

        Assert.Equal(HttpStatusCode.Created, createRoleResponse.StatusCode);
        Assert.Equal(HttpStatusCode.OK, grantResponse.StatusCode);
        Assert.Equal(HttpStatusCode.Created, assignResponse.StatusCode);
        Assert.Equal(
            FakeBackendHandler.OrganizationId,
            assignment.RootElement.GetProperty("anchorOrganizationId").GetGuid());
        Assert.Equal(
            JsonValueKind.Null,
            assignment.RootElement.GetProperty("selectedOrganizationIds").ValueKind);
        Assert.Equal(1, assignment.RootElement.GetProperty("scope").GetInt32());
        Assert.Single(
            permissions.RootElement.GetProperty("permissions").EnumerateArray());
        Assert.DoesNotContain("assignmentId", responseBody, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("anchorOrganizationId", responseBody, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("organizationId", responseBody, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task UnsupportedAssignmentScopeIsRejectedBeforeBackendCall()
    {
        await using var factory = new TestApplicationFactory();
        using var client = factory.CreateCookieClient();
        var token = await LoginAsync(client);
        await SelectOrganizationAsync(client, token);

        using var request = Unsafe(
            HttpMethod.Post,
            "/bff/organization/role-assignments",
            token,
            new
            {
                membershipId = FakeBackendHandler.TeamMembershipId,
                roleId = FakeBackendHandler.RoleId,
                scope = "SelectedOrganizations",
            });
        using var response = await client.SendAsync(request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Null(factory.Backend.LastRoleAssignmentRequestBody);
    }

    [Theory]
    [InlineData(HttpStatusCode.BadRequest, "Review the team or role details")]
    [InlineData(HttpStatusCode.Forbidden, "You do not have access")]
    [InlineData(HttpStatusCode.NotFound, "is no longer available")]
    [InlineData(HttpStatusCode.Conflict, "state changed")]
    public async Task BackendTeamFailuresReturnSafePortalProblems(
        HttpStatusCode backendStatus,
        string expectedTitle)
    {
        await using var factory = new TestApplicationFactory();
        factory.Backend.RejectNextTeamOperationWith = backendStatus;
        using var client = factory.CreateCookieClient();
        var token = await LoginAsync(client);
        await SelectOrganizationAsync(client, token);

        using var response = await client.GetAsync("/bff/organization/team");
        var body = await response.Content.ReadAsStringAsync();

        Assert.Equal(backendStatus, response.StatusCode);
        Assert.Contains(expectedTitle, body, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("ApiException", body, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("stack", body, StringComparison.OrdinalIgnoreCase);
    }

    private static async Task<string> LoginAsync(HttpClient client)
    {
        var token = await AntiforgeryAsync(client);
        using var request = Unsafe(
            HttpMethod.Post,
            "/bff/auth/login",
            token,
            new
            {
                email = "staff@example.test",
                password = "correct-password",
            });
        using var response = await client.SendAsync(request);
        response.EnsureSuccessStatusCode();
        return token;
    }

    private static async Task SelectOrganizationAsync(HttpClient client, string token)
    {
        using var request = Unsafe(
            HttpMethod.Post,
            "/bff/organization-context",
            token,
            new { organizationId = FakeBackendHandler.OrganizationId });
        using var response = await client.SendAsync(request);
        response.EnsureSuccessStatusCode();
    }

    private static async Task<string> AntiforgeryAsync(HttpClient client)
    {
        using var response = await client.GetAsync("/bff/antiforgery");
        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        return body.GetProperty("token").GetString()!;
    }

    private static HttpRequestMessage Unsafe(
        HttpMethod method,
        string path,
        string token,
        object? body = null)
    {
        var request = new HttpRequestMessage(method, path);
        request.Headers.Add("Origin", "http://localhost");
        request.Headers.Add("X-CSRF-TOKEN", token);
        if (body is not null)
        {
            request.Content = JsonContent.Create(body);
        }

        return request;
    }

    private static void AssertRequestHeader(
        TestApplicationFactory factory,
        string path,
        string? expected)
    {
        var request = factory.Backend.Requests.Last(
            item => item.RequestUri?.AbsolutePath == path);
        var present = request.Headers.TryGetValues(
            "X-Organization-Id",
            out var values);
        if (expected is null)
        {
            Assert.False(present);
            return;
        }

        Assert.True(present);
        Assert.Equal(expected, Assert.Single(values!));
    }
}
