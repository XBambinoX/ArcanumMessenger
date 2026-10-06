FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS base
# libfontconfig1 is a runtime dependency of SkiaSharp's native library (used
# for thumbnail generation), not otherwise needed by anything else here.
RUN apt-get update && apt-get install -y --no-install-recommends curl libfontconfig1 && rm -rf /var/lib/apt/lists/*
USER $APP_UID
WORKDIR /app
EXPOSE 8080

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
ARG BUILD_CONFIGURATION=Release
WORKDIR /src
COPY ["ArcanumMessenger.Api/ArcanumMessenger.csproj", "ArcanumMessenger.Api/"]
RUN dotnet restore "./ArcanumMessenger.Api/ArcanumMessenger.csproj"
# Only the API's own folder, so a client-only change doesn't throw away this build's cache.
COPY ArcanumMessenger.Api/ ArcanumMessenger.Api/
WORKDIR "/src/ArcanumMessenger.Api"
RUN dotnet publish "./ArcanumMessenger.csproj" -c $BUILD_CONFIGURATION -o /app/publish /p:UseAppHost=false --no-restore

FROM base AS final
WORKDIR /app
COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "ArcanumMessenger.dll"]
