namespace GiftCardPortal.Bff.Configuration;

public sealed class PortalSessionOptions
{
    public const string SectionName = "PortalSession";

    public string CookieName { get; init; } = "__Host-giftcard_portal";

    public bool AllowInsecureCookie { get; init; }
}
