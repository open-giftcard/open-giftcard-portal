using GiftCardPortal.Bff.Sessions;
using Microsoft.Extensions.Configuration;

namespace GiftCardPortal.Bff.Tests;

public sealed class DatabaseMigrationBoundaryTests
{
    [Fact]
    public void MigrationModeRequiresTheExactSwitch()
    {
        Assert.True(PortalDatabaseMigrator.IsRequested(["--migrate"]));
        Assert.False(PortalDatabaseMigrator.IsRequested([]));
        Assert.False(PortalDatabaseMigrator.IsRequested(["--MIGRATE"]));
        Assert.False(PortalDatabaseMigrator.IsRequested(["migrate"]));
    }

    [Fact]
    public async Task MigrationModeRequiresASeparateOwnerConnection()
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ConnectionStrings:Portal"] =
                    "Host=localhost;Database=portal;Username=portal_app",
            })
            .Build();

        var exception = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            PortalDatabaseMigrator.RunAsync(configuration, CancellationToken.None));

        Assert.Contains("PortalMigrations", exception.Message, StringComparison.Ordinal);
    }
}
