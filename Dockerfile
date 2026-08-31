# Build and run the portal BFF, which also serves the single-page application.
# The same image applies the portal's session-store migrations, selected by the
# --migrate argument, so the schema is never applied by a build that differs
# from the one that will serve it. This mirrors the backend image deliberately.
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /source

# Restore against the manifests first so a source-only change does not
# re-download packages. Central package management means the two Directory.*
# files are part of the restore graph.
COPY global.json Directory.Build.props Directory.Packages.props GiftCardPortal.slnx ./
COPY src/GiftCardPortal.Bff/ src/GiftCardPortal.Bff/
RUN dotnet restore src/GiftCardPortal.Bff/GiftCardPortal.Bff.csproj

# The SPA bundle in src/GiftCardPortal.Bff/wwwroot is committed, and CI fails
# when it does not match the TypeScript source. Building it again here would
# add Node and pnpm to the image for a result that is already verified, so the
# committed bundle is used as-is. Verify-FrontendBundle.ps1 is what keeps that
# honest; if it is ever removed, this image must build the SPA itself.
RUN dotnet publish src/GiftCardPortal.Bff/GiftCardPortal.Bff.csproj \
    -c Release -o /app --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime

# libgssapi-krb5-2: Npgsql loads the Kerberos GSSAPI library when it negotiates
# a connection, and the runtime image does not ship it. curl: the container
# healthcheck needs something to call /health/ready with, and the image has
# neither curl nor wget.
RUN apt-get update \
    && apt-get install --no-install-recommends --yes libgssapi-krb5-2 curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=build /app ./

# Seed the named Data Protection volume with ownership for the non-root runtime
# user, so session cookies stay decryptable across container replacement.
RUN mkdir -p /var/lib/open-giftcard-portal/dataprotection-keys \
    && chown -R $APP_UID /var/lib/open-giftcard-portal

USER $APP_UID

EXPOSE 8080
ENV ASPNETCORE_URLS=http://0.0.0.0:8080

ENTRYPOINT ["dotnet", "GiftCardPortal.Bff.dll"]
