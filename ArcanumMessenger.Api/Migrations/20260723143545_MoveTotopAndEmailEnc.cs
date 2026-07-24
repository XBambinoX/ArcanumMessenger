using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ArcanumMessenger.Migrations
{
    /// <inheritdoc />
    public partial class MoveTotopAndEmailEnc : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PublicEmailEnc",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "TwoFactorEnabled",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "TwoFactorSecretEnc",
                table: "Users");

            migrationBuilder.AddColumn<string>(
                name: "EmailEnc",
                table: "UserSettings",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "TwoFactorEnabled",
                table: "UserSettings",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "TwoFactorSecretEnc",
                table: "UserSettings",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "EmailEnc",
                table: "UserSettings");

            migrationBuilder.DropColumn(
                name: "TwoFactorEnabled",
                table: "UserSettings");

            migrationBuilder.DropColumn(
                name: "TwoFactorSecretEnc",
                table: "UserSettings");

            migrationBuilder.AddColumn<string>(
                name: "PublicEmailEnc",
                table: "Users",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "TwoFactorEnabled",
                table: "Users",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "TwoFactorSecretEnc",
                table: "Users",
                type: "text",
                nullable: true);
        }
    }
}
