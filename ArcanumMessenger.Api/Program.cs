
using ArcanumMessenger.Data;
using Microsoft.EntityFrameworkCore;

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
                    policy.WithOrigins("http://localhost:5173")
                          .AllowAnyHeader()
                          .AllowAnyMethod());
            });
            builder.Services.AddControllers();
            builder.Services.AddHealthChecks();
            builder.Services.AddSwaggerGen();

            var app = builder.Build();

            // Configure the HTTP request pipeline.
            if (app.Environment.IsDevelopment())
            {
                app.UseSwagger();
                app.UseSwaggerUI();
            }

            app.UseHttpsRedirection();
            app.UseCors("DevClient");

            app.UseAuthorization();


            app.MapControllers();
            app.MapHealthChecks("/health");

            app.Run();
        }
    }
}
