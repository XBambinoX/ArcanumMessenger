using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ArcanumMessenger.Migrations
{
    /// <inheritdoc />
    public partial class RenamePublicIdToPublicIdEnc : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "PublicId",
                table: "Users",
                newName: "PublicIdEnc");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "PublicIdEnc",
                table: "Users",
                newName: "PublicId");
        }
    }
}
