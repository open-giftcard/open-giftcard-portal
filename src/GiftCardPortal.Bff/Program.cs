using GiftCardPortal.Bff.Backend;
using GiftCardPortal.Bff.Configuration;
using GiftCardPortal.Bff.Endpoints;
using GiftCardPortal.Bff.Errors;
using GiftCardPortal.Bff.Security;
using GiftCardPortal.Bff.Sessions;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.Extensions.Options;
using Npgsql;

var builder = WebApplication.CreateBuilder(args);
var isDevelopment = builder.Environment.IsDevelopment();
var knownProxyAddresses = DeploymentSafety.ReadKnownProxies(builder.Configuration);

builder.Logging.ClearProviders();
if (builder.Environment.IsDevelopment())
{
    builder.Logging.AddSimpleConsole();
}
else
{
    builder.Logging.AddJsonConsole(options => options.IncludeScopes = true);
}

builder.Services.AddOptions<BackendOptions>()
    .BindConfiguration(BackendOptions.SectionName)
    .Validate(
        options => options.BaseUrl.IsAbsoluteUri,
        "Backend:BaseUrl must be an absolute URI.")
    .Validate(
        options => DeploymentSafety.IsBackendTransportAllowed(
            options.BaseUrl,
            isDevelopment),
        "Backend:BaseUrl must use HTTPS outside Development.")
    .Validate(
        options => options.TimeoutSeconds is >= 1 and <= 120,
        "Backend:TimeoutSeconds must be between 1 and 120.")
    .ValidateOnStart();

builder.Services.AddOptions<PortalSessionOptions>()
    .BindConfiguration(PortalSessionOptions.SectionName)
    .Validate(
        options => !string.IsNullOrWhiteSpace(options.CookieName),
        "PortalSession:CookieName is required.")
    .Validate(
        options => options.AllowInsecureCookie
            || options.CookieName.StartsWith("__Host-", StringComparison.Ordinal),
        "A secure portal session cookie must use the __Host- prefix.")
    .Validate(
        options => DeploymentSafety.IsSessionCookieAllowed(options, isDevelopment),
        "Outside Development the portal session must use a secure __Host- cookie.")
    .ValidateOnStart();

var insecureDevelopmentCookie =
    builder.Configuration.GetValue<bool>("PortalSession:AllowInsecureCookie");
builder.Services.AddAntiforgery(options =>
{
    options.HeaderName = "X-CSRF-TOKEN";
    options.Cookie.Name = insecureDevelopmentCookie
        ? "giftcard_csrf_dev"
        : "__Host-giftcard_csrf";
    options.Cookie.HttpOnly = true;
    options.Cookie.SameSite = SameSiteMode.Strict;
    options.Cookie.SecurePolicy = insecureDevelopmentCookie
        ? CookieSecurePolicy.SameAsRequest
        : CookieSecurePolicy.Always;
});

var keyDirectory = DeploymentSafety.ResolveDataProtectionPath(
    builder.Configuration,
    builder.Environment.ContentRootPath,
    isDevelopment);
Directory.CreateDirectory(keyDirectory);

var dataProtection = builder.Services.AddDataProtection()
    .PersistKeysToFileSystem(new DirectoryInfo(keyDirectory))
    .SetApplicationName("GiftCardPortal");
if (OperatingSystem.IsWindows())
{
    dataProtection.ProtectKeysWithDpapi();
}

builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddSingleton(provider =>
{
    var configuration = provider.GetRequiredService<IConfiguration>();
    var connectionString = configuration.GetConnectionString("Portal")
        ?? throw new InvalidOperationException(
            "ConnectionStrings:Portal is required. See .env.example.");
    return NpgsqlDataSource.Create(connectionString);
});
builder.Services.AddSingleton<IPortalSessionStore, PostgreSqlPortalSessionStore>();
builder.Services.AddHostedService<PortalSessionStoreInitializationService>();
builder.Services.AddSingleton<SessionTokenProtector>();
builder.Services.AddSingleton<PortalSessionManager>();
builder.Services.AddSingleton<SessionRefreshCoordinator>();
builder.Services.AddSingleton<BackendGateway>();

builder.Services.AddHttpClient("backend", (provider, client) =>
{
    var options = provider.GetRequiredService<IOptions<BackendOptions>>().Value;
    client.BaseAddress = options.BaseUrl;
    client.Timeout = TimeSpan.FromSeconds(options.TimeoutSeconds);
    client.DefaultRequestHeaders.Add("Accept", "application/json");
});

if (knownProxyAddresses.Length > 0)
{
    builder.Services.Configure<ForwardedHeadersOptions>(options =>
        DeploymentSafety.ConfigureForwardedHeaders(options, knownProxyAddresses));
}

var app = builder.Build();

if (knownProxyAddresses.Length > 0)
{
    app.UseForwardedHeaders();
}

if (!app.Environment.IsDevelopment())
{
    app.UseHsts();
    app.UseHttpsRedirection();
}

app.UseMiddleware<PortalExceptionMiddleware>();
app.UseMiddleware<SecurityHeadersMiddleware>();
app.UseMiddleware<BffRequestSecurityMiddleware>();

app.MapGet("/health", () => Results.Ok(new { status = "ok" }))
    .ExcludeFromDescription();
app.MapGet("/health/ready", async (
    IPortalSessionStore store,
    CancellationToken cancellationToken) =>
        await store.IsReadyAsync(cancellationToken)
            ? Results.Ok(new { status = "ready" })
            : Results.Json(
                new { status = "unavailable" },
                statusCode: StatusCodes.Status503ServiceUnavailable))
    .ExcludeFromDescription();
app.MapPortalEndpoints();

app.UseDefaultFiles();
app.UseStaticFiles();
if (File.Exists(Path.Combine(app.Environment.WebRootPath ?? string.Empty, "index.html")))
{
    app.MapFallbackToFile("index.html");
}

await app.RunAsync();

public partial class Program;
