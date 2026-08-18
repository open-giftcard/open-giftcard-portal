namespace GiftCardPortal.Bff.Sessions;

public sealed class PortalSessionStoreInitializationService(
    IServiceProvider serviceProvider,
    ILogger<PortalSessionStoreInitializationService> logger) : IHostedService
{
    private static readonly Action<ILogger, Exception?> LogStorageReady =
        LoggerMessage.Define(
            LogLevel.Information,
            new EventId(1101, nameof(LogStorageReady)),
            "Portal session storage is ready.");

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        await using var scope = serviceProvider.CreateAsyncScope();
        var store = scope.ServiceProvider.GetRequiredService<IPortalSessionStore>();
        if (store is not IPortalSessionStoreInitializer initializer)
        {
            return;
        }

        await initializer.InitializeAsync(cancellationToken);
        LogStorageReady(logger, null);
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
