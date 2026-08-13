using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ArcanumMessenger.Migrations
{
    /// <inheritdoc />
    public partial class AddMessageChatDeletedAt : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "DeletedAt",
                table: "Messages",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "DeletedAt",
                table: "Chats",
                type: "timestamp with time zone",
                nullable: true);

            // Existing rows soft-deleted before this column existed have no
            // real deletion time to recover - backfilling them to "now"
            // starts their purge grace period from today instead of
            // leaving them stuck with DeletedAt = null forever (which the
            // cleanup jobs' own DeletedAt != null check would otherwise
            // skip indefinitely).
            migrationBuilder.Sql("UPDATE \"Messages\" SET \"DeletedAt\" = NOW() WHERE \"IsDeleted\" = true;");
            migrationBuilder.Sql("UPDATE \"Chats\" SET \"DeletedAt\" = NOW() WHERE \"IsDeleted\" = true;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "DeletedAt",
                table: "Messages");

            migrationBuilder.DropColumn(
                name: "DeletedAt",
                table: "Chats");
        }
    }
}
