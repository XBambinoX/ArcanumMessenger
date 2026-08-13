using ArcanumMessenger.Contracts.Messenger.Media;
using Microsoft.Extensions.Caching.Distributed;

namespace ArcanumMessenger.Services.MessengerServices;

public class MediaUploadSessionService(IDistributedCache cache)
    : RedisSessionService<MediaUploadSession>(cache)
{
    protected override string KeyPrefix => "media-upload";
    // Generous on purpose - pausing a big upload and resuming it the next
    // day should still work, not just across a short network blip.
    protected override TimeSpan SessionTtl => TimeSpan.FromHours(48);
}
