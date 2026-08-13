using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ArcanumMessenger.Migrations
{
    /// <inheritdoc />
    public partial class NumberAndBioMove : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PublicBioEnc",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "PublicPhoneEnc",
                table: "Users");

            migrationBuilder.AddColumn<string>(
                name: "BioEnc",
                table: "UserSettings",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PhoneEnc",
                table: "UserSettings",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "BioEnc",
                table: "UserSettings");

            migrationBuilder.DropColumn(
                name: "PhoneEnc",
                table: "UserSettings");

            migrationBuilder.AddColumn<string>(
                name: "PublicBioEnc",
                table: "Users",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PublicPhoneEnc",
                table: "Users",
                type: "text",
                nullable: true);
        }
    }
}
