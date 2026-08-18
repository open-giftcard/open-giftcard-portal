namespace GiftCardPortal.Bff.Sessions;

public sealed record PortalSession(
    string SessionKeyHash,
    string ProtectedAccessToken,
    DateTimeOffset AccessTokenExpiresAtUtc,
    string ProtectedRefreshToken,
    DateTimeOffset RefreshTokenExpiresAtUtc,
    Guid? SelectedOrganizationId,
    Guid? SelectedTenantRootOrganizationId,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset UpdatedAtUtc);
