namespace GiftCardPortal.Bff.Security;

public sealed class SecurityHeadersMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext context)
    {
        context.Response.OnStarting(() =>
        {
            var headers = context.Response.Headers;
            headers.ContentSecurityPolicy =
                "default-src 'self'; base-uri 'none'; frame-ancestors 'none'; "
                + "form-action 'self'; img-src 'self'; object-src 'none'; "
                + "script-src 'self'; style-src 'self'";
            headers.XContentTypeOptions = "nosniff";
            headers["Referrer-Policy"] = "no-referrer";
            headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()";
            headers.CacheControl = context.Request.Path.StartsWithSegments("/bff")
                ? "no-store"
                : headers.CacheControl;
            return Task.CompletedTask;
        });

        await next(context);
    }
}
