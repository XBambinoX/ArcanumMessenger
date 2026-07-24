using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ArcanumMessenger.Migrations
{
    /// <inheritdoc />
    public partial class ExpandSettingsAndMoveUsernameEnc : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "UsernameEnc",
                table: "Users");

            migrationBuilder.AddColumn<bool>(
                name: "AutoDownloadMedia",
                table: "UserSettings",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "FontSize",
                table: "UserSettings",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<bool>(
                name: "GroupNotificationsEnabled",
                table: "UserSettings",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "MessagePreviewEnabled",
                table: "UserSettings",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "NotificationSound",
                table: "UserSettings",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<bool>(
                name: "ReadReceiptsEnabled",
                table: "UserSettings",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "ShowPhoneNumber",
                table: "UserSettings",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "UsernameEnc",
                table: "UserSettings",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Wallpaper",
                table: "UserSettings",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<int>(
                name: "WhoCanAddMe",
                table: "UserSettings",
                type: "integer",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AutoDownloadMedia",
                table: "UserSettings");

            migrationBuilder.DropColumn(
                name: "FontSize",
                table: "UserSettings");

            migrationBuilder.DropColumn(
                name: "GroupNotificationsEnabled",
                table: "UserSettings");

            migrationBuilder.DropColumn(
                name: "MessagePreviewEnabled",
                table: "UserSettings");

            migrationBuilder.DropColumn(
                name: "NotificationSound",
                table: "UserSettings");

            migrationBuilder.DropColumn(
                name: "ReadReceiptsEnabled",
                table: "UserSettings");

            migrationBuilder.DropColumn(
                name: "ShowPhoneNumber",
                table: "UserSettings");

            migrationBuilder.DropColumn(
                name: "UsernameEnc",
                table: "UserSettings");

            migrationBuilder.DropColumn(
                name: "Wallpaper",
                table: "UserSettings");

            migrationBuilder.DropColumn(
                name: "WhoCanAddMe",
                table: "UserSettings");

            migrationBuilder.AddColumn<string>(
                name: "UsernameEnc",
                table: "Users",
                type: "text",
                nullable: false,
                defaultValue: "");
        }
    }
}
