using System.Net;
using GiftCardPortal.Bff.Sessions;
using GiftCardPortal.Bff.Tests.Fakes;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Npgsql;

namespace GiftCardPortal.Bff.Tests;

internal sealed class TestApplicationFactory : WebApplicationFactory<Program>
{
    public static readonly IPAddress ObservedClientAddress =
        IPAddress.Parse("203.0.113.42");

    public FakeBackendHandler Backend { get; } = new();

    public InMemoryPortalSessionStore Sessions { get; } = new();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");
        builder.ConfigureAppConfiguration((_, configuration) =>
        {
            configuration.AddInMemoryCollection(
                new Dictionary<string, string?>
                {
                    ["Backend:BaseUrl"] = "http://backend.test",
                    ["Backend:TimeoutSeconds"] = "5",
                    ["PortalSession:CookieName"] = "giftcard_portal_dev",
                    ["PortalSession:AllowInsecureCookie"] = "true",
                });
        });

        builder.ConfigureServices(services =>
        {
            services.RemoveAll<IPortalSessionStore>();
            services.RemoveAll<NpgsqlDataSource>();
            services.RemoveAll<IDataProtectionProvider>();
            services.AddSingleton<IPortalSessionStore>(Sessions);
            services.AddSingleton<IDataProtectionProvider>(
                new EphemeralDataProtectionProvider());
            services.AddSingleton<IStartupFilter>(
                new ClientAddressStartupFilter(ObservedClientAddress));
            services.AddHttpClient("backend")
                .ConfigurePrimaryHttpMessageHandler(() => Backend);
        });
    }

    public HttpClient CreateCookieClient() =>
        CreateClient(
            new WebApplicationFactoryClientOptions
            {
                AllowAutoRedirect = false,
                BaseAddress = new Uri("http://localhost"),
                HandleCookies = true,
            });
}
