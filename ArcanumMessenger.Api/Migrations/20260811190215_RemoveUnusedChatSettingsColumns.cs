using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ArcanumMessenger.Migrations
{
    /// <inheritdoc />
    public partial class RemoveUnusedChatSettingsColumns : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AutoDownloadMedia",
                table: "UserSettings");

            migrationBuilder.DropColumn(
                name: "LinkPreviewsEnabled",
                table: "UserSettings");

            migrationBuilder.DropColumn(
                name: "Wallpaper",
                table: "UserSettings");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "AutoDownloadMedia",
                table: "UserSettings",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "LinkPreviewsEnabled",
                table: "UserSettings",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "Wallpaper",
                table: "UserSettings",
                type: "text",
                nullable: false,
                defaultValue: "");
        }
    }
}
