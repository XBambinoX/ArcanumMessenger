using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ArcanumMessenger.Migrations
{
    /// <inheritdoc />
    public partial class AddKdfSaltAndRenameBioToPublicBioEnc : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "Bio",
                table: "Users",
                newName: "PublicBioEnc");

            migrationBuilder.AddColumn<string>(
                name: "KdfSalt",
                table: "Users",
                type: "text",
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "KdfSalt",
                table: "Users");

            migrationBuilder.RenameColumn(
                name: "PublicBioEnc",
                table: "Users",
                newName: "Bio");
        }
    }
}
