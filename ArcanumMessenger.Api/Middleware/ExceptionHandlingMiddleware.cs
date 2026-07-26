using Org.BouncyCastle.Crypto;

public class ExceptionHandlingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ExceptionHandlingMiddleware> _logger;

    public ExceptionHandlingMiddleware(RequestDelegate next, ILogger<ExceptionHandlingMiddleware> logger)
    {
        _logger = logger;
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch(Exception ex)
        {
            _logger.LogCritical($"Unhanled exception during request {context.Request.Path}");

            var map = MapException(ex);
            context.Response.StatusCode = map.statusCode;
            context.Response.ContentType = "application/json";

            await context.Response.WriteAsJsonAsync(new
            {
                map.statusCode,
                map.title,
                message = ex.Message
            });
        }
    }
    
    private static (int statusCode, string title) MapException(Exception ex)
    {
        return ex switch
        {
            KeyNotFoundException =>
                (StatusCodes.Status404NotFound, "Resource not found"),

            ArgumentNullException =>
                (StatusCodes.Status400BadRequest, "Required argument is missing"),

            ArgumentException =>
                (StatusCodes.Status400BadRequest, "Invalid argument"),

            InvalidOperationException =>
                (StatusCodes.Status400BadRequest, "Invalid operation"),

            UnauthorizedAccessException =>
                (StatusCodes.Status401Unauthorized, "Unauthorized"),

            TimeoutException =>
                (StatusCodes.Status408RequestTimeout, "Request timeout"),

            OperationCanceledException =>
                (StatusCodes.Status499ClientClosedRequest, "Request cancelled"),

            NotSupportedException =>
                (StatusCodes.Status405MethodNotAllowed, "Operation not supported"),

            // EF Core
            Microsoft.EntityFrameworkCore.DbUpdateException =>
                (StatusCodes.Status409Conflict, "Database update conflict"),

            _ =>
                (StatusCodes.Status500InternalServerError, "Internal server error")

            // server errors (500+) are not handled here because apiFetch.ts already handles them
        };
    }
}