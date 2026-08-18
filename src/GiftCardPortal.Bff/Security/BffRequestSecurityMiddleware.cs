using Microsoft.AspNetCore.Antiforgery;

namespace GiftCardPortal.Bff.Security;

public sealed class BffRequestSecurityMiddleware(RequestDelegate next)
{
    private static readonly HashSet<string> UnsafeMethods =
        new(StringComparer.OrdinalIgnoreCase)
        {
            HttpMethods.Post,
            HttpMethods.Put,
            HttpMethods.Patch,
            HttpMethods.Delete,
        };

    public async Task InvokeAsync(HttpContext context, IAntiforgery antiforgery)
    {
        if (!context.Request.Path.StartsWithSegments("/bff")
            || !UnsafeMethods.Contains(context.Request.Method))
        {
            await next(context);
            return;
        }

        if (!HasSameOrigin(context))
        {
            await Results.Problem(
                    statusCode: StatusCodes.Status403Forbidden,
                    title: "Request origin was rejected.",
                    type: "https://giftcard.example/problems/origin-rejected")
                .ExecuteAsync(context);
            return;
        }

        try
        {
            await antiforgery.ValidateRequestAsync(context);
        }
        catch (AntiforgeryValidationException)
        {
            await Results.Problem(
                    statusCode: StatusCodes.Status400BadRequest,
                    title: "The security token is missing or invalid.",
                    type: "https://giftcard.example/problems/antiforgery")
                .ExecuteAsync(context);
            return;
        }

        await next(context);
    }

    private static bool HasSameOrigin(HttpContext context)
    {
        if (!context.Request.Headers.TryGetValue("Origin", out var values)
            || values.Count != 1
            || !Uri.TryCreate(values[0], UriKind.Absolute, out var origin))
        {
            return false;
        }

        return string.Equals(origin.Scheme, context.Request.Scheme, StringComparison.OrdinalIgnoreCase)
            && string.Equals(origin.Authority, context.Request.Host.Value, StringComparison.OrdinalIgnoreCase)
            && string.IsNullOrEmpty(origin.PathAndQuery.Trim('/'));
    }
}
