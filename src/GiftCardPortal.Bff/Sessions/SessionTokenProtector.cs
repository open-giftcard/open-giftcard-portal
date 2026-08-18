using Microsoft.AspNetCore.DataProtection;

namespace GiftCardPortal.Bff.Sessions;

public sealed class SessionTokenProtector(IDataProtectionProvider dataProtectionProvider)
{
    private readonly IDataProtector _protector =
        dataProtectionProvider.CreateProtector(
            "GiftCardPortal.Bff",
            "BackendTokenPair",
            "v1");

    public string Protect(string token) => _protector.Protect(token);

    public string Unprotect(string protectedToken) => _protector.Unprotect(protectedToken);
}
