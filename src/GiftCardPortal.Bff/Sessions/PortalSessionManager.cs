using System.Security.Cryptography;
using System.Text;
using GiftCardPortal.Bff.Backend;
using GiftCardPortal.Bff.Configuration;
using GiftCardPortal.Bff.Errors;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Extensions.Options;

namespace GiftCardPortal.Bff.Sessions;

public sealed class PortalSessionManager(
    IPortalSessionStore store,
    SessionTokenProtector tokenProtector,
    IOptions<PortalSessionOptions> options,
    TimeProvider timeProvider)
{
    private readonly PortalSessionOptions _options = options.Value;

    public async Task<PortalSession> CreateAsync(
        HttpContext context,
        TokenPairApiResponse tokenPair,
        CancellationToken cancellationToken)
    {
        var rawSessionId = WebEncoders.Base64UrlEncode(RandomNumberGenerator.GetBytes(32));
        var now = timeProvider.GetUtcNow();
        var accessToken = RequiredToken(tokenPair.AccessToken, nameof(tokenPair.AccessToken));
        var refreshToken = RequiredToken(tokenPair.RefreshToken, nameof(tokenPair.RefreshToken));
        var session = new PortalSession(
            Hash(rawSessionId),
            tokenProtector.Protect(accessToken),
            tokenPair.AccessTokenExpiresAtUtc,
            tokenProtector.Protect(refreshToken),
            tokenPair.RefreshTokenExpiresAtUtc,
            null,
            null,
            now,
            now);

        await store.UpsertAsync(session, cancellationToken);
        context.Response.Cookies.Append(
            _options.CookieName,
            rawSessionId,
            BuildCookieOptions(tokenPair.RefreshTokenExpiresAtUtc));

        return session;
    }

    public async Task<PortalSession?> FindAsync(
        HttpContext context,
        CancellationToken cancellationToken)
    {
        if (!context.Request.Cookies.TryGetValue(_options.CookieName, out var rawSessionId)
            || string.IsNullOrWhiteSpace(rawSessionId))
        {
            return null;
        }

        var session = await store.FindAsync(Hash(rawSessionId), cancellationToken);
        if (session is null || session.RefreshTokenExpiresAtUtc <= timeProvider.GetUtcNow())
        {
            if (session is not null)
            {
                await store.DeleteAsync(session.SessionKeyHash, cancellationToken);
            }

            DeleteCookie(context);
            return null;
        }

        return session;
    }

    public async Task DeleteAsync(
        HttpContext context,
        PortalSession? session,
        CancellationToken cancellationToken)
    {
        if (session is not null)
        {
            await store.DeleteAsync(session.SessionKeyHash, cancellationToken);
        }

        DeleteCookie(context);
    }

    public async Task<PortalSession> SetOrganizationAsync(
        PortalSession session,
        Guid? organizationId,
        Guid? tenantRootOrganizationId,
        CancellationToken cancellationToken)
    {
        if ((organizationId is null) != (tenantRootOrganizationId is null))
        {
            throw new ArgumentException(
                "Organization and tenant-root context must be set or cleared together.");
        }

        var latest = await store.FindAsync(session.SessionKeyHash, cancellationToken)
            ?? throw new PortalSessionExpiredException();
        var updated = latest with
        {
            SelectedOrganizationId = organizationId,
            SelectedTenantRootOrganizationId = tenantRootOrganizationId,
            UpdatedAtUtc = timeProvider.GetUtcNow(),
        };
        await store.UpsertAsync(updated, cancellationToken);
        return updated;
    }

    private CookieOptions BuildCookieOptions(DateTimeOffset expires) =>
        new()
        {
            HttpOnly = true,
            Secure = !_options.AllowInsecureCookie,
            SameSite = SameSiteMode.Lax,
            Path = "/",
            IsEssential = true,
            Expires = expires,
        };

    private void DeleteCookie(HttpContext context) =>
        context.Response.Cookies.Delete(
            _options.CookieName,
            BuildCookieOptions(timeProvider.GetUtcNow().AddDays(-1)));

    private static string Hash(string rawSessionId)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(rawSessionId));
        return Convert.ToHexString(bytes);
    }

    private static string RequiredToken(string? token, string fieldName) =>
        !string.IsNullOrWhiteSpace(token)
            ? token
            : throw new InvalidDataException(
                $"The backend response omitted required field '{fieldName}'.");
}
