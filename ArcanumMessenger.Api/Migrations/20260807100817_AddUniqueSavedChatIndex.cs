using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ArcanumMessenger.Migrations
{
    /// <inheritdoc />
    public partial class AddUniqueSavedChatIndex : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Chats_CreatedBy",
                table: "Chats");

            migrationBuilder.CreateIndex(
                name: "IX_Chats_CreatedBy",
                table: "Chats",
                column: "CreatedBy",
                unique: true,
                filter: "\"Type\" = 'saved'");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Chats_CreatedBy",
                table: "Chats");

            migrationBuilder.CreateIndex(
                name: "IX_Chats_CreatedBy",
                table: "Chats",
                column: "CreatedBy");
        }
    }
}
