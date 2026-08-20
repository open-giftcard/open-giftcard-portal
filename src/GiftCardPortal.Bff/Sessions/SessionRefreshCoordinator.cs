namespace GiftCardPortal.Bff.Sessions;

public sealed class SessionRefreshCoordinator
{
    private readonly object _gate = new();
    private readonly Dictionary<string, LockEntry> _locks = new(StringComparer.Ordinal);

    internal int ActiveLockCount
    {
        get
        {
            lock (_gate)
            {
                return _locks.Count;
            }
        }
    }

    public async Task<IDisposable> AcquireAsync(
        string sessionKeyHash,
        CancellationToken cancellationToken)
    {
        LockEntry entry;
        lock (_gate)
        {
            if (!_locks.TryGetValue(sessionKeyHash, out entry!))
            {
                entry = new LockEntry();
                _locks.Add(sessionKeyHash, entry);
            }

            entry.ReferenceCount++;
        }

        try
        {
            await entry.Semaphore.WaitAsync(cancellationToken);
            return new Releaser(this, sessionKeyHash, entry);
        }
        catch
        {
            ReleaseReference(sessionKeyHash, entry);
            throw;
        }
    }

    private void ReleaseReference(string sessionKeyHash, LockEntry entry)
    {
        lock (_gate)
        {
            entry.ReferenceCount--;
            if (entry.ReferenceCount == 0
                && _locks.TryGetValue(sessionKeyHash, out var current)
                && ReferenceEquals(current, entry))
            {
                _locks.Remove(sessionKeyHash);
                entry.Semaphore.Dispose();
            }
        }
    }

    private sealed class LockEntry
    {
        public SemaphoreSlim Semaphore { get; } = new(1, 1);

        public int ReferenceCount { get; set; }
    }

    private sealed class Releaser(
        SessionRefreshCoordinator owner,
        string sessionKeyHash,
        LockEntry entry) : IDisposable
    {
        private LockEntry? _entry = entry;

        public void Dispose()
        {
            var held = Interlocked.Exchange(ref _entry, null);
            if (held is null)
            {
                return;
            }

            held.Semaphore.Release();
            owner.ReleaseReference(sessionKeyHash, held);
        }
    }
}
