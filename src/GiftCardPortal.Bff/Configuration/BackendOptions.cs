namespace GiftCardPortal.Bff.Configuration;

public sealed class BackendOptions
{
    public const string SectionName = "Backend";

    public required Uri BaseUrl { get; init; }

    public int TimeoutSeconds { get; init; } = 15;
}
