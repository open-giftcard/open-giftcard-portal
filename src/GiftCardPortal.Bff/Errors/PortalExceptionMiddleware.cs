namespace GiftCardPortal.Bff.Errors;

public sealed class PortalExceptionMiddleware(
    RequestDelegate next,
    ILogger<PortalExceptionMiddleware> logger)
{
    private static readonly Action<ILogger, Exception> LogUnhandledRequestFailure =
        LoggerMessage.Define(
            LogLevel.Error,
            new EventId(1001, nameof(LogUnhandledRequestFailure)),
            "Unhandled portal request failure.");

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await next(context);
        }
        catch (PortalProblemException exception)
        {
            await Results.Problem(
                    statusCode: exception.StatusCode,
                    title: exception.Title,
                    type: exception.Type)
                .ExecuteAsync(context);
        }
        catch (Exception exception)
        {
            LogUnhandledRequestFailure(logger, exception);
            await Results.Problem(
                    statusCode: StatusCodes.Status500InternalServerError,
                    title: "The portal could not complete the request.",
                    type: "https://giftcard.example/problems/unexpected")
                .ExecuteAsync(context);
        }
    }
}
