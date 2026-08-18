using System.Collections.Concurrent;

namespace GiftCardPortal.Bff.Sessions;

public sealed class SessionRefreshCoordinator
{
    private readonly ConcurrentDictionary<string, SemaphoreSlim> _locks = new();

    public async Task<IDisposable> AcquireAsync(
        string sessionKeyHash,
        CancellationToken cancellationToken)
    {
        var semaphore = _locks.GetOrAdd(sessionKeyHash, _ => new SemaphoreSlim(1, 1));
        await semaphore.WaitAsync(cancellationToken);
        return new Releaser(semaphore);
    }

    private sealed class Releaser(SemaphoreSlim semaphore) : IDisposable
    {
        public void Dispose() => semaphore.Release();
    }
}
