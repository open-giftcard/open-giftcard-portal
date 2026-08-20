using System.Globalization;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using GiftCardPortal.Bff.Configuration;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.HttpOverrides;

namespace GiftCardPortal.Bff.Tests;

public sealed class SecurityAndSessionTests
{
    [Fact]
    public async Task LoginRejectsMissingAntiforgeryToken()
    {
        await using var factory = new TestApplicationFactory();
        using var client = factory.CreateCookieClient();
        using var request = new HttpRequestMessage(HttpMethod.Post, "/bff/auth/login")
        {
            Content = JsonContent.Create(
                new
                {
                    email = "staff@example.test",
                    password = "correct-password",
                }),
        };
        request.Headers.Add("Origin", "http://localhost");

        using var response = await client.SendAsync(request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Empty(factory.Backend.Requests);
    }

    [Fact]
    public async Task LoginRejectsCrossOriginRequestEvenWithAntiforgery()
    {
        await using var factory = new TestApplicationFactory();
        using var client = factory.CreateCookieClient();
        var token = await GetAntiforgeryTokenAsync(client);
        using var request = CreateUnsafeRequest(
            HttpMethod.Post,
            "/bff/auth/login",
            token,
            new
            {
                email = "staff@example.test",
                password = "correct-password",
            },
            "https://attacker.example");

        using var response = await client.SendAsync(request);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Empty(factory.Backend.Requests);
    }

    [Fact]
    public async Task LoginCreatesOpaqueHttpOnlySessionWithoutReturningTokens()
    {
        await using var factory = new TestApplicationFactory();
        using var client = factory.CreateCookieClient();
        var token = await GetAntiforgeryTokenAsync(client);
        using var request = CreateUnsafeRequest(
            HttpMethod.Post,
            "/bff/auth/login",
            token,
            new
            {
                email = "staff@example.test",
                password = "correct-password",
            });

        using var response = await client.SendAsync(request);
        var body = await response.Content.ReadAsStringAsync();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.DoesNotContain("access-one", body, StringComparison.Ordinal);
        Assert.DoesNotContain("refresh-one", body, StringComparison.Ordinal);
        var cookie = response.Headers.GetValues("Set-Cookie")
            .Single(value => value.StartsWith("giftcard_portal_dev=", StringComparison.Ordinal));
        Assert.Contains("httponly", cookie, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("samesite=lax", cookie, StringComparison.OrdinalIgnoreCase);

        var session = Assert.Single(factory.Sessions.Sessions);
        Assert.DoesNotContain("access-one", session.ProtectedAccessToken, StringComparison.Ordinal);
        Assert.DoesNotContain("refresh-one", session.ProtectedRefreshToken, StringComparison.Ordinal);
    }

    [Fact]
    public async Task LoginForwardsObservedAddressAndDiscardsBrowserForwardingHeader()
    {
        await using var factory = new TestApplicationFactory();
        using var client = factory.CreateCookieClient();
        var token = await GetAntiforgeryTokenAsync(client);
        using var request = CreateUnsafeRequest(
            HttpMethod.Post,
            "/bff/auth/login",
            token,
            new
            {
                email = "staff@example.test",
                password = "correct-password",
            });
        request.Headers.TryAddWithoutValidation("X-Forwarded-For", "198.51.100.99");

        using var response = await client.SendAsync(request);

        response.EnsureSuccessStatusCode();
        var backendLogin = factory.Backend.Requests.Single(candidate =>
            candidate.RequestUri?.AbsolutePath == "/api/v1/auth/login");
        var forwardedAddress = Assert.Single(
            backendLogin.Headers.GetValues("X-Forwarded-For"));
        Assert.Equal(
            TestApplicationFactory.ObservedClientAddress.ToString(),
            forwardedAddress);
        Assert.NotEqual("198.51.100.99", forwardedAddress);
    }

    [Fact]
    public void TrustedIngressConfigurationAllowsExactlyOneForwardedHop()
    {
        var options = new ForwardedHeadersOptions();
        DeploymentSafety.ConfigureForwardedHeaders(
            options,
            [TestApplicationFactory.ObservedClientAddress]);

        Assert.Equal(1, options.ForwardLimit);
        Assert.Contains(TestApplicationFactory.ObservedClientAddress, options.KnownProxies);
        Assert.Empty(options.KnownIPNetworks);
        Assert.True(options.ForwardedHeaders.HasFlag(ForwardedHeaders.XForwardedFor));
        Assert.True(options.ForwardedHeaders.HasFlag(ForwardedHeaders.XForwardedProto));
    }

    [Fact]
    public async Task HealthSeparatesLivenessFromSessionStoreReadiness()
    {
        await using var factory = new TestApplicationFactory();
        using var client = factory.CreateCookieClient();

        using var live = await client.GetAsync("/health");
        using var ready = await client.GetAsync("/health/ready");
        factory.Sessions.IsReady = false;
        using var unavailable = await client.GetAsync("/health/ready");

        Assert.Equal(HttpStatusCode.OK, live.StatusCode);
        Assert.Equal(HttpStatusCode.OK, ready.StatusCode);
        Assert.Equal(HttpStatusCode.ServiceUnavailable, unavailable.StatusCode);
        Assert.DoesNotContain(
            "connection",
            await unavailable.Content.ReadAsStringAsync(),
            StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task OrganizationContextComesFromListAndIsVerifiedByMe()
    {
        await using var factory = new TestApplicationFactory();
        using var client = factory.CreateCookieClient();
        var token = await LoginAsync(client);

        using var organizations = await client.GetAsync("/bff/organizations");
        Assert.Equal(HttpStatusCode.OK, organizations.StatusCode);

        using var selectRequest = CreateUnsafeRequest(
            HttpMethod.Post,
            "/bff/organization-context",
            token,
            new
            {
                organizationId = FakeBackendHandler.OrganizationId,
            });
        using var selected = await client.SendAsync(selectRequest);
        var selectedBody = await selected.Content.ReadFromJsonAsync<JsonElement>();

        Assert.Equal(HttpStatusCode.OK, selected.StatusCode);
        Assert.Equal(
            FakeBackendHandler.OrganizationId,
            selectedBody.GetProperty("user")
                .GetProperty("organizationContext")
                .GetProperty("organization")
                .GetProperty("id")
                .GetGuid());

        var organizationListCall = factory.Backend.Requests
            .Last(request =>
                request.RequestUri?.AbsolutePath == "/api/v1/me/organizations");
        Assert.False(organizationListCall.Headers.Contains("X-Organization-Id"));
        var contextCall = factory.Backend.Requests
            .Last(request => request.RequestUri?.AbsolutePath == "/api/v1/me");
        Assert.Equal(
            FakeBackendHandler.OrganizationId.ToString(),
            contextCall.Headers.GetValues("X-Organization-Id").Single());
    }

    [Fact]
    public async Task UnauthorizedBackendCallRefreshesOnceAndRetries()
    {
        await using var factory = new TestApplicationFactory();
        using var client = factory.CreateCookieClient();
        await LoginAsync(client);
        factory.Backend.UnauthorizedNextCurrentUserRequest = true;

        using var response = await client.GetAsync("/bff/session");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(1, factory.Backend.RefreshCount);
        var authorization = factory.Backend.Requests
            .Last(request => request.RequestUri?.AbsolutePath == "/api/v1/me")
            .Headers.Authorization;
        Assert.Equal("access-two", authorization?.Parameter);
    }

    [Fact]
    public async Task ConcurrentExpiringRequestsSpendOneRefreshToken()
    {
        await using var factory = new TestApplicationFactory();
        using var client = factory.CreateCookieClient();
        await LoginAsync(client);
        var stored = Assert.Single(factory.Sessions.Sessions);
        await factory.Sessions.UpsertAsync(
            stored with { AccessTokenExpiresAtUtc = DateTimeOffset.UtcNow.AddMinutes(-1) },
            CancellationToken.None);
        factory.Backend.RefreshDelay = TimeSpan.FromMilliseconds(100);

        var responses = await Task.WhenAll(
            client.GetAsync("/bff/session"),
            client.GetAsync("/bff/session"));

        try
        {
            Assert.All(responses, response => Assert.Equal(HttpStatusCode.OK, response.StatusCode));
            Assert.Equal(1, factory.Backend.RefreshCount);
        }
        finally
        {
            foreach (var response in responses)
            {
                response.Dispose();
            }
        }
    }

    [Fact]
    public async Task ForbiddenResponseKeepsThePortalSession()
    {
        await using var factory = new TestApplicationFactory();
        using var client = factory.CreateCookieClient();
        await LoginAsync(client);
        factory.Backend.ForbidNextCurrentUserRequest = true;

        using var forbidden = await client.GetAsync("/bff/session");
        using var retry = await client.GetAsync("/bff/session");

        Assert.Equal(HttpStatusCode.Forbidden, forbidden.StatusCode);
        Assert.Equal(HttpStatusCode.OK, retry.StatusCode);
        Assert.Single(factory.Sessions.Sessions);
    }

    [Fact]
    public async Task PlatformDirectoryForwardsFiltersWithoutOrganizationContext()
    {
        await using var factory = new TestApplicationFactory();
        factory.Backend.UsePlatformContext = true;
        using var client = factory.CreateCookieClient();
        await LoginAsync(client);

        using var session = await client.GetAsync("/bff/session");
        var sessionBody = await session.Content.ReadFromJsonAsync<JsonElement>();
        using var directory = await client.GetAsync(
            "/bff/platform/organizations?search=Demo%20North&status=Active&limit=20&offset=40");
        var directoryBody = await directory.Content.ReadFromJsonAsync<JsonElement>();

        Assert.Equal(HttpStatusCode.OK, session.StatusCode);
        Assert.Equal(
            "Platform",
            sessionBody.GetProperty("user").GetProperty("contextType").GetString());
        Assert.Contains(
            "platform.organizations.view",
            sessionBody.GetProperty("user")
                .GetProperty("platformPermissions")
                .EnumerateArray()
                .Select(item => item.GetString()));
        Assert.Equal(HttpStatusCode.OK, directory.StatusCode);
        Assert.Equal(
            "Test Organization",
            directoryBody.GetProperty("items")[0].GetProperty("name").GetString());

        var backendCall = factory.Backend.Requests.Last(request =>
            request.RequestUri?.AbsolutePath == "/api/v1/organizations");
        Assert.False(backendCall.Headers.Contains("X-Organization-Id"));
        Assert.Equal(
            "?search=Demo%20North&status=Active&limit=20&offset=40",
            backendCall.RequestUri?.Query);
    }

    [Fact]
    public async Task ForbiddenPlatformDirectoryKeepsThePortalSession()
    {
        await using var factory = new TestApplicationFactory();
        factory.Backend.UsePlatformContext = true;
        using var client = factory.CreateCookieClient();
        await LoginAsync(client);
        factory.Backend.ForbidNextPlatformOrganizationsRequest = true;

        using var forbidden = await client.GetAsync("/bff/platform/organizations");
        using var retry = await client.GetAsync("/bff/platform/organizations");

        Assert.Equal(HttpStatusCode.Forbidden, forbidden.StatusCode);
        Assert.Equal(HttpStatusCode.OK, retry.StatusCode);
        Assert.Single(factory.Sessions.Sessions);
    }

    [Fact]
    public async Task PlatformOrganizationDetailHasNoOrganizationContextHeader()
    {
        await using var factory = new TestApplicationFactory();
        factory.Backend.UsePlatformContext = true;
        using var client = factory.CreateCookieClient();
        await LoginAsync(client);

        using var response = await client.GetAsync(
            $"/bff/platform/organizations/{FakeBackendHandler.OrganizationId}");
        var body = await response.Content.ReadAsStringAsync();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Contains("\"name\":\"Test Organization\"", body);
        var backendCall = factory.Backend.Requests.Last(request =>
            request.RequestUri?.AbsolutePath
                == $"/api/v1/organizations/{FakeBackendHandler.OrganizationId}");
        Assert.False(backendCall.Headers.Contains("X-Organization-Id"));
    }

    [Fact]
    public async Task PlatformFundingUsesSafeShapesHiddenIdempotencyAndNoTenantHeader()
    {
        await using var factory = new TestApplicationFactory();
        factory.Backend.UsePlatformContext = true;
        using var client = factory.CreateCookieClient();
        var token = await LoginAsync(client);
        var operationId = Guid.Parse("018f5db0-115b-7a69-84a0-991b1cd18d97");

        using var balances = await client.GetAsync(
            $"/bff/platform/organizations/{FakeBackendHandler.OrganizationId}/funding/balances");
        using var history = await client.GetAsync(
            $"/bff/platform/organizations/{FakeBackendHandler.OrganizationId}/funding/allocations?limit=20");
        using var allocationRequest = CreateUnsafeRequest(
            HttpMethod.Post,
            $"/bff/platform/organizations/{FakeBackendHandler.OrganizationId}/funding/allocations",
            token,
            new
            {
                amount = "250.00",
                currency = "TRY",
                businessReference = "CONTRACT-42",
                operationId,
            });
        using var allocated = await client.SendAsync(allocationRequest);
        using var reversalRequest = CreateUnsafeRequest(
            HttpMethod.Post,
            $"/bff/platform/funding/allocations/{FakeBackendHandler.CorporateCreditAllocationId}/reversal",
            token,
            new
            {
                reason = "Duplicate contract",
                operationId,
            });
        using var reversed = await client.SendAsync(reversalRequest);
        var historyBody = await history.Content.ReadAsStringAsync();
        var allocatedBody = await allocated.Content.ReadAsStringAsync();
        var reversedBody = await reversed.Content.ReadAsStringAsync();

        Assert.Equal(HttpStatusCode.OK, balances.StatusCode);
        Assert.Equal(HttpStatusCode.OK, history.StatusCode);
        Assert.Equal(HttpStatusCode.OK, allocated.StatusCode);
        Assert.Equal(HttpStatusCode.OK, reversed.StatusCode);
        Assert.Contains("\"businessReference\":\"CONTRACT-42\"", historyBody);
        Assert.Contains(
            $"\"id\":\"{FakeBackendHandler.CorporateCreditAllocationId}\"",
            historyBody);
        foreach (var body in new[] { historyBody, allocatedBody, reversedBody })
        {
            Assert.DoesNotContain("organizationId", body, StringComparison.Ordinal);
            Assert.DoesNotContain("ledgerTransactionId", body, StringComparison.Ordinal);
            Assert.DoesNotContain("allocatedByUserId", body, StringComparison.Ordinal);
            Assert.DoesNotContain("idempotencyKey", body, StringComparison.Ordinal);
        }

        Assert.Contains(
            $"\"organizationId\":\"{FakeBackendHandler.OrganizationId}\"",
            factory.Backend.LastFundingAllocationRequestBody);
        Assert.Contains(
            $"\"idempotencyKey\":\"portal-allocation-{operationId:N}\"",
            factory.Backend.LastFundingAllocationRequestBody);
        Assert.Contains(
            $"\"idempotencyKey\":\"portal-reversal-{operationId:N}\"",
            factory.Backend.LastFundingReversalRequestBody);

        var fundingCalls = factory.Backend.Requests.Where(request =>
            request.RequestUri?.AbsolutePath.Contains(
                "corporate-credits",
                StringComparison.Ordinal) == true);
        Assert.All(
            fundingCalls,
            request => Assert.False(request.Headers.Contains("X-Organization-Id")));
    }

    [Theory]
    [InlineData(HttpStatusCode.BadRequest, "valid amount")]
    [InlineData(HttpStatusCode.Conflict, "already used")]
    public async Task PlatformFundingAllocationMapsBackendRejectionsSafely(
        HttpStatusCode backendStatus,
        string expectedMessage)
    {
        await using var factory = new TestApplicationFactory();
        factory.Backend.UsePlatformContext = true;
        factory.Backend.RejectNextFundingAllocationWith = backendStatus;
        using var client = factory.CreateCookieClient();
        var token = await LoginAsync(client);
        using var request = CreateUnsafeRequest(
            HttpMethod.Post,
            $"/bff/platform/organizations/{FakeBackendHandler.OrganizationId}/funding/allocations",
            token,
            new
            {
                amount = "250.00",
                currency = "TRY",
                businessReference = "CONTRACT-42",
                operationId = Guid.NewGuid(),
            });

        using var response = await client.SendAsync(request);
        var body = await response.Content.ReadAsStringAsync();

        Assert.Equal(backendStatus, response.StatusCode);
        Assert.Contains(expectedMessage, body, StringComparison.Ordinal);
        Assert.DoesNotContain("ApiException", body, StringComparison.Ordinal);
        Assert.Single(factory.Sessions.Sessions);
    }

    [Theory]
    [InlineData(HttpStatusCode.NotFound, "no longer available")]
    [InlineData(HttpStatusCode.Conflict, "already reversed")]
    public async Task PlatformFundingReversalMapsBackendRejectionsSafely(
        HttpStatusCode backendStatus,
        string expectedMessage)
    {
        await using var factory = new TestApplicationFactory();
        factory.Backend.UsePlatformContext = true;
        factory.Backend.RejectNextFundingReversalWith = backendStatus;
        using var client = factory.CreateCookieClient();
        var token = await LoginAsync(client);
        using var request = CreateUnsafeRequest(
            HttpMethod.Post,
            $"/bff/platform/funding/allocations/{FakeBackendHandler.CorporateCreditAllocationId}/reversal",
            token,
            new
            {
                reason = "Duplicate contract",
                operationId = Guid.NewGuid(),
            });

        using var response = await client.SendAsync(request);
        var body = await response.Content.ReadAsStringAsync();

        Assert.Equal(backendStatus, response.StatusCode);
        Assert.Contains(expectedMessage, body, StringComparison.Ordinal);
        Assert.DoesNotContain("ApiException", body, StringComparison.Ordinal);
        Assert.Single(factory.Sessions.Sessions);
    }

    [Fact]
    public async Task GiftCardInventoryAndIssuanceUseSelectedContextAndSafeShapes()
    {
        await using var factory = new TestApplicationFactory();
        using var client = factory.CreateCookieClient();
        var token = await LoginAsync(client);
        await SelectOrganizationAsync(client, token);
        var operationId = Guid.Parse("018f5dc3-a865-7c11-a2a0-8326b3b96f70");

        using var inventory = await client.GetAsync(
            "/bff/gift-cards/inventory?limit=20");
        using var issuanceRequest = CreateUnsafeRequest(
            HttpMethod.Post,
            "/bff/gift-cards",
            token,
            new
            {
                amount = "150.00",
                currency = "TRY",
                validFromUtc = "2026-08-01T09:00:00.000Z",
                expiresAtUtc = "2027-08-01T09:00:00.000Z",
                isTransferable = true,
                isDivisible = false,
                businessReference = "EMPLOYEE-AWARD-42",
                operationId,
            });
        using var issued = await client.SendAsync(issuanceRequest);
        var inventoryBody = await inventory.Content.ReadAsStringAsync();
        var issuedBody = await issued.Content.ReadAsStringAsync();

        Assert.Equal(HttpStatusCode.OK, inventory.StatusCode);
        Assert.Equal(HttpStatusCode.OK, issued.StatusCode);
        Assert.Contains("\"publicReference\":\"GC-0123456789ABCDEF0123\"", inventoryBody);
        Assert.Contains("\"businessReference\":\"EMPLOYEE-AWARD-42\"", issuedBody);
        Assert.Contains($"\"id\":\"{FakeBackendHandler.GiftCardId}\"", inventoryBody);
        foreach (var body in new[] { inventoryBody, issuedBody })
        {
            Assert.DoesNotContain("fundingOrganizationId", body, StringComparison.Ordinal);
            Assert.DoesNotContain("issuingOrganizationId", body, StringComparison.Ordinal);
            Assert.DoesNotContain("ownerOrganizationId", body, StringComparison.Ordinal);
            Assert.DoesNotContain("ownerUserId", body, StringComparison.Ordinal);
            Assert.DoesNotContain("ledgerAccountId", body, StringComparison.Ordinal);
            Assert.DoesNotContain(
                "issuanceLedgerTransactionId",
                body,
                StringComparison.Ordinal);
            Assert.DoesNotContain("sourceGiftCardId", body, StringComparison.Ordinal);
            Assert.DoesNotContain("rootGiftCardId", body, StringComparison.Ordinal);
            Assert.DoesNotContain(
                "distributionInvitationId",
                body,
                StringComparison.Ordinal);
            Assert.DoesNotContain("idempotencyKey", body, StringComparison.Ordinal);
            Assert.DoesNotContain("issuedByUserId", body, StringComparison.Ordinal);
            Assert.DoesNotContain("issuedByMembershipId", body, StringComparison.Ordinal);
        }

        Assert.Contains(
            $"\"idempotencyKey\":\"portal-gift-card-issue-{operationId:N}\"",
            factory.Backend.LastGiftCardIssuanceRequestBody);
        Assert.Contains(
            "\"validFromUtc\":\"2026-08-01T09:00:00+00:00\"",
            factory.Backend.LastGiftCardIssuanceRequestBody);

        var giftCardCalls = factory.Backend.Requests.Where(request =>
            request.RequestUri?.AbsolutePath.Contains(
                "/gift-cards",
                StringComparison.Ordinal) == true);
        Assert.All(
            giftCardCalls,
            request => Assert.Equal(
                FakeBackendHandler.OrganizationId.ToString(),
                request.Headers.GetValues("X-Organization-Id").Single()));
        Assert.All(
            giftCardCalls,
            request => Assert.Contains(
                FakeBackendHandler.OrganizationId.ToString(),
                request.RequestUri?.AbsolutePath,
                StringComparison.Ordinal));
    }

    [Theory]
    [InlineData(HttpStatusCode.BadRequest, "valid amount")]
    [InlineData(HttpStatusCode.Conflict, "state changed")]
    public async Task GiftCardIssuanceMapsBackendRejectionsSafely(
        HttpStatusCode backendStatus,
        string expectedMessage)
    {
        await using var factory = new TestApplicationFactory();
        factory.Backend.RejectNextGiftCardIssuanceWith = backendStatus;
        using var client = factory.CreateCookieClient();
        var token = await LoginAsync(client);
        await SelectOrganizationAsync(client, token);
        using var request = CreateUnsafeRequest(
            HttpMethod.Post,
            "/bff/gift-cards",
            token,
            new
            {
                amount = "150.00",
                currency = "TRY",
                validFromUtc = (string?)null,
                expiresAtUtc = "2027-08-01T09:00:00.000Z",
                isTransferable = false,
                isDivisible = false,
                businessReference = "EMPLOYEE-AWARD-42",
                operationId = Guid.NewGuid(),
            });

        using var response = await client.SendAsync(request);
        var body = await response.Content.ReadAsStringAsync();

        Assert.Equal(backendStatus, response.StatusCode);
        Assert.Contains(expectedMessage, body, StringComparison.Ordinal);
        Assert.DoesNotContain("ApiException", body, StringComparison.Ordinal);
        Assert.Single(factory.Sessions.Sessions);
    }

    [Theory]
    [InlineData(HttpStatusCode.BadRequest, "no longer valid")]
    [InlineData(HttpStatusCode.Forbidden, "do not have access")]
    public async Task GiftCardInventoryMapsBackendRejectionsSafely(
        HttpStatusCode backendStatus,
        string expectedMessage)
    {
        await using var factory = new TestApplicationFactory();
        factory.Backend.RejectNextGiftCardInventoryWith = backendStatus;
        using var client = factory.CreateCookieClient();
        var token = await LoginAsync(client);
        await SelectOrganizationAsync(client, token);

        using var response = await client.GetAsync(
            "/bff/gift-cards/inventory?limit=20&cursor=stale");
        var body = await response.Content.ReadAsStringAsync();

        Assert.Equal(backendStatus, response.StatusCode);
        Assert.Contains(expectedMessage, body, StringComparison.Ordinal);
        Assert.Single(factory.Sessions.Sessions);
    }

    [Fact]
    public async Task GiftCardLifecycleUsesSelectedContextHiddenIdentityAndSafeShapes()
    {
        await using var factory = new TestApplicationFactory();
        using var client = factory.CreateCookieClient();
        var token = await LoginAsync(client);
        await SelectOrganizationAsync(client, token);
        var operationId = Guid.Parse("018f5dc3-a865-7c11-a2a0-8326b3b96f76");

        using var history = await client.GetAsync(
            $"/bff/gift-cards/{FakeBackendHandler.GiftCardId}/lifecycle");
        using var lifecycleRequest = CreateUnsafeRequest(
            HttpMethod.Post,
            $"/bff/gift-cards/{FakeBackendHandler.GiftCardId}/lifecycle/cancel",
            token,
            new
            {
                reason = " Card reported missing ",
                operationId,
            });
        using var operation = await client.SendAsync(lifecycleRequest);
        var historyBody = await history.Content.ReadAsStringAsync();
        var operationBody = await operation.Content.ReadAsStringAsync();

        Assert.Equal(HttpStatusCode.OK, history.StatusCode);
        Assert.Equal(HttpStatusCode.OK, operation.StatusCode);
        Assert.Contains("\"action\":\"Suspend\"", historyBody);
        Assert.Contains("\"action\":\"Cancel\"", operationBody);
        Assert.Contains("\"previousState\":\"Active\"", operationBody);
        Assert.Contains("\"newState\":\"Cancelled\"", operationBody);
        Assert.Contains("\"returnedAmount\":150", operationBody);
        Assert.Contains("\"currency\":\"TRY\"", operationBody);
        Assert.Contains("\"publicReference\":\"GC-0123456789ABCDEF0123\"", historyBody);
        Assert.Contains($"\"id\":\"{FakeBackendHandler.GiftCardId}\"", historyBody);
        foreach (var body in new[] { historyBody, operationBody })
        {
            Assert.DoesNotContain("\"actor", body, StringComparison.Ordinal);
            Assert.DoesNotContain("membership", body, StringComparison.OrdinalIgnoreCase);
            Assert.DoesNotContain("correlation", body, StringComparison.OrdinalIgnoreCase);
            Assert.DoesNotContain("ledger", body, StringComparison.OrdinalIgnoreCase);
            Assert.DoesNotContain("idempotency", body, StringComparison.OrdinalIgnoreCase);
            Assert.DoesNotContain(
                "fundingOrganizationId",
                body,
                StringComparison.Ordinal);
            Assert.DoesNotContain(
                "issuingOrganizationId",
                body,
                StringComparison.Ordinal);
        }

        Assert.Contains(
            "\"reason\":\"Card reported missing\"",
            factory.Backend.LastGiftCardLifecycleRequestBody);
        Assert.Contains(
            $"\"idempotencyKey\":\"portal-gift-card-lifecycle-cancel-{operationId:N}\"",
            factory.Backend.LastGiftCardLifecycleRequestBody);

        var lifecycleCalls = factory.Backend.Requests.Where(request =>
            request.RequestUri?.AbsolutePath.Contains(
                $"/gift-cards/{FakeBackendHandler.GiftCardId}/lifecycle",
                StringComparison.Ordinal) == true);
        Assert.All(
            lifecycleCalls,
            request => Assert.Equal(
                FakeBackendHandler.OrganizationId.ToString(),
                request.Headers.GetValues("X-Organization-Id").Single()));
        Assert.All(
            lifecycleCalls,
            request => Assert.Contains(
                FakeBackendHandler.OrganizationId.ToString(),
                request.RequestUri?.AbsolutePath,
                StringComparison.Ordinal));
    }

    [Theory]
    [InlineData(HttpStatusCode.BadRequest, "Enter a reason")]
    [InlineData(HttpStatusCode.Forbidden, "do not have access")]
    [InlineData(HttpStatusCode.NotFound, "no longer available")]
    [InlineData(HttpStatusCode.Conflict, "changed")]
    public async Task GiftCardLifecycleMapsBackendRejectionsSafely(
        HttpStatusCode backendStatus,
        string expectedMessage)
    {
        await using var factory = new TestApplicationFactory();
        factory.Backend.RejectNextGiftCardLifecycleWith = backendStatus;
        using var client = factory.CreateCookieClient();
        var token = await LoginAsync(client);
        await SelectOrganizationAsync(client, token);
        using var request = CreateUnsafeRequest(
            HttpMethod.Post,
            $"/bff/gift-cards/{FakeBackendHandler.GiftCardId}/lifecycle/suspend",
            token,
            new
            {
                reason = "Security review",
                operationId = Guid.NewGuid(),
            });

        using var response = await client.SendAsync(request);
        var body = await response.Content.ReadAsStringAsync();

        Assert.Equal(backendStatus, response.StatusCode);
        Assert.Contains(expectedMessage, body, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("ApiException", body, StringComparison.Ordinal);
        Assert.Single(factory.Sessions.Sessions);
    }

    [Theory]
    [InlineData(HttpStatusCode.Forbidden, "do not have access")]
    [InlineData(HttpStatusCode.NotFound, "no longer available")]
    public async Task GiftCardLifecycleHistoryMapsBackendRejectionsSafely(
        HttpStatusCode backendStatus,
        string expectedMessage)
    {
        await using var factory = new TestApplicationFactory();
        factory.Backend.RejectNextGiftCardLifecycleHistoryWith = backendStatus;
        using var client = factory.CreateCookieClient();
        var token = await LoginAsync(client);
        await SelectOrganizationAsync(client, token);

        using var response = await client.GetAsync(
            $"/bff/gift-cards/{FakeBackendHandler.GiftCardId}/lifecycle");
        var body = await response.Content.ReadAsStringAsync();

        Assert.Equal(backendStatus, response.StatusCode);
        Assert.Contains(expectedMessage, body, StringComparison.OrdinalIgnoreCase);
        Assert.Single(factory.Sessions.Sessions);
    }

    [Fact]
    public async Task DistributionAndBatchUseSelectedContextHiddenKeysAndSafeShapes()
    {
        await using var factory = new TestApplicationFactory();
        using var client = factory.CreateCookieClient();
        var token = await LoginAsync(client);
        await SelectOrganizationAsync(client, token);
        var distributionOperation =
            Guid.Parse("018f5dc3-a865-7c11-a2a0-8326b3b96f90");
        var batchOperation =
            Guid.Parse("018f5dc3-a865-7c11-a2a0-8326b3b96f91");

        using var distributionRequest = CreateUnsafeRequest(
            HttpMethod.Post,
            $"/bff/gift-cards/{FakeBackendHandler.GiftCardId}/distribution",
            token,
            new
            {
                contactType = "email",
                recipientContact = "recipient@example.com",
                businessReference = " EMPLOYEE-DELIVERY-42 ",
                operationId = distributionOperation,
            });
        using var distribution = await client.SendAsync(distributionRequest);
        var distributionBody = await distribution.Content.ReadAsStringAsync();

        using var batchRequest = CreateUnsafeRequest(
            HttpMethod.Post,
            "/bff/gift-card-batches",
            token,
            new
            {
                batchReference = " BENEFITS-2026-08 ",
                operationId = batchOperation,
                items = new[]
                {
                    new
                    {
                        itemReference = "BENEFIT-001",
                        amount = "100.00",
                        currency = "TRY",
                        validFromUtc = (string?)null,
                        expiresAtUtc = "2027-08-03T09:00:00Z",
                        isTransferable = false,
                        isDivisible = true,
                        contactType = "email",
                        recipientContact = "alpha@example.com",
                    },
                },
            });
        using var batch = await client.SendAsync(batchRequest);
        var batchBody = await batch.Content.ReadAsStringAsync();

        using var refreshedBatch = await client.GetAsync(
            $"/bff/gift-card-batches/{FakeBackendHandler.GiftCardBatchId}?limit=200&cursor=opaque%2Bprior%3D%3D");
        var refreshedBatchBody = await refreshedBatch.Content.ReadAsStringAsync();
        using var retryRequest = CreateUnsafeRequest(
            HttpMethod.Post,
            $"/bff/gift-card-batches/{FakeBackendHandler.GiftCardBatchId}/retry",
            token);
        using var retry = await client.SendAsync(retryRequest);
        var retryBody = await retry.Content.ReadAsStringAsync();

        Assert.Equal(HttpStatusCode.OK, distribution.StatusCode);
        Assert.Equal(HttpStatusCode.Accepted, batch.StatusCode);
        Assert.Equal(HttpStatusCode.OK, refreshedBatch.StatusCode);
        Assert.Equal(HttpStatusCode.Accepted, retry.StatusCode);
        Assert.Contains("\"maskedRecipientContact\":\"r***@example.com\"", distributionBody);
        Assert.DoesNotContain("recipient@example.com", distributionBody, StringComparison.Ordinal);
        Assert.Contains("\"status\":\"Pending\"", batchBody);
        Assert.Contains("\"items\":[]", batchBody);
        Assert.DoesNotContain("alpha@example.com", batchBody, StringComparison.Ordinal);
        Assert.Contains("\"maskedRecipientContact\":\"a***@example.com\"", refreshedBatchBody);
        Assert.Contains("\"maskedRecipientContact\":\"+90***4567\"", refreshedBatchBody);
        Assert.Contains("\"failureCode\":\"insufficient_corporate_credit\"", refreshedBatchBody);
        Assert.DoesNotContain("+905551234567", refreshedBatchBody, StringComparison.Ordinal);
        Assert.Contains($"\"id\":\"{FakeBackendHandler.GiftCardRetryBatchId}\"", retryBody);
        Assert.Contains($"\"retryOfBatchId\":\"{FakeBackendHandler.GiftCardBatchId}\"", retryBody);
        foreach (var body in new[] { distributionBody, batchBody, refreshedBatchBody, retryBody })
        {
            Assert.DoesNotContain("fundingOrganizationId", body, StringComparison.Ordinal);
            Assert.DoesNotContain("issuingOrganizationId", body, StringComparison.Ordinal);
            Assert.DoesNotContain("invitationId", body, StringComparison.Ordinal);
            Assert.DoesNotContain("createdBy", body, StringComparison.Ordinal);
            Assert.DoesNotContain("distributedBy", body, StringComparison.Ordinal);
            Assert.DoesNotContain("idempotency", body, StringComparison.OrdinalIgnoreCase);
            Assert.DoesNotContain("claimUrl", body, StringComparison.OrdinalIgnoreCase);
            Assert.DoesNotContain("claimToken", body, StringComparison.OrdinalIgnoreCase);
        }

        Assert.Contains(
            $"\"idempotencyKey\":\"portal-gift-card-distribute-{distributionOperation:N}\"",
            factory.Backend.LastGiftCardDistributionRequestBody);
        Assert.Contains(
            "\"recipientContact\":\"recipient@example.com\"",
            factory.Backend.LastGiftCardDistributionRequestBody);
        Assert.Contains(
            $"\"idempotencyKey\":\"portal-gift-card-batch-{batchOperation:N}\"",
            factory.Backend.LastGiftCardBatchRequestBody);
        Assert.Contains(
            "\"recipientContact\":\"alpha@example.com\"",
            factory.Backend.LastGiftCardBatchRequestBody);

        var batchReadCall = factory.Backend.Requests.Single(request =>
            request.Method == HttpMethod.Get &&
            request.RequestUri?.AbsolutePath.EndsWith(
                $"/bulk-batches/{FakeBackendHandler.GiftCardBatchId}",
                StringComparison.Ordinal) == true);
        var decodedBatchQuery = Uri.UnescapeDataString(
            batchReadCall.RequestUri?.Query ?? string.Empty);
        Assert.Contains("limit=200", decodedBatchQuery, StringComparison.Ordinal);
        Assert.Contains(
            "cursor=opaque+prior==",
            decodedBatchQuery,
            StringComparison.Ordinal);

        var distributionAndBatchCalls = factory.Backend.Requests.Where(request =>
            request.RequestUri?.AbsolutePath.Contains(
                "/distributions",
                StringComparison.Ordinal) == true ||
            request.RequestUri?.AbsolutePath.Contains(
                "/bulk-batches",
                StringComparison.Ordinal) == true);
        Assert.All(
            distributionAndBatchCalls,
            request => Assert.Equal(
                FakeBackendHandler.OrganizationId.ToString(),
                request.Headers.GetValues("X-Organization-Id").Single()));
        Assert.All(
            distributionAndBatchCalls,
            request => Assert.Contains(
                FakeBackendHandler.OrganizationId.ToString(),
                request.RequestUri?.AbsolutePath,
                StringComparison.Ordinal));
        Assert.Contains(
            distributionAndBatchCalls,
            request => request.RequestUri?.AbsolutePath.EndsWith(
                "/bulk-batches/async",
                StringComparison.Ordinal) == true);
        Assert.Contains(
            distributionAndBatchCalls,
            request => request.RequestUri?.AbsolutePath.EndsWith(
                $"/bulk-batches/{FakeBackendHandler.GiftCardBatchId}/retry",
                StringComparison.Ordinal) == true);
    }

    [Theory]
    [InlineData(HttpStatusCode.BadRequest, "Choose email or phone")]
    [InlineData(HttpStatusCode.Forbidden, "do not have access")]
    [InlineData(HttpStatusCode.NotFound, "no longer available")]
    [InlineData(HttpStatusCode.Conflict, "changed")]
    public async Task DistributionMapsBackendRejectionsSafely(
        HttpStatusCode backendStatus,
        string expectedMessage)
    {
        await using var factory = new TestApplicationFactory();
        factory.Backend.RejectNextGiftCardDistributionWith = backendStatus;
        using var client = factory.CreateCookieClient();
        var token = await LoginAsync(client);
        await SelectOrganizationAsync(client, token);
        using var request = CreateUnsafeRequest(
            HttpMethod.Post,
            $"/bff/gift-cards/{FakeBackendHandler.GiftCardId}/distribution",
            token,
            new
            {
                contactType = "phone",
                recipientContact = "+905551234567",
                businessReference = "EMPLOYEE-DELIVERY-42",
                operationId = Guid.NewGuid(),
            });

        using var response = await client.SendAsync(request);
        var body = await response.Content.ReadAsStringAsync();

        Assert.Equal(backendStatus, response.StatusCode);
        Assert.Contains(expectedMessage, body, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("+905551234567", body, StringComparison.Ordinal);
        Assert.Single(factory.Sessions.Sessions);
    }

    [Theory]
    [InlineData("gift_card.not_yet_valid", "not yet valid")]
    [InlineData("gift_card.expired", "has expired")]
    [InlineData("gift_card.distribution.ineligible", "no longer available")]
    [InlineData("distribution.gift_card.ineligible", "no longer available")]
    [InlineData("distribution.idempotency_key.reused", "different details")]
    [InlineData("distribution.concurrent_conflict", "at the same time")]
    public async Task DistributionMapsKnownConflictCodesPrecisely(
        string backendCode,
        string expectedMessage)
    {
        await using var factory = new TestApplicationFactory();
        factory.Backend.RejectNextGiftCardDistributionWith =
            HttpStatusCode.Conflict;
        factory.Backend.RejectNextGiftCardDistributionCode = backendCode;
        using var client = factory.CreateCookieClient();
        var token = await LoginAsync(client);
        await SelectOrganizationAsync(client, token);
        using var request = CreateUnsafeRequest(
            HttpMethod.Post,
            $"/bff/gift-cards/{FakeBackendHandler.GiftCardId}/distribution",
            token,
            new
            {
                contactType = "email",
                recipientContact = "alpha@example.com",
                businessReference = "EMPLOYEE-DELIVERY-42",
                operationId = Guid.NewGuid(),
            });

        using var response = await client.SendAsync(request);
        var body = await response.Content.ReadAsStringAsync();

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Contains(expectedMessage, body, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("alpha@example.com", body, StringComparison.Ordinal);
        Assert.DoesNotContain(
            "safe backend conflict detail",
            body,
            StringComparison.OrdinalIgnoreCase);
        Assert.Single(factory.Sessions.Sessions);
    }

    [Theory]
    [InlineData(HttpStatusCode.BadRequest, "1 to 2,000")]
    [InlineData(HttpStatusCode.Forbidden, "do not have access")]
    [InlineData(HttpStatusCode.Conflict, "conflicts")]
    public async Task BulkBatchMapsBackendRejectionsSafely(
        HttpStatusCode backendStatus,
        string expectedMessage)
    {
        await using var factory = new TestApplicationFactory();
        factory.Backend.RejectNextGiftCardBatchWith = backendStatus;
        using var client = factory.CreateCookieClient();
        var token = await LoginAsync(client);
        await SelectOrganizationAsync(client, token);
        using var request = CreateUnsafeRequest(
            HttpMethod.Post,
            "/bff/gift-card-batches",
            token,
            new
            {
                batchReference = "BENEFITS-2026-08",
                operationId = Guid.NewGuid(),
                items = new[]
                {
                    new
                    {
                        itemReference = "BENEFIT-001",
                        amount = "100",
                        currency = "TRY",
                        expiresAtUtc = "2027-08-03T09:00:00Z",
                        contactType = "email",
                        recipientContact = "alpha@example.com",
                    },
                },
            });

        using var response = await client.SendAsync(request);
        var body = await response.Content.ReadAsStringAsync();

        Assert.Equal(backendStatus, response.StatusCode);
        Assert.Contains(expectedMessage, body, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("alpha@example.com", body, StringComparison.Ordinal);
        Assert.Single(factory.Sessions.Sessions);
    }

    [Theory]
    [InlineData(HttpStatusCode.Forbidden, "do not have access")]
    [InlineData(HttpStatusCode.NotFound, "no longer available")]
    public async Task BulkBatchReadMapsBackendRejectionsSafely(
        HttpStatusCode backendStatus,
        string expectedMessage)
    {
        await using var factory = new TestApplicationFactory();
        factory.Backend.RejectNextGiftCardBatchReadWith = backendStatus;
        using var client = factory.CreateCookieClient();
        var token = await LoginAsync(client);
        await SelectOrganizationAsync(client, token);

        using var response = await client.GetAsync(
            $"/bff/gift-card-batches/{FakeBackendHandler.GiftCardBatchId}");
        var body = await response.Content.ReadAsStringAsync();

        Assert.Equal(backendStatus, response.StatusCode);
        Assert.Contains(expectedMessage, body, StringComparison.OrdinalIgnoreCase);
        Assert.Single(factory.Sessions.Sessions);
    }

    [Fact]
    public async Task SubsidiariesUseSelectedOrganizationAndSafeRequestResponseShapes()
    {
        await using var factory = new TestApplicationFactory();
        using var client = factory.CreateCookieClient();
        var token = await LoginAsync(client);
        await SelectOrganizationAsync(client, token);

        using var list = await client.GetAsync(
            "/bff/organization/subsidiaries?limit=20&offset=0");
        using var createRequest = CreateUnsafeRequest(
            HttpMethod.Post,
            "/bff/organization/subsidiaries",
            token,
            new
            {
                name = "Demo New Branch",
                code = "DEMO-NEW",
            });
        using var created = await client.SendAsync(createRequest);
        var listBody = await list.Content.ReadAsStringAsync();
        var createdBody = await created.Content.ReadAsStringAsync();

        Assert.Equal(HttpStatusCode.OK, list.StatusCode);
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        Assert.Contains("\"code\":\"DEMO-EAST\"", listBody);
        Assert.Contains("\"code\":\"DEMO-NEW\"", createdBody);
        Assert.DoesNotContain("id", listBody, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain(
            "parentOrganizationId",
            createdBody,
            StringComparison.Ordinal);
        Assert.DoesNotContain(
            "organizationId",
            factory.Backend.LastCreatedSubsidiaryRequestBody,
            StringComparison.Ordinal);

        var backendCalls = factory.Backend.Requests
            .Where(request => request.RequestUri?.AbsolutePath.EndsWith(
                "/subsidiaries",
                StringComparison.Ordinal) == true)
            .ToArray();
        Assert.Equal(2, backendCalls.Length);
        Assert.All(
            backendCalls,
            request =>
            {
                Assert.Contains(
                    FakeBackendHandler.OrganizationId.ToString(),
                    request.RequestUri?.AbsolutePath,
                    StringComparison.Ordinal);
                Assert.Equal(
                    FakeBackendHandler.OrganizationId.ToString(),
                    request.Headers.GetValues("X-Organization-Id").Single());
            });
        Assert.Equal("?limit=20&offset=0", backendCalls[0].RequestUri?.Query);
    }

    [Fact]
    public async Task SubsidiariesRequireContextAndForbiddenKeepsSession()
    {
        await using var factory = new TestApplicationFactory();
        using var client = factory.CreateCookieClient();
        var token = await LoginAsync(client);

        using var missingContext = await client.GetAsync(
            "/bff/organization/subsidiaries");
        Assert.Equal(HttpStatusCode.Conflict, missingContext.StatusCode);
        Assert.DoesNotContain(
            factory.Backend.Requests,
            request => request.RequestUri?.AbsolutePath.EndsWith(
                "/subsidiaries",
                StringComparison.Ordinal) == true);

        await SelectOrganizationAsync(client, token);
        factory.Backend.ForbidNextSubsidiariesRequest = true;
        using var forbidden = await client.GetAsync(
            "/bff/organization/subsidiaries");
        using var retry = await client.GetAsync(
            "/bff/organization/subsidiaries");

        Assert.Equal(HttpStatusCode.Forbidden, forbidden.StatusCode);
        Assert.Equal(HttpStatusCode.OK, retry.StatusCode);
        Assert.Single(factory.Sessions.Sessions);
    }

    [Theory]
    [InlineData(HttpStatusCode.BadRequest, "Check the subsidiary name and code")]
    [InlineData(HttpStatusCode.Conflict, "already in use")]
    public async Task SubsidiaryCreationMapsBackendRejectionsSafely(
        HttpStatusCode backendStatus,
        string expectedMessage)
    {
        await using var factory = new TestApplicationFactory();
        using var client = factory.CreateCookieClient();
        var token = await LoginAsync(client);
        await SelectOrganizationAsync(client, token);
        factory.Backend.RejectNextSubsidiaryCreationWith = backendStatus;
        using var request = CreateUnsafeRequest(
            HttpMethod.Post,
            "/bff/organization/subsidiaries",
            token,
            new
            {
                name = "Rejected Branch",
                code = "REJECTED",
            });

        using var response = await client.SendAsync(request);
        var body = await response.Content.ReadAsStringAsync();

        Assert.Equal(backendStatus, response.StatusCode);
        Assert.Contains(expectedMessage, body, StringComparison.Ordinal);
        Assert.DoesNotContain("ApiException", body, StringComparison.Ordinal);
        Assert.Single(factory.Sessions.Sessions);
    }

    [Fact]
    public async Task FinanceReportsUseServerVerifiedTenantRootAndSafeResponseShape()
    {
        await using var factory = new TestApplicationFactory();
        using var client = factory.CreateCookieClient();
        var token = await LoginAsync(client);
        await SelectOrganizationAsync(client, token);

        using var summary = await client.GetAsync("/bff/finance/summary");
        using var history = await client.GetAsync(
            "/bff/finance/history?limit=10&cursor=opaque%2Bcursor%3D%3D" +
            "&category=giftcard&operation=Issued&currency=try" +
            "&reference=GC%25_&occurredFrom=2026-07-01" +
            "&occurredThrough=2026-07-29");
        var summaryBody = await summary.Content.ReadAsStringAsync();
        var historyBody = await history.Content.ReadAsStringAsync();

        Assert.Equal(HttpStatusCode.OK, summary.StatusCode);
        Assert.Equal(HttpStatusCode.OK, history.StatusCode);
        Assert.Contains("\"remainingCorporateCredit\":700", summaryBody);
        Assert.DoesNotContain("organizationId", summaryBody, StringComparison.Ordinal);
        Assert.Contains("\"businessReference\":\"FUND-2026-001\"", historyBody);
        Assert.DoesNotContain("entityId", historyBody, StringComparison.Ordinal);
        Assert.DoesNotContain("actorUserId", historyBody, StringComparison.Ordinal);

        var reportCalls = factory.Backend.Requests
            .Where(request => request.RequestUri?.AbsolutePath.Contains(
                "/reports/",
                StringComparison.Ordinal) == true)
            .ToArray();
        Assert.Equal(2, reportCalls.Length);
        Assert.All(
            reportCalls,
            request =>
            {
                Assert.Contains(
                    FakeBackendHandler.TenantRootOrganizationId.ToString(),
                    request.RequestUri?.AbsolutePath,
                    StringComparison.Ordinal);
                Assert.Equal(
                    FakeBackendHandler.TenantRootOrganizationId.ToString(),
                    request.Headers.GetValues("X-Organization-Id").Single());
            });
        var historyCall = reportCalls.Single(request =>
            request.RequestUri?.AbsolutePath.EndsWith(
                "/financial-history",
                StringComparison.Ordinal) == true);
        var historyQuery = historyCall.RequestUri!.Query
            .TrimStart('?')
            .Split('&', StringSplitOptions.RemoveEmptyEntries)
            .Select(component => component.Split('=', 2))
            .ToDictionary(
                component => Uri.UnescapeDataString(component[0]),
                component => component.Length == 1
                    ? string.Empty
                    : Uri.UnescapeDataString(component[1]),
                StringComparer.Ordinal);
        Assert.Equal("10", historyQuery["limit"]);
        Assert.Equal("opaque+cursor==", historyQuery["cursor"]);
        Assert.Equal("GiftCard", historyQuery["category"]);
        Assert.Equal("Issued", historyQuery["operation"]);
        Assert.Equal("TRY", historyQuery["currency"]);
        Assert.Equal("GC%_", historyQuery["reference"]);
        Assert.Equal(
            new DateTimeOffset(2026, 7, 1, 0, 0, 0, TimeSpan.Zero),
            DateTimeOffset.Parse(
                historyQuery["occurredFromUtc"],
                CultureInfo.InvariantCulture));
        Assert.Equal(
            new DateTimeOffset(2026, 7, 30, 0, 0, 0, TimeSpan.Zero),
            DateTimeOffset.Parse(
                historyQuery["occurredBeforeUtc"],
                CultureInfo.InvariantCulture));
    }

    [Theory]
    [InlineData("category=Unknown")]
    [InlineData("currency=EURO")]
    [InlineData("currency=T1Y")]
    [InlineData("occurredFrom=2026-07-30&occurredThrough=2026-07-29")]
    public async Task FinanceHistoryRejectsInvalidBusinessFiltersBeforeBackend(
        string query)
    {
        await using var factory = new TestApplicationFactory();
        using var client = factory.CreateCookieClient();
        var token = await LoginAsync(client);
        await SelectOrganizationAsync(client, token);
        var reportCallsBefore = factory.Backend.Requests.Count(request =>
            request.RequestUri?.AbsolutePath.EndsWith(
                "/reports/financial-history",
                StringComparison.Ordinal) == true);

        using var response = await client.GetAsync(
            $"/bff/finance/history?{query}");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(
            reportCallsBefore,
            factory.Backend.Requests.Count(request =>
                request.RequestUri?.AbsolutePath.EndsWith(
                    "/reports/financial-history",
                    StringComparison.Ordinal) == true));
    }

    [Fact]
    public async Task FinanceRequiresServerSideContextAndForbiddenKeepsSession()
    {
        await using var factory = new TestApplicationFactory();
        using var client = factory.CreateCookieClient();
        var token = await LoginAsync(client);

        using var missingContext = await client.GetAsync("/bff/finance/summary");
        Assert.Equal(HttpStatusCode.Conflict, missingContext.StatusCode);
        Assert.DoesNotContain(
            factory.Backend.Requests,
            request => request.RequestUri?.AbsolutePath.Contains(
                "/reports/",
                StringComparison.Ordinal) == true);

        await SelectOrganizationAsync(client, token);
        factory.Backend.ForbidNextFinancialSummaryRequest = true;
        using var forbidden = await client.GetAsync("/bff/finance/summary");
        using var retry = await client.GetAsync("/bff/finance/summary");

        Assert.Equal(HttpStatusCode.Forbidden, forbidden.StatusCode);
        Assert.Equal(HttpStatusCode.OK, retry.StatusCode);
        Assert.Single(factory.Sessions.Sessions);
    }

    [Fact]
    public async Task OrganizationAuditUsesSelectedContextAndMapsDeliberateEvidence()
    {
        await using var factory = new TestApplicationFactory();
        using var client = factory.CreateCookieClient();
        var token = await LoginAsync(client);
        await SelectOrganizationAsync(client, token);

        using var response = await client.GetAsync(
            "/bff/organization/audit-records?limit=25" +
            "&cursor=audit%2Bcursor%3D%3D&operation=authorization.denied" +
            $"&outcome=failure&correlationId={FakeBackendHandler.AuditCorrelationId}");
        var body = await response.Content.ReadAsStringAsync();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Contains("\"actorType\":\"Organization member\"", body);
        Assert.Contains(
            $"\"actorUserReference\":\"{FakeBackendHandler.AuditActorUserId}\"",
            body);
        Assert.Contains("\"entityReference\":\"organization.audit.view\"", body);
        Assert.Contains("\"outcome\":\"Failure\"", body);
        Assert.Contains("\"required_permission\":\"organization.audit.view\"", body);
        Assert.DoesNotContain(
            FakeBackendHandler.AuditRecordId.ToString(),
            body,
            StringComparison.Ordinal);
        Assert.DoesNotContain(
            FakeBackendHandler.AuditMembershipId.ToString(),
            body,
            StringComparison.Ordinal);
        Assert.DoesNotContain(
            "\"organizationScope",
            body,
            StringComparison.Ordinal);

        var backendCall = factory.Backend.Requests.Last(request =>
            request.RequestUri?.AbsolutePath ==
            $"/api/v1/organizations/{FakeBackendHandler.OrganizationId}/audit-records");
        Assert.Equal(
            FakeBackendHandler.OrganizationId.ToString(),
            backendCall.Headers.GetValues("X-Organization-Id").Single());
        var query = backendCall.RequestUri!.Query;
        Assert.Contains("limit=25", query, StringComparison.Ordinal);
        Assert.Contains("cursor=audit%2Bcursor%3D%3D", query, StringComparison.Ordinal);
        Assert.Contains(
            "operation=authorization.denied",
            query,
            StringComparison.Ordinal);
        Assert.Contains("outcome=2", query, StringComparison.Ordinal);
        Assert.Contains(
            $"correlationId={FakeBackendHandler.AuditCorrelationId}",
            query,
            StringComparison.Ordinal);
    }

    [Fact]
    public async Task PlatformAuditUsesNonRenderedTargetWithoutTenantHeader()
    {
        await using var factory = new TestApplicationFactory();
        factory.Backend.UsePlatformContext = true;
        using var client = factory.CreateCookieClient();
        await LoginAsync(client);

        using var response = await client.GetAsync(
            $"/bff/platform/organizations/{FakeBackendHandler.OrganizationId}" +
            "/audit-records?outcome=Success");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var backendCall = factory.Backend.Requests.Last(request =>
            request.RequestUri?.AbsolutePath ==
            $"/api/v1/organizations/{FakeBackendHandler.OrganizationId}/audit-records");
        Assert.False(backendCall.Headers.Contains("X-Organization-Id"));
        Assert.Contains(
            "platform.audit.view",
            (await client.GetFromJsonAsync<JsonElement>("/bff/session"))
                .GetProperty("user")
                .GetProperty("platformPermissions")
                .EnumerateArray()
                .Select(permission => permission.GetString()));
    }

    [Theory]
    [InlineData("limit=51")]
    [InlineData("outcome=Unknown")]
    [InlineData("correlationId=00000000-0000-0000-0000-000000000000")]
    public async Task AuditRejectsInvalidFiltersBeforeBackend(string query)
    {
        await using var factory = new TestApplicationFactory();
        using var client = factory.CreateCookieClient();
        var token = await LoginAsync(client);
        await SelectOrganizationAsync(client, token);
        var callsBefore = factory.Backend.Requests.Count(request =>
            request.RequestUri?.AbsolutePath.EndsWith(
                "/audit-records",
                StringComparison.Ordinal) == true);

        using var response = await client.GetAsync(
            $"/bff/organization/audit-records?{query}");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(
            callsBefore,
            factory.Backend.Requests.Count(request =>
                request.RequestUri?.AbsolutePath.EndsWith(
                    "/audit-records",
                    StringComparison.Ordinal) == true));
    }

    [Fact]
    public async Task OrganizationAuditRequiresContextAndForbiddenKeepsSession()
    {
        await using var factory = new TestApplicationFactory();
        using var client = factory.CreateCookieClient();
        var token = await LoginAsync(client);

        using var missingContext = await client.GetAsync(
            "/bff/organization/audit-records");
        Assert.Equal(HttpStatusCode.Conflict, missingContext.StatusCode);
        Assert.DoesNotContain(
            factory.Backend.Requests,
            request => request.RequestUri?.AbsolutePath.EndsWith(
                "/audit-records",
                StringComparison.Ordinal) == true);

        await SelectOrganizationAsync(client, token);
        factory.Backend.ForbidNextAuditRecordsRequest = true;
        using var forbidden = await client.GetAsync(
            "/bff/organization/audit-records");
        using var retry = await client.GetAsync(
            "/bff/organization/audit-records");

        Assert.Equal(HttpStatusCode.Forbidden, forbidden.StatusCode);
        Assert.Equal(HttpStatusCode.OK, retry.StatusCode);
        Assert.Single(factory.Sessions.Sessions);
    }

    [Fact]
    public async Task ReconciliationUsesServerContextAndPreservesTechnicalReference()
    {
        await using var factory = new TestApplicationFactory();
        using var client = factory.CreateCookieClient();
        var token = await LoginAsync(client);
        await SelectOrganizationAsync(client, token);

        using var response = await client.GetAsync("/bff/finance/reconciliation");
        var body = await response.Content.ReadAsStringAsync();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Contains("\"isConsistent\":false", body);
        Assert.Contains("\"severity\":\"Error\"", body);
        Assert.Contains("\"technicalReference\":", body);
        Assert.DoesNotContain("organizationId", body, StringComparison.Ordinal);

        // Phase 3 added sharing to the backend's reconciliation scope. Staff
        // cannot tell a clean sharing check from one that never ran unless the
        // counts survive the BFF, so they are asserted rather than assumed.
        Assert.Contains("\"sharesChecked\":5", body);
        Assert.Contains("\"activeReservationsChecked\":2", body);
        Assert.Contains("\"code\":\"sharing.claimed_without_transfer\"", body);
        Assert.Contains("\"entityType\":\"GiftCardShare\"", body);

        var backendCall = factory.Backend.Requests.Last(request =>
            request.RequestUri?.AbsolutePath.EndsWith(
                "/reports/reconciliation",
                StringComparison.Ordinal) == true);
        Assert.Contains(
            FakeBackendHandler.TenantRootOrganizationId.ToString(),
            backendCall.RequestUri?.AbsolutePath,
            StringComparison.Ordinal);
        Assert.Equal(
            FakeBackendHandler.TenantRootOrganizationId.ToString(),
            backendCall.Headers.GetValues("X-Organization-Id").Single());
    }

    [Fact]
    public async Task ForbiddenReconciliationKeepsThePortalSession()
    {
        await using var factory = new TestApplicationFactory();
        using var client = factory.CreateCookieClient();
        var token = await LoginAsync(client);
        await SelectOrganizationAsync(client, token);
        factory.Backend.ForbidNextFinancialReconciliationRequest = true;

        using var forbidden = await client.GetAsync("/bff/finance/reconciliation");
        using var retry = await client.GetAsync("/bff/finance/reconciliation");

        Assert.Equal(HttpStatusCode.Forbidden, forbidden.StatusCode);
        Assert.Equal(HttpStatusCode.OK, retry.StatusCode);
        Assert.Single(factory.Sessions.Sessions);
    }

    [Fact]
    public async Task SessionBootstrapRepairsMissingVerifiedTenantRoot()
    {
        await using var factory = new TestApplicationFactory();
        using var client = factory.CreateCookieClient();
        var token = await LoginAsync(client);
        await SelectOrganizationAsync(client, token);

        var stored = Assert.Single(factory.Sessions.Sessions);
        await factory.Sessions.UpsertAsync(
            stored with { SelectedTenantRootOrganizationId = null },
            CancellationToken.None);

        using var session = await client.GetAsync("/bff/session");

        Assert.Equal(HttpStatusCode.OK, session.StatusCode);
        Assert.Equal(
            FakeBackendHandler.TenantRootOrganizationId,
            Assert.Single(factory.Sessions.Sessions)
                .SelectedTenantRootOrganizationId);
    }

    [Fact]
    public async Task LogoutRevokesTheBackendSessionAndClearsTheLocalSession()
    {
        await using var factory = new TestApplicationFactory();
        using var client = factory.CreateCookieClient();
        var token = await LoginAsync(client);

        using var logoutRequest = CreateUnsafeRequest(
            HttpMethod.Post,
            "/bff/auth/logout",
            token);
        using var logout = await client.SendAsync(logoutRequest);
        using var session = await client.GetAsync("/bff/session");

        Assert.Equal(HttpStatusCode.NoContent, logout.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, session.StatusCode);
        Assert.Empty(factory.Sessions.Sessions);
        Assert.Contains(
            factory.Backend.Requests,
            request => request.RequestUri?.AbsolutePath == "/api/v1/auth/revoke");
    }

    private static async Task<string> LoginAsync(HttpClient client)
    {
        var token = await GetAntiforgeryTokenAsync(client);
        using var request = CreateUnsafeRequest(
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
        using var request = CreateUnsafeRequest(
            HttpMethod.Post,
            "/bff/organization-context",
            token,
            new
            {
                organizationId = FakeBackendHandler.OrganizationId,
            });
        using var response = await client.SendAsync(request);
        response.EnsureSuccessStatusCode();
    }

    private static async Task<string> GetAntiforgeryTokenAsync(HttpClient client)
    {
        using var response = await client.GetAsync("/bff/antiforgery");
        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        return body.GetProperty("token").GetString()
            ?? throw new InvalidOperationException("Antiforgery token was absent.");
    }

    private static HttpRequestMessage CreateUnsafeRequest(
        HttpMethod method,
        string path,
        string token,
        object? body = null,
        string origin = "http://localhost")
    {
        var request = new HttpRequestMessage(method, path);
        request.Headers.Add("Origin", origin);
        request.Headers.Add("X-CSRF-TOKEN", token);
        if (body is not null)
        {
            request.Content = JsonContent.Create(body);
        }

        return request;
    }
}
