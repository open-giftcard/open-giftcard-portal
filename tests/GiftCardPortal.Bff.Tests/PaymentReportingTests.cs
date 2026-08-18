using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace GiftCardPortal.Bff.Tests;

public sealed class PaymentReportingTests
{
    [Fact]
    public async Task PlatformReportForwardsBusinessFiltersWithoutTenantHeader()
    {
        await using var factory = new TestApplicationFactory();
        factory.Backend.UsePlatformContext = true;
        using var client = factory.CreateCookieClient();
        await LoginAsync(client);

        using var response = await client.GetAsync(
            "/bff/platform/payments?limit=20&cursor=payments%2Bnext%3D%3D" +
            "&storeReference=store-101&state=confirmed&currency=try" +
            "&reference=receipt-9001&occurredFrom=2026-08-01" +
            "&occurredThrough=2026-08-05");
        var body = await response.Content.ReadAsStringAsync();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Contains("\"giftCardPublicReference\":\"DEMO-PAY-0042\"", body);
        Assert.Contains("\"totalMatchingPayments\":1", body);
        Assert.Contains("\"netAmount\":38", body);
        Assert.DoesNotContain(FakeBackendHandler.TenantRootOrganizationId.ToString(), body);
        Assert.DoesNotContain(FakeBackendHandler.GiftCardId.ToString(), body);
        Assert.DoesNotContain(FakeBackendHandler.PosClientId.ToString(), body);
        Assert.DoesNotContain(FakeBackendHandler.PosTerminalId.ToString(), body);
        Assert.DoesNotContain(FakeBackendHandler.PaymentLedgerId.ToString(), body);

        var backendCall = factory.Backend.Requests.Last(request =>
            request.RequestUri?.AbsolutePath == "/api/v1/platform/reports/payments");
        Assert.False(backendCall.Headers.Contains("X-Organization-Id"));
        var query = backendCall.RequestUri!.Query;
        Assert.Contains("cursor=payments%2Bnext%3D%3D", query, StringComparison.Ordinal);
        Assert.Contains("storeReference=STORE-101", query, StringComparison.Ordinal);
        Assert.Contains("state=Confirmed", query, StringComparison.Ordinal);
        Assert.Contains("currency=TRY", query, StringComparison.Ordinal);
        Assert.Contains("reference=receipt-9001", query, StringComparison.Ordinal);
        Assert.Contains("occurredFromUtc=2026-08-01", query, StringComparison.Ordinal);
        Assert.Contains("occurredBeforeUtc=2026-08-06", query, StringComparison.Ordinal);
        Assert.DoesNotContain("posClientId", query, StringComparison.Ordinal);
        Assert.DoesNotContain("posTerminalId", query, StringComparison.Ordinal);
        Assert.DoesNotContain("fundingOrganizationId", query, StringComparison.Ordinal);
    }

    [Fact]
    public async Task ReceiptMapsImmutableRefundWithoutTechnicalIdentifiers()
    {
        await using var factory = new TestApplicationFactory();
        factory.Backend.UsePlatformContext = true;
        using var client = factory.CreateCookieClient();
        await LoginAsync(client);

        using var response = await client.GetAsync(
            $"/bff/platform/payments/{FakeBackendHandler.PaymentProvisionId}");
        var body = await response.Content.ReadAsStringAsync();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Contains("\"reason\":\"Customer return\"", body);
        Assert.Contains("\"posTerminalCode\":\"TERM-07\"", body);
        Assert.DoesNotContain(FakeBackendHandler.RefundId.ToString(), body);
        Assert.DoesNotContain(FakeBackendHandler.PaymentLedgerId.ToString(), body);
        Assert.DoesNotContain(FakeBackendHandler.PosTerminalId.ToString(), body);
        var backendCall = factory.Backend.Requests.Last(request =>
            request.RequestUri?.AbsolutePath.EndsWith(
                FakeBackendHandler.PaymentProvisionId.ToString(),
                StringComparison.Ordinal) == true);
        Assert.False(backendCall.Headers.Contains("X-Organization-Id"));
    }

    [Theory]
    [InlineData("limit=51")]
    [InlineData("state=Settled")]
    [InlineData("currency=US")]
    [InlineData("occurredFrom=2026-08-06&occurredThrough=2026-08-05")]
    public async Task InvalidReportFiltersAreRejectedBeforeBackend(string query)
    {
        await using var factory = new TestApplicationFactory();
        factory.Backend.UsePlatformContext = true;
        using var client = factory.CreateCookieClient();
        await LoginAsync(client);
        var callsBefore = PaymentCalls(factory);

        using var response = await client.GetAsync($"/bff/platform/payments?{query}");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(callsBefore, PaymentCalls(factory));
    }

    [Fact]
    public async Task BackendForbiddenKeepsPlatformSession()
    {
        await using var factory = new TestApplicationFactory();
        factory.Backend.UsePlatformContext = true;
        using var client = factory.CreateCookieClient();
        await LoginAsync(client);
        factory.Backend.ForbidNextPaymentReportRequest = true;

        using var forbidden = await client.GetAsync("/bff/platform/payments");
        using var retry = await client.GetAsync("/bff/platform/payments");

        Assert.Equal(HttpStatusCode.Forbidden, forbidden.StatusCode);
        Assert.Equal(HttpStatusCode.OK, retry.StatusCode);
        Assert.Single(factory.Sessions.Sessions);
    }

    private static int PaymentCalls(TestApplicationFactory factory) =>
        factory.Backend.Requests.Count(request =>
            request.RequestUri?.AbsolutePath == "/api/v1/platform/reports/payments");

    private static async Task LoginAsync(HttpClient client)
    {
        using var antiforgery = await client.GetAsync("/bff/antiforgery");
        var token = (await antiforgery.Content.ReadFromJsonAsync<JsonElement>())
            .GetProperty("token")
            .GetString();
        using var request = new HttpRequestMessage(HttpMethod.Post, "/bff/auth/login")
        {
            Content = JsonContent.Create(new
            {
                email = "operator@example.test",
                password = "correct-password",
            }),
        };
        request.Headers.Add("Origin", "http://localhost");
        request.Headers.Add("X-CSRF-TOKEN", token);
        using var response = await client.SendAsync(request);
        response.EnsureSuccessStatusCode();
    }
}
