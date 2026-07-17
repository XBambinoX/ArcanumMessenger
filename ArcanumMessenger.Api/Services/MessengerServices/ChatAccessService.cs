using ArcanumMessenger.Data;
using ArcanumMessenger.Entities;
using Microsoft.EntityFrameworkCore;

namespace ArcanumMessenger.Services.MessengerServices;

public class ChatAccessService(AppDbContext db)
{
    public Task<ChatMember?> GetMembershipAsync(Guid chatId, Guid userId, CancellationToken ct) =>
        db.ChatMembers.FirstOrDefaultAsync(
            cm => cm.ChatId == chatId && cm.UserId == userId && !cm.Chat.IsDeleted, ct);
}
