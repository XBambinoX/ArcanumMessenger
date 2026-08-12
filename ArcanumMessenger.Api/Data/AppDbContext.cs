using ArcanumMessenger.Entities;
using Microsoft.EntityFrameworkCore;

namespace ArcanumMessenger.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<Session> Sessions => Set<Session>();
    public DbSet<Chat> Chats => Set<Chat>();
    public DbSet<ChatMember> ChatMembers => Set<ChatMember>();
    public DbSet<Contact> Contacts => Set<Contact>();
    public DbSet<Message> Messages => Set<Message>();
    public DbSet<UserSettings> UserSettings => Set<UserSettings>();
    public DbSet<MediaAsset> MediaAssets => Set<MediaAsset>();
    public DbSet<SavedGif> SavedGifs => Set<SavedGif>();
    public DbSet<MessageReaction> MessageReactions => Set<MessageReaction>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // Deferred: no per-message read receipts yet, ChatMember.LastReadAt
        // covers unread counts for now. Otherwise EF Core pulls this in
        // anyway via Message.Reads and fails - it has no key configured.
        modelBuilder.Ignore<MessageRead>();

        modelBuilder.Entity<User>(e =>
        {
            e.HasKey(u => u.Id);
            e.Property(u => u.Id).HasDefaultValueSql("gen_random_uuid()");
            e.Property(u => u.CreatedAt).HasDefaultValueSql("NOW()");
            e.HasIndex(u => u.EmailHash).IsUnique();
            e.HasIndex(u => u.PublicIdHash).IsUnique();
            e.HasIndex(u => u.PublicIdPrefixHash);
        });

        modelBuilder.Entity<Session>(e =>
        {
            e.HasKey(s => s.Id);
            e.Property(s => s.Id).HasDefaultValueSql("gen_random_uuid()");
            e.Property(s => s.CreatedAt).HasDefaultValueSql("NOW()");
            e.HasIndex(s => s.RefreshTokenHash).IsUnique();
            e.HasIndex(s => s.UserId);
            e.HasOne(s => s.User)
                .WithMany()
                .HasForeignKey(s => s.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Chat>(e =>
        {
            e.HasKey(c => c.Id);
            e.Property(c => c.Id).HasDefaultValueSql("gen_random_uuid()");
            e.Property(c => c.CreatedAt).HasDefaultValueSql("NOW()");
            e.HasOne(c => c.Creator)
                .WithMany()
                .HasForeignKey(c => c.CreatedBy)
                .OnDelete(DeleteBehavior.Restrict);
            // Guards against a concurrent double-request creating two "saved" chats for the same user.
            e.HasIndex(c => c.CreatedBy).IsUnique().HasFilter("\"Type\" = 'saved'");
        });

        modelBuilder.Entity<ChatMember>(e =>
        {
            e.HasKey(cm => new { cm.ChatId, cm.UserId });
            e.HasOne(cm => cm.Chat)
                .WithMany(c => c.Members)
                .HasForeignKey(cm => cm.ChatId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(cm => cm.User)
                .WithMany()
                .HasForeignKey(cm => cm.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Message>(e =>
        {
            e.HasKey(m => m.Id);
            e.Property(m => m.Id).HasDefaultValueSql("gen_random_uuid()");
            e.Property(m => m.CreatedAt).HasDefaultValueSql("NOW()");
            e.HasOne(m => m.Chat)
                .WithMany(c => c.Messages)
                .HasForeignKey(m => m.ChatId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(m => m.Sender)
                .WithMany()
                .HasForeignKey(m => m.SenderId)
                .OnDelete(DeleteBehavior.Restrict);
            e.HasOne(m => m.ReplyTo)
                .WithMany()
                .HasForeignKey(m => m.ReplyToId)
                .OnDelete(DeleteBehavior.SetNull);
            e.HasIndex(m => new { m.ChatId, m.CreatedAt });
            e.HasOne(m => m.Media)
                .WithMany()
                .HasForeignKey(m => m.MediaId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<Contact>(e =>
        {
            e.HasKey(c => new { c.UserId, c.ContactId });
            e.Property(c => c.CreatedAt).HasDefaultValueSql("NOW()");
            e.HasOne(c => c.User)
                .WithMany()
                .HasForeignKey(c => c.UserId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(c => c.ContactUser)
                .WithMany()
                .HasForeignKey(c => c.ContactId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<UserSettings>(e =>
        {
            e.HasKey(s => s.UserId);

            e.HasOne(s => s.User)
                .WithOne(u => u.UserSettings)
                .HasForeignKey<UserSettings>(s => s.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<MediaAsset>(e =>
        {
            e.HasKey(m => m.Id);
            e.Property(m => m.Id).HasDefaultValueSql("gen_random_uuid()");
            e.Property(m => m.CreatedAt).HasDefaultValueSql("NOW()");
            e.HasOne(m => m.Uploader)
                .WithMany()
                .HasForeignKey(m => m.UploaderId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<MessageReaction>(e =>
        {
            e.HasKey(r => new { r.MessageId, r.UserId, r.Emoji });
            e.Property(r => r.CreatedAt).HasDefaultValueSql("NOW()");
            e.HasOne(r => r.Message)
                .WithMany()
                .HasForeignKey(r => r.MessageId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(r => r.User)
                .WithMany()
                .HasForeignKey(r => r.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<SavedGif>(e =>
        {
            e.HasKey(s => new { s.UserId, s.MediaId });
            e.Property(s => s.SavedAt).HasDefaultValueSql("NOW()");
            e.HasOne(s => s.User)
                .WithMany()
                .HasForeignKey(s => s.UserId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(s => s.Media)
                .WithMany()
                .HasForeignKey(s => s.MediaId)
                .OnDelete(DeleteBehavior.Cascade);
        });
    }
}
