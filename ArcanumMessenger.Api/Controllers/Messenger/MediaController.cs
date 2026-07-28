using ArcanumMessenger.Contracts.Messenger.Media;
using ArcanumMessenger.Data;
using ArcanumMessenger.Entities;
using ArcanumMessenger.Services.MessengerServices;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ArcanumMessenger.Controllers.Messenger;

[Route("api/media")]
public class MediaController(AppDbContext db, MediaService media, MediaAccessService access) : MessengerControllerBase
{
    private const long MaxUploadBytes = 210_000_000; // a bit above MediaService's own 200 MB ceiling

    [HttpPost]
    [RequestSizeLimit(MaxUploadBytes)]
    public async Task<ActionResult<UploadMediaResponse>> Upload(IFormFile? file, CancellationToken ct)
    {
        if (!TryGetUserId(out var userId))
            return Unauthorized();

        if (file is null || file.Length == 0)
            return BadRequest(new UploadMediaResponse(false, null, "empty_file"));

        await using var stream = file.OpenReadStream();
        var (asset, reason) = await media.UploadAsync(
            stream, file.Length, file.FileName, file.ContentType ?? "application/octet-stream", userId, ct);

        return asset is null
            ? BadRequest(new UploadMediaResponse(false, null, reason))
            : Ok(new UploadMediaResponse(true, MediaAssetDto.FromEntity(asset)));
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id, CancellationToken ct)
    {
        if (!TryGetUserId(out var userId))
            return Unauthorized();

        var asset = await access.GetAccessibleAsync(id, userId, ct);
        if (asset is null)
            return NotFound();

        var range = ParseRange(Request.Headers.Range.ToString());
        var result = await media.OpenReadStreamAsync(asset, range, ct);

        Response.Headers.AcceptRanges = "bytes";
        if (result.ServedRange is { } served)
        {
            Response.StatusCode = StatusCodes.Status206PartialContent;
            Response.Headers.ContentRange = $"bytes {served.Start}-{served.End}/{result.TotalLength}";
        }

        return File(result.Content, result.ContentType, enableRangeProcessing: false);
    }

    [HttpGet("{id:guid}/thumbnail")]
    public async Task<IActionResult> GetThumbnail(Guid id, CancellationToken ct)
    {
        if (!TryGetUserId(out var userId))
            return Unauthorized();

        var asset = await access.GetAccessibleAsync(id, userId, ct);
        if (asset is null)
            return NotFound();

        var result = await media.OpenThumbnailStreamAsync(asset, ct);
        return result is null ? NotFound() : File(result.Content, result.ContentType);
    }

    [HttpGet("saved-gifs")]
    public async Task<ActionResult<SavedGifsResponse>> ListSavedGifs(CancellationToken ct)
    {
        if (!TryGetUserId(out var userId))
            return Unauthorized();

        var gifs = await db.SavedGifs.AsNoTracking()
            .Where(s => s.UserId == userId)
            .OrderByDescending(s => s.SavedAt)
            .Select(s => s.Media)
            .ToListAsync(ct);

        return Ok(new SavedGifsResponse(true, gifs.Select(MediaAssetDto.FromEntity).ToList()));
    }

    [HttpPost("{id:guid}/save")]
    public async Task<ActionResult<SaveGifResponse>> SaveGif(Guid id, CancellationToken ct)
    {
        if (!TryGetUserId(out var userId))
            return Unauthorized();

        var asset = await access.GetAccessibleAsync(id, userId, ct);
        if (asset is null)
            return NotFound(new SaveGifResponse(false, "not_found"));
        if (asset.Kind != "gif")
            return BadRequest(new SaveGifResponse(false, "not_a_gif"));

        var exists = await db.SavedGifs.AnyAsync(s => s.UserId == userId && s.MediaId == id, ct);
        if (!exists)
        {
            db.SavedGifs.Add(new SavedGif { UserId = userId, MediaId = id });
            await db.SaveChangesAsync(ct);
        }

        return Ok(new SaveGifResponse(true));
    }

    [HttpDelete("{id:guid}/save")]
    public async Task<ActionResult<SaveGifResponse>> UnsaveGif(Guid id, CancellationToken ct)
    {
        if (!TryGetUserId(out var userId))
            return Unauthorized();

        var existing = await db.SavedGifs.FirstOrDefaultAsync(s => s.UserId == userId && s.MediaId == id, ct);
        if (existing is not null)
        {
            db.SavedGifs.Remove(existing);
            await db.SaveChangesAsync(ct);
        }

        return Ok(new SaveGifResponse(true));
    }

    private static MediaByteRange? ParseRange(string? rangeHeader)
    {
        if (string.IsNullOrEmpty(rangeHeader) || !rangeHeader.StartsWith("bytes=", StringComparison.OrdinalIgnoreCase))
            return null;

        var parts = rangeHeader["bytes=".Length..].Split('-');
        if (parts.Length != 2 || !long.TryParse(parts[0], out var start))
            return null;

        long? end = long.TryParse(parts[1], out var parsedEnd) ? parsedEnd : null;
        return new MediaByteRange(start, end);
    }
}
