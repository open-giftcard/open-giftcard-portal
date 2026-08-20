namespace GiftCardPortal.Bff.Sessions;

public interface IPortalSessionStore
{
    Task<bool> IsReadyAsync(CancellationToken cancellationToken);

    ValueTask<IAsyncDisposable> AcquireRefreshLockAsync(
        string sessionKeyHash,
        CancellationToken cancellationToken);

    Task<PortalSession?> FindAsync(string sessionKeyHash, CancellationToken cancellationToken);

    Task UpsertAsync(PortalSession session, CancellationToken cancellationToken);

    Task DeleteAsync(string sessionKeyHash, CancellationToken cancellationToken);
}

public interface IPortalSessionStoreInitializer
{
    Task InitializeAsync(CancellationToken cancellationToken);
}
