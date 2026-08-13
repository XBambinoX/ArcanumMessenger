using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ArcanumMessenger.Migrations
{
    /// <inheritdoc />
    public partial class ChangeFontSizeField : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "FontSize",
                table: "UserSettings");

            migrationBuilder.AddColumn<bool>(
                name: "LinkPreviewsEnabled",
                table: "UserSettings",
                type: "boolean",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "LinkPreviewsEnabled",
                table: "UserSettings");

            migrationBuilder.AddColumn<int>(
                name: "FontSize",
                table: "UserSettings",
                type: "integer",
                nullable: false,
                defaultValue: 0);
        }
    }
}
