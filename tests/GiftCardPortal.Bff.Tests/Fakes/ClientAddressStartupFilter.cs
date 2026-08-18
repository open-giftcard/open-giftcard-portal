using System.Net;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;

namespace GiftCardPortal.Bff.Tests.Fakes;

/// <summary>
/// TestServer leaves <c>Connection.RemoteIpAddress</c> unset. Stamping a fixed
/// address at the front of the pipeline lets tests prove that login forwards
/// the observed connection address rather than browser-supplied header input.
/// </summary>
internal sealed class ClientAddressStartupFilter(IPAddress address) : IStartupFilter
{
    public Action<IApplicationBuilder> Configure(Action<IApplicationBuilder> next) =>
        builder =>
        {
            builder.Use(async (context, nextMiddleware) =>
            {
                context.Connection.RemoteIpAddress = address;
                await nextMiddleware();
            });
            next(builder);
        };
}
