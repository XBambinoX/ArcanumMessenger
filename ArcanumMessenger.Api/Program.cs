using ArcanumMessenger.Data;
using Microsoft.EntityFrameworkCore;
using ArcanumMessenger.Services.AuthServices;
using ArcanumMessenger.Services.AuthServices.RegisterServices;
using ArcanumMessenger.Services.AuthServices.RecoveryServices;
using ArcanumMessenger.Services.AuthServices.TotpServices;
using ArcanumMessenger.Services.AuthServices.LoginServices;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;


namespace ArcanumMessenger
{
    public class Program
    {
        public static void Main(string[] args)
        {
            var builder = WebApplication.CreateBuilder(args);

            // Add services to the container.

            builder.Services.AddDbContext<AppDbContext>(options =>
                options.UseNpgsql(builder.Configuration.GetConnectionString("Postgres")));

            builder.Services.AddCors(options =>
            {
                options.AddPolicy("DevClient", policy =>
                    policy.SetIsOriginAllowed(origin =>
                    {
                        var uri = new Uri(origin);
                        return uri.Port == 5173;
                    })
                        .AllowAnyHeader()
                        .AllowAnyMethod()
                        .AllowCredentials());
            });

            builder.Services.AddStackExchangeRedisCache(options =>
            {
                options.Configuration = builder.Configuration.GetConnectionString("Redis");
            });

            builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
                .AddJwtBearer(options =>
                {
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

            // Scope
            builder.Services.AddScoped<JwtService>();
            builder.Services.AddScoped<RegistrationSessionService>();
            builder.Services.AddScoped<EmailService>();
            builder.Services.AddScoped<AuthService>();
            builder.Services.AddScoped<RecoveryService>();
            builder.Services.AddScoped<TokenIssuanceService>();
            builder.Services.AddSingleton<EncryptionService>();
            builder.Services.AddSingleton<EmailHasher>();
            builder.Services.AddSingleton<LoginSessionService>();
            builder.Services.AddSingleton<TotpService>();
            builder.Services.AddSingleton<TotpSetupSessionService>();
            builder.Services.AddSingleton<RecoverySessionService>();

            var app = builder.Build();

            app.UseExceptionHandler(errApp =>
                {
                    errApp.Run(async context =>
                    {
                        context.Response.ContentType = "application/json";
                        context.Response.StatusCode = 500;
                        await context.Response.WriteAsJsonAsync(new { message = "Internal server error" });
                    });
                });

            // Configure the HTTP request pipeline.
            if (app.Environment.IsDevelopment())
            {
                app.UseSwagger();
                app.UseSwaggerUI();
            }

            app.UseHttpsRedirection();
            app.UseCors("DevClient");

            app.UseAuthentication();
            app.UseAuthorization();


            app.MapControllers();
            app.MapHealthChecks("/health");

            app.Run();
        }
    }
}
