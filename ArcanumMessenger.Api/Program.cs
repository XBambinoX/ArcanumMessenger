using Amazon.Runtime;
using Amazon.S3;
using ArcanumMessenger.Data;
using Microsoft.EntityFrameworkCore;
using ArcanumMessenger.Services.AuthServices;
using ArcanumMessenger.Services.AuthServices.RegisterServices;
using ArcanumMessenger.Services.AuthServices.RecoveryServices;
using ArcanumMessenger.Services.AuthServices.TotpServices;
using ArcanumMessenger.Services.AuthServices.LoginServices;
using ArcanumMessenger.Services.MessengerServices;
using ArcanumMessenger.Hubs;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.SignalR;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using StackExchange.Redis;


namespace ArcanumMessenger
{
    public class Program
    {
        public static async Task Main(string[] args)
        {
            var builder = WebApplication.CreateBuilder(args);

            // Add services to the container.

            builder.Services.AddDbContext<AppDbContext>(options =>
                options.UseNpgsql(builder.Configuration.GetConnectionString("Postgres")));

            builder.Services.AddStackExchangeRedisCache(options =>
            {
                options.Configuration = builder.Configuration.GetConnectionString("Redis");
            });

            builder.Services.AddSingleton<IConnectionMultiplexer>(
                _ => ConnectionMultiplexer.Connect(builder.Configuration.GetConnectionString("Redis")!));

            // The AWS SDK auto-corrects its signing clock when a server response
            // looks skewed, then keeps using that offset for every later request.
            // Against MinIO this can misfire on a false positive and then poison
            // every upload afterward with SignatureDoesNotMatch - API and MinIO
            // are both local containers sharing the host clock, so there's never
            // a real skew to correct for in the first place.
            Amazon.AWSConfigs.CorrectForClockSkew = false;

            builder.Services.AddSingleton<IAmazonS3>(_ => new AmazonS3Client(
                new BasicAWSCredentials(builder.Configuration["Media:AccessKey"], builder.Configuration["Media:SecretKey"]),
                new AmazonS3Config
                {
                    ServiceURL = builder.Configuration["Media:Endpoint"],
                    ForcePathStyle = true,
                }));

            builder.Services.AddSingleton<PresenceService>();

            builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
                .AddJwtBearer(options =>
                {
                    // Without this, the handler silently renames "sub" to the old
                    // WIF claim URI, so every User.FindFirstValue(JwtRegisteredClaimNames.Sub)
                    // in the app (TotpController, MessengerControllerBase, ...) finds nothing.
                    options.MapInboundClaims = false;
                    options.TokenValidationParameters = new TokenValidationParameters
                    {
                        ValidateIssuer = true,
                        ValidateAudience = true,
                        ValidateLifetime = true,
                        ValidateIssuerSigningKey = true,
                        ValidIssuer = builder.Configuration["Jwt:Issuer"],
                        ValidAudience = builder.Configuration["Jwt:Issuer"],
                        IssuerSigningKey = new SymmetricSecurityKey(
                            Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Secret"]!))
                    };

                    options.Events = new JwtBearerEvents
                    {
                        OnMessageReceived = context =>
                        {
                            if (context.Request.Cookies.TryGetValue("access_token", out var token))
                                context.Token = token;
                            return Task.CompletedTask;
                        }
                    };
                });

            builder.Services.AddAuthorization();
            builder.Services.AddControllers();
            builder.Services.AddHealthChecks();
            builder.Services.AddSwaggerGen();
            builder.Services.AddSignalR(options =>
            {
                options.KeepAliveInterval = TimeSpan.FromSeconds(15);
                options.ClientTimeoutInterval = TimeSpan.FromSeconds(30);
            });
            builder.Services.AddSingleton<IUserIdProvider, SubjectUserIdProvider>();

            // Background jobs
            builder.Services.AddHostedService<Services.BackgroundJobs.AccountCleanupService>();
            builder.Services.AddHostedService<Services.BackgroundJobs.MessagePurgeService>();
            builder.Services.AddHostedService<Services.BackgroundJobs.MediaCleanupService>();
            builder.Services.AddHostedService<Services.BackgroundJobs.SessionCleanupService>();

            // Scope
            builder.Services.AddScoped<JwtService>();
            builder.Services.AddScoped<RegistrationSessionService>();
            builder.Services.AddScoped<EmailService>();
            builder.Services.AddScoped<AuthService>();
            builder.Services.AddScoped<RecoveryService>();
            builder.Services.AddScoped<TokenIssuanceService>();
            builder.Services.AddScoped<ChatService>();
            builder.Services.AddScoped<ChatAccessService>();
            builder.Services.AddScoped<UserDisplayNameService>();
            builder.Services.AddScoped<MessageService>();
            builder.Services.AddScoped<BlockService>();
            builder.Services.AddScoped<MediaService>();
            builder.Services.AddScoped<MediaAccessService>();
            builder.Services.AddScoped<AvatarService>();
            builder.Services.AddSingleton<EncryptionService>();
            builder.Services.AddSingleton<EmailHasher>();
            builder.Services.AddSingleton<PublicIdHasher>();
            builder.Services.AddSingleton<LoginSessionService>();
            builder.Services.AddSingleton<TotpService>();
            builder.Services.AddSingleton<TotpSetupSessionService>();
            builder.Services.AddSingleton<RecoverySessionService>();
            builder.Services.AddSingleton<MediaUploadSessionService>();

            var app = builder.Build();

            using (var startupScope = app.Services.CreateScope())
            {
                var media = startupScope.ServiceProvider.GetRequiredService<MediaService>();
                await media.EnsureBucketExistsAsync(CancellationToken.None);

                try
                {
                    await media.EnsureIncompleteUploadLifecycleRuleAsync(CancellationToken.None);
                }
                catch (AmazonS3Exception ex)
                {
                    // Housekeeping only (auto-abort stale chunked uploads) -
                    // must never take the whole app down if MinIO rejects it.
                    startupScope.ServiceProvider.GetRequiredService<ILogger<Program>>()
                        .LogWarning(ex, "Could not configure the media bucket's lifecycle rule");
                }
            }

            app.UseMiddleware<ExceptionHandlingMiddleware>();

            // Configure the HTTP request pipeline.
            if (app.Environment.IsDevelopment())
            {
                app.UseSwagger();
                app.UseSwaggerUI();
            }

            app.UseAuthentication();
            app.UseAuthorization();


            app.MapControllers();
            app.MapHealthChecks("/health");
            app.MapHub<ChatHub>("/hubs/chat");

            await app.RunAsync();
        }
    }
}
