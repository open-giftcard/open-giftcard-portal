using System.Buffers.Binary;
using System.Security.Cryptography;
using System.Text;
using Npgsql;

namespace GiftCardPortal.Bff.Sessions;

public sealed class PostgreSqlPortalSessionStore(NpgsqlDataSource dataSource)
    : IPortalSessionStore
{
    public async ValueTask<IAsyncDisposable> AcquireRefreshLockAsync(
        string sessionKeyHash,
        CancellationToken cancellationToken)
    {
        var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        var lockKey = AdvisoryLockKey(sessionKeyHash);
        try
        {
            await using var command = connection.CreateCommand();
            command.CommandText = "SELECT pg_advisory_lock($1);";
            command.Parameters.AddWithValue(lockKey);
            await command.ExecuteScalarAsync(cancellationToken);
            return new AdvisoryLock(connection, lockKey);
        }
        catch
        {
            await connection.DisposeAsync();
            throw;
        }
    }

    public async Task<bool> IsReadyAsync(CancellationToken cancellationToken)
    {
        try
        {
            await using var command = dataSource.CreateCommand(
                "SELECT 1 FROM portal_sessions LIMIT 0;");
            await command.ExecuteNonQueryAsync(cancellationToken);
            return true;
        }
        catch (NpgsqlException)
        {
            return false;
        }
    }

    public async Task<PortalSession?> FindAsync(
        string sessionKeyHash,
        CancellationToken cancellationToken)
    {
        const string sql =
            """
            SELECT session_key_hash,
                   protected_access_token,
                   access_token_expires_at_utc,
                   protected_refresh_token,
                   refresh_token_expires_at_utc,
                   selected_organization_id,
                   selected_tenant_root_organization_id,
                   created_at_utc,
                   updated_at_utc
            FROM portal_sessions
            WHERE session_key_hash = $1;
            """;

        await using var command = dataSource.CreateCommand(sql);
        command.Parameters.AddWithValue(sessionKeyHash);

        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        if (!await reader.ReadAsync(cancellationToken))
        {
            return null;
        }

        return new PortalSession(
            reader.GetString(0),
            reader.GetString(1),
            reader.GetFieldValue<DateTimeOffset>(2),
            reader.GetString(3),
            reader.GetFieldValue<DateTimeOffset>(4),
            reader.IsDBNull(5) ? null : reader.GetGuid(5),
            reader.IsDBNull(6) ? null : reader.GetGuid(6),
            reader.GetFieldValue<DateTimeOffset>(7),
            reader.GetFieldValue<DateTimeOffset>(8));
    }

    public async Task UpsertAsync(PortalSession session, CancellationToken cancellationToken)
    {
        const string sql =
            """
            INSERT INTO portal_sessions (
                session_key_hash,
                protected_access_token,
                access_token_expires_at_utc,
                protected_refresh_token,
                refresh_token_expires_at_utc,
                selected_organization_id,
                selected_tenant_root_organization_id,
                created_at_utc,
                updated_at_utc)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (session_key_hash) DO UPDATE SET
                protected_access_token = EXCLUDED.protected_access_token,
                access_token_expires_at_utc = EXCLUDED.access_token_expires_at_utc,
                protected_refresh_token = EXCLUDED.protected_refresh_token,
                refresh_token_expires_at_utc = EXCLUDED.refresh_token_expires_at_utc,
                selected_organization_id = EXCLUDED.selected_organization_id,
                selected_tenant_root_organization_id =
                    EXCLUDED.selected_tenant_root_organization_id,
                updated_at_utc = EXCLUDED.updated_at_utc;
            """;

        await using var command = dataSource.CreateCommand(sql);
        command.Parameters.AddWithValue(session.SessionKeyHash);
        command.Parameters.AddWithValue(session.ProtectedAccessToken);
        command.Parameters.AddWithValue(session.AccessTokenExpiresAtUtc);
        command.Parameters.AddWithValue(session.ProtectedRefreshToken);
        command.Parameters.AddWithValue(session.RefreshTokenExpiresAtUtc);
        command.Parameters.AddWithValue(
            session.SelectedOrganizationId is null
                ? DBNull.Value
                : session.SelectedOrganizationId.Value);
        command.Parameters.AddWithValue(
            session.SelectedTenantRootOrganizationId is null
                ? DBNull.Value
                : session.SelectedTenantRootOrganizationId.Value);
        command.Parameters.AddWithValue(session.CreatedAtUtc);
        command.Parameters.AddWithValue(session.UpdatedAtUtc);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    public async Task DeleteAsync(string sessionKeyHash, CancellationToken cancellationToken)
    {
        const string sql = "DELETE FROM portal_sessions WHERE session_key_hash = $1;";
        await using var command = dataSource.CreateCommand(sql);
        command.Parameters.AddWithValue(sessionKeyHash);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    private static long AdvisoryLockKey(string sessionKeyHash)
    {
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(sessionKeyHash));
        return BinaryPrimitives.ReadInt64BigEndian(hash);
    }

    private sealed class AdvisoryLock(NpgsqlConnection connection, long lockKey)
        : IAsyncDisposable
    {
        private NpgsqlConnection? _connection = connection;

        public async ValueTask DisposeAsync()
        {
            var held = Interlocked.Exchange(ref _connection, null);
            if (held is null)
            {
                return;
            }

            try
            {
                await using var command = held.CreateCommand();
                command.CommandText = "SELECT pg_advisory_unlock($1);";
                command.Parameters.AddWithValue(lockKey);
                await command.ExecuteScalarAsync();
            }
            finally
            {
                await held.DisposeAsync();
            }
        }
    }
}
