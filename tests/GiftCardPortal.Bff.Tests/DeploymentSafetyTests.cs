using GiftCardPortal.Bff.Configuration;
using Microsoft.Extensions.Configuration;

namespace GiftCardPortal.Bff.Tests;

public sealed class DeploymentSafetyTests
{
    [Fact]
    public void ProductionRequiresHttpsBackendTransport()
    {
        Assert.False(
            DeploymentSafety.IsBackendTransportAllowed(
                new Uri("http://backend.example"),
                isDevelopment: false));
        Assert.True(
            DeploymentSafety.IsBackendTransportAllowed(
                new Uri("https://backend.example"),
                isDevelopment: false));
        Assert.True(
            DeploymentSafety.IsBackendTransportAllowed(
                new Uri("http://127.0.0.1:5144"),
                isDevelopment: true));
    }

    [Fact]
    public void ProductionRequiresSecureHostOnlySessionCookie()
    {
        Assert.False(
            DeploymentSafety.IsSessionCookieAllowed(
                new PortalSessionOptions
                {
                    CookieName = "portal-session",
                    AllowInsecureCookie = true,
                },
                isDevelopment: false));
        Assert.True(
            DeploymentSafety.IsSessionCookieAllowed(
                new PortalSessionOptions
                {
                    CookieName = "__Host-portal-session",
                    AllowInsecureCookie = false,
                },
                isDevelopment: false));
    }

    [Fact]
    public void ProductionRequiresExplicitDataProtectionPath()
    {
        var configuration = new ConfigurationBuilder().Build();

        var exception = Assert.Throws<InvalidOperationException>(() =>
            DeploymentSafety.ResolveDataProtectionPath(
                configuration,
                AppContext.BaseDirectory,
                isDevelopment: false));

        Assert.Contains("DataProtection:KeysPath", exception.Message, StringComparison.Ordinal);
    }

    [Fact]
    public void InvalidTrustedProxyFailsClosed()
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Networking:ForwardedHeaders:KnownProxies:0"] = "proxy.example",
            })
            .Build();

        Assert.Throws<InvalidOperationException>(() =>
            DeploymentSafety.ReadKnownProxies(configuration));
    }
}
