using GiftCardPortal.Bff.Sessions;

namespace GiftCardPortal.Bff.Tests;

public sealed class SessionRefreshCoordinatorTests
{
    [Fact]
    public async Task ReleasedSessionLocksAreEvicted()
    {
        var coordinator = new SessionRefreshCoordinator();

        for (var index = 0; index < 500; index++)
        {
            using var held = await coordinator.AcquireAsync(
                $"session-{index}",
                CancellationToken.None);
        }

        Assert.Equal(0, coordinator.ActiveLockCount);
    }

    [Fact]
    public async Task WaitersShareOneEntryUntilEveryHolderReleases()
    {
        var coordinator = new SessionRefreshCoordinator();
        using var first = await coordinator.AcquireAsync("session", CancellationToken.None);
        var waiter = coordinator.AcquireAsync("session", CancellationToken.None);

        Assert.Equal(1, coordinator.ActiveLockCount);
        first.Dispose();
        using var second = await waiter;
        Assert.Equal(1, coordinator.ActiveLockCount);

        second.Dispose();
        Assert.Equal(0, coordinator.ActiveLockCount);
    }
}
