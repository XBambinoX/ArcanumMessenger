using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ArcanumMessenger.Migrations
{
    /// <inheritdoc />
    public partial class RemoveThirdRecoveryPhrase : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "RecoveryPhrase3Hash",
                table: "Users");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "RecoveryPhrase3Hash",
                table: "Users",
                type: "text",
                nullable: true);
        }
    }
}
