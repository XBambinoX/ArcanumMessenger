FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS base
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*
USER $APP_UID
WORKDIR /app
EXPOSE 8080
EXPOSE 8081

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
ARG BUILD_CONFIGURATION=Release
WORKDIR /src
COPY ["ArcanumMessenger.Api/ArcanumMessenger.csproj", "ArcanumMessenger.Api/"]
RUN dotnet restore "./ArcanumMessenger.Api/ArcanumMessenger.csproj"
COPY . .
WORKDIR "/src/ArcanumMessenger.Api"
RUN dotnet build "./ArcanumMessenger.csproj" -c $BUILD_CONFIGURATION -o /app/build

FROM build AS publish
ARG BUILD_CONFIGURATION=Release
RUN dotnet publish "./ArcanumMessenger.csproj" -c $BUILD_CONFIGURATION -o /app/publish /p:UseAppHost=false

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "ArcanumMessenger.dll"]
