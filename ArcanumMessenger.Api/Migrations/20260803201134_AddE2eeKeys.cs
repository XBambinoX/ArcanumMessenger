using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ArcanumMessenger.Migrations
{
    /// <inheritdoc />
    public partial class AddE2eeKeys : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "EcdhPublicKey",
                table: "Users",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "WrappedEcdhPrivateKey",
                table: "Users",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "WrappedChatKey",
                table: "ChatMembers",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "EcdhPublicKey",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "WrappedEcdhPrivateKey",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "WrappedChatKey",
                table: "ChatMembers");
        }
    }
}
