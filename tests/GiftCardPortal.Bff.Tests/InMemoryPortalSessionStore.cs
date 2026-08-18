using System.Collections.Concurrent;
using GiftCardPortal.Bff.Sessions;

namespace GiftCardPortal.Bff.Tests;

internal sealed class InMemoryPortalSessionStore : IPortalSessionStore
{
    private readonly ConcurrentDictionary<string, PortalSession> _sessions = new();

    public IReadOnlyCollection<PortalSession> Sessions => _sessions.Values.ToArray();

    public bool IsReady { get; set; } = true;

    public Task<bool> IsReadyAsync(CancellationToken cancellationToken) =>
        Task.FromResult(IsReady);

    public Task<PortalSession?> FindAsync(
        string sessionKeyHash,
        CancellationToken cancellationToken)
    {
        _sessions.TryGetValue(sessionKeyHash, out var session);
        return Task.FromResult(session);
    }

    public Task UpsertAsync(PortalSession session, CancellationToken cancellationToken)
    {
        _sessions[session.SessionKeyHash] = session;
        return Task.CompletedTask;
    }

    public Task DeleteAsync(string sessionKeyHash, CancellationToken cancellationToken)
    {
        _sessions.TryRemove(sessionKeyHash, out _);
        return Task.CompletedTask;
    }
}
