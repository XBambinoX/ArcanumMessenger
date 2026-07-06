using ArcanumMessenger.Data;
using Microsoft.EntityFrameworkCore;
using ArcanumMessenger.Contracts.Auth;
using ArcanumMessenger.Services;
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
                        .AllowAnyMethod());
            });

            builder.Services.AddStackExchangeRedisCache(options =>
            {
                options.Configuration = builder.Configuration.GetConnectionString("Redis");
            });

            builder.Services.AddControllers();
            builder.Services.AddHealthChecks();
            builder.Services.AddSwaggerGen();

            // Scope
            builder.Services.AddScoped<RegistrationSessionService>();
            builder.Services.AddScoped<EmailService>();
            builder.Services.AddSingleton<EncryptionService>();
            builder.Services.AddSingleton<EmailHasher>();
            builder.Services.AddSingleton<LoginSessionService>();
            builder.Services.AddScoped<LoginService>();

            var app = builder.Build();

            // Configure the HTTP request pipeline.
            if (app.Environment.IsDevelopment())
            {
                app.UseSwagger();
                app.UseSwaggerUI();
            }

            //app.UseHttpsRedirection(); TEMPORARY DURING LOCALHOST DEVELOPMENT
            app.UseCors("DevClient");

            app.UseAuthorization();


            app.MapControllers();
            app.MapHealthChecks("/health");

            app.Run();
        }
    }
}
