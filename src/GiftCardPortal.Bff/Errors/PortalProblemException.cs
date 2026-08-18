namespace GiftCardPortal.Bff.Errors;

public class PortalProblemException(
    int statusCode,
    string title,
    string type) : Exception(title)
{
    public int StatusCode { get; } = statusCode;

    public string Title { get; } = title;

    public string Type { get; } = type;
}

public sealed class PortalSessionExpiredException()
    : PortalProblemException(
        StatusCodes.Status401Unauthorized,
        "Your session has expired. Sign in again.",
        "https://giftcard.example/problems/session-expired");
