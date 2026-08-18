using System.Net;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.HttpOverrides;

namespace GiftCardPortal.Bff.Configuration;

internal static class DeploymentSafety
{
    private const string KnownProxiesSection =
        "Networking:ForwardedHeaders:KnownProxies";

    public static IPAddress[] ReadKnownProxies(IConfiguration configuration) =>
        configuration
            .GetSection(KnownProxiesSection)
            .GetChildren()
            .Select(item => item.Value)
            .Where(value => !string.IsNullOrWhiteSpace(value))
            .Select(value =>
                IPAddress.TryParse(value, out var address)
                    ? address
                    : throw new InvalidOperationException(
                        $"{KnownProxiesSection} contains invalid IP address '{value}'."))
            .Distinct()
            .ToArray();

    public static void ConfigureForwardedHeaders(
        ForwardedHeadersOptions options,
        IReadOnlyCollection<IPAddress> knownProxies)
    {
        ArgumentNullException.ThrowIfNull(options);
        ArgumentNullException.ThrowIfNull(knownProxies);
        if (knownProxies.Count == 0)
        {
            throw new InvalidOperationException(
                "Forwarded-header middleware must not be enabled without a trusted proxy.");
        }

        options.ForwardedHeaders =
            ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
        options.ForwardLimit = 1;
        options.KnownIPNetworks.Clear();
        options.KnownProxies.Clear();
        foreach (var address in knownProxies)
        {
            options.KnownProxies.Add(address);
        }
    }

    public static bool IsBackendTransportAllowed(Uri baseUrl, bool isDevelopment) =>
        isDevelopment || baseUrl.Scheme == Uri.UriSchemeHttps;

    public static bool IsSessionCookieAllowed(
        PortalSessionOptions options,
        bool isDevelopment) =>
        isDevelopment ||
        (!options.AllowInsecureCookie &&
         options.CookieName.StartsWith("__Host-", StringComparison.Ordinal));

    public static string ResolveDataProtectionPath(
        IConfiguration configuration,
        string contentRootPath,
        bool isDevelopment)
    {
        var configured = configuration["DataProtection:KeysPath"];
        if (string.IsNullOrWhiteSpace(configured))
        {
            if (!isDevelopment)
            {
                throw new InvalidOperationException(
                    "DataProtection:KeysPath is required outside Development so " +
                    "session keys survive restarts and can be shared across instances.");
            }

            configured = Path.Combine(contentRootPath, ".local", "dataprotection-keys");
        }

        return Path.GetFullPath(configured, contentRootPath);
    }
}
