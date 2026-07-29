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

    // RequestSizeLimit alone isn't enough for a multipart upload - the form
    // parser has its own, separate default of 128MB
    // (FormOptions.MultipartBodyLengthLimit) that silently applied instead.
    [HttpPost]
    [RequestSizeLimit(MaxUploadBytes)]
    [RequestFormLimits(MultipartBodyLengthLimit = MaxUploadBytes)]
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
        if (result is null)
            return NotFound();

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

    [HttpPost("chunked")]
    public async Task<ActionResult<StartChunkedUploadResponse>> StartChunkedUpload(
        [FromBody] StartChunkedUploadRequest request, CancellationToken ct)
    {
        if (!TryGetUserId(out var userId))
            return Unauthorized();

        var (sessionId, reason) = await media.InitiateChunkedUploadAsync(
            request.FileName, request.MimeType, request.TotalSize, userId, ct);

        return sessionId is null
            ? BadRequest(new StartChunkedUploadResponse(false, null, reason))
            : Ok(new StartChunkedUploadResponse(true, sessionId));
    }

    [HttpPut("chunked/{sessionId}/parts/{partNumber:int}")]
    [RequestSizeLimit(15_000_000)] // comfortably above the client's 10MB chunk size
    public async Task<ActionResult<ChunkedUploadActionResponse>> UploadChunk(
        string sessionId, int partNumber, CancellationToken ct)
    {
        if (!TryGetUserId(out var userId))
            return Unauthorized();

        var partSize = Request.ContentLength ?? 0;
        if (partSize <= 0)
            return BadRequest(new ChunkedUploadActionResponse(false, "empty_chunk"));

        // UploadPartAsync needs a seekable stream - buffering one chunk (a
        // few MB at most) is cheap, unlike buffering the whole file.
        using var buffer = new MemoryStream();
        await Request.Body.CopyToAsync(buffer, ct);
        buffer.Position = 0;

        var (success, reason) = await media.UploadChunkAsync(sessionId, partNumber, buffer, partSize, userId, ct);
        return success
            ? Ok(new ChunkedUploadActionResponse(true))
            : BadRequest(new ChunkedUploadActionResponse(false, reason));
    }

    [HttpGet("chunked/{sessionId}")]
    public async Task<ActionResult<ChunkedUploadStatusResponse>> GetChunkedUploadStatus(string sessionId, CancellationToken ct)
    {
        if (!TryGetUserId(out var userId))
            return Unauthorized();

        var (session, reason) = await media.GetChunkedUploadStatusAsync(sessionId, userId, ct);
        return session is null
            ? NotFound(new ChunkedUploadStatusResponse(false, null, null, reason))
            : Ok(new ChunkedUploadStatusResponse(true, session.Parts.Select(p => p.PartNumber).ToList(), session.TotalSize));
    }

    [HttpPost("chunked/{sessionId}/complete")]
    public async Task<ActionResult<UploadMediaResponse>> CompleteChunkedUpload(string sessionId, CancellationToken ct)
    {
        if (!TryGetUserId(out var userId))
            return Unauthorized();

        var (asset, reason) = await media.CompleteChunkedUploadAsync(sessionId, userId, ct);
        return asset is null
            ? BadRequest(new UploadMediaResponse(false, null, reason))
            : Ok(new UploadMediaResponse(true, MediaAssetDto.FromEntity(asset)));
    }

    [HttpDelete("chunked/{sessionId}")]
    public async Task<ActionResult<ChunkedUploadActionResponse>> AbortChunkedUpload(string sessionId, CancellationToken ct)
    {
        if (!TryGetUserId(out var userId))
            return Unauthorized();

        var (success, reason) = await media.AbortChunkedUploadAsync(sessionId, userId, ct);
        return success
            ? Ok(new ChunkedUploadActionResponse(true))
            : BadRequest(new ChunkedUploadActionResponse(false, reason));
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
