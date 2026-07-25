public record UserPresenceResponse(bool IsOnline, DateTime? LastSeen);
public record BulkPresenceRequest(List<Guid> UserIds);
public record BulkPresenceItem(Guid UserId, bool IsOnline, DateTime? LastSeen);
public record BulkPresenceResponse(List<BulkPresenceItem> Items);