using System.Security.Cryptography;
using System.Text;
using Npgsql;

namespace GiftCardPortal.Bff.Sessions;

internal static class PortalDatabaseMigrator
{
    internal const string Switch = "--migrate";
    private const string MigrationId = "20260824_001_managed_sessions";
    private const string MigrationSql =
        """
        CREATE TABLE IF NOT EXISTS portal_sessions (
            session_key_hash text PRIMARY KEY,
            protected_access_token text NOT NULL,
            access_token_expires_at_utc timestamptz NOT NULL,
            protected_refresh_token text NOT NULL,
            refresh_token_expires_at_utc timestamptz NOT NULL,
            selected_organization_id uuid NULL,
            selected_tenant_root_organization_id uuid NULL,
            created_at_utc timestamptz NOT NULL,
            updated_at_utc timestamptz NOT NULL
        );

        ALTER TABLE portal_sessions
            ADD COLUMN IF NOT EXISTS selected_tenant_root_organization_id uuid NULL;

        CREATE INDEX IF NOT EXISTS ix_portal_sessions_refresh_expiry
            ON portal_sessions (refresh_token_expires_at_utc);
        """;

    internal static bool IsRequested(IEnumerable<string> arguments) =>
        arguments.Contains(Switch, StringComparer.Ordinal);

    internal static async Task RunAsync(
        IConfiguration configuration,
        CancellationToken cancellationToken)
    {
        var migrationConnection = configuration.GetConnectionString("PortalMigrations");
        if (string.IsNullOrWhiteSpace(migrationConnection))
        {
            throw new InvalidOperationException(
                $"ConnectionStrings:PortalMigrations is required for {Switch}. " +
                "It must use the portal migration owner, never the runtime role.");
        }

        var runtimeConnection = configuration.GetConnectionString("Portal");
        if (string.IsNullOrWhiteSpace(runtimeConnection))
        {
            throw new InvalidOperationException(
                $"ConnectionStrings:Portal is required for {Switch} so the migrator " +
                "can grant the runtime role only its required table privileges.");
        }

        var runtimeRole = new NpgsqlConnectionStringBuilder(runtimeConnection).Username;
        if (string.IsNullOrWhiteSpace(runtimeRole))
        {
            throw new InvalidOperationException(
                "ConnectionStrings:Portal must name the runtime database user.");
        }

        var checksum = Convert.ToHexString(
            SHA256.HashData(Encoding.UTF8.GetBytes(MigrationSql)));
        await using var dataSource = NpgsqlDataSource.Create(migrationConnection);
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);

        await ExecuteAsync(
            connection,
            transaction,
            "SELECT pg_advisory_xact_lock(hashtext('open-giftcard-portal-migrations'));",
            cancellationToken);
        await ExecuteAsync(
            connection,
            transaction,
            """
            CREATE TABLE IF NOT EXISTS portal_schema_migrations (
                migration_id text PRIMARY KEY,
                sha256 text NOT NULL,
                applied_at_utc timestamptz NOT NULL DEFAULT now()
            );
            """,
            cancellationToken);

        var recordedChecksum = await ReadChecksumAsync(
            connection,
            transaction,
            cancellationToken);
        if (recordedChecksum is not null &&
            !string.Equals(recordedChecksum, checksum, StringComparison.Ordinal))
        {
            throw new InvalidOperationException(
                $"Portal migration {MigrationId} was changed after it was applied. " +
                $"Database has {recordedChecksum}; source has {checksum}.");
        }

        if (recordedChecksum is null)
        {
            await ExecuteAsync(
                connection,
                transaction,
                MigrationSql,
                cancellationToken);
            await RecordMigrationAsync(
                connection,
                transaction,
                checksum,
                cancellationToken);
        }

        await VerifyColumnsAsync(
            connection,
            transaction,
            "portal_sessions",
            [
                "session_key_hash|text|NO",
                "protected_access_token|text|NO",
                "access_token_expires_at_utc|timestamptz|NO",
                "protected_refresh_token|text|NO",
                "refresh_token_expires_at_utc|timestamptz|NO",
                "selected_organization_id|uuid|YES",
                "selected_tenant_root_organization_id|uuid|YES",
                "created_at_utc|timestamptz|NO",
                "updated_at_utc|timestamptz|NO",
            ],
            cancellationToken);

        var quotedRuntimeRole = new NpgsqlCommandBuilder().QuoteIdentifier(runtimeRole);
        await ExecuteAsync(
            connection,
            transaction,
            "REVOKE CREATE ON SCHEMA public FROM PUBLIC; " +
            $"GRANT USAGE ON SCHEMA public TO {quotedRuntimeRole}; " +
            $"GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE portal_sessions TO {quotedRuntimeRole};",
            cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        Console.WriteLine($"portal migration {MigrationId} verified");
    }

    private static async Task VerifyColumnsAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        string table,
        IReadOnlyCollection<string> expected,
        CancellationToken cancellationToken)
    {
        await using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText =
            """
            SELECT column_name || '|' || udt_name || '|' || is_nullable
            FROM information_schema.columns
            WHERE table_schema = current_schema()
              AND table_name = $1
            ORDER BY ordinal_position;
            """;
        command.Parameters.AddWithValue(table);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        var actual = new List<string>();
        while (await reader.ReadAsync(cancellationToken))
        {
            actual.Add(reader.GetString(0));
        }

        if (!actual.SequenceEqual(expected, StringComparer.Ordinal))
        {
            throw new InvalidOperationException(
                $"Managed schema for {table} does not match this release. " +
                $"Expected [{string.Join(", ", expected)}], found " +
                $"[{string.Join(", ", actual)}].");
        }
    }

    private static async Task<string?> ReadChecksumAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        CancellationToken cancellationToken)
    {
        await using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText =
            "SELECT sha256 FROM portal_schema_migrations WHERE migration_id = $1;";
        command.Parameters.AddWithValue(MigrationId);
        return (string?)await command.ExecuteScalarAsync(cancellationToken);
    }

    private static async Task RecordMigrationAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        string checksum,
        CancellationToken cancellationToken)
    {
        await using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText =
            "INSERT INTO portal_schema_migrations (migration_id, sha256) VALUES ($1, $2);";
        command.Parameters.AddWithValue(MigrationId);
        command.Parameters.AddWithValue(checksum);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    private static async Task ExecuteAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        string sql,
        CancellationToken cancellationToken)
    {
        await using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = sql;
        await command.ExecuteNonQueryAsync(cancellationToken);
    }
}
