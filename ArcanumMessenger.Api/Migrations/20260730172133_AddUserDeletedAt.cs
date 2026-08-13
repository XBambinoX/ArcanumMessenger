using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ArcanumMessenger.Migrations
{
    /// <inheritdoc />
    public partial class AddUserDeletedAt : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "DeletedAt",
                table: "Users",
                type: "timestamp with time zone",
                nullable: true);

            // Accounts already soft-deleted before this column existed have no
            // way to know when that actually happened - backfilling "now" gives
            // them a fresh grace period instead of a null DeletedAt that
            // AccountCleanupService would otherwise just skip forever.
            migrationBuilder.Sql(
                """UPDATE "Users" SET "DeletedAt" = NOW() WHERE "IsDeleted" = true AND "DeletedAt" IS NULL""");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "DeletedAt",
                table: "Users");
        }
    }
}
