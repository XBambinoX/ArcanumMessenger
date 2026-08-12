using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ArcanumMessenger.Migrations
{
    /// <inheritdoc />
    public partial class AddPublicIdHashes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "PublicIdHash",
                table: "Users",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "PublicIdPrefixHash",
                table: "Users",
                type: "text",
                nullable: false,
                defaultValue: "");

            // The default above leaves every existing row with the same
            // empty PublicIdHash, which the unique index below would
            // reject. Backfill the (small number of) pre-existing accounts
            // with their real hash before the index is created.
            migrationBuilder.Sql(
                "UPDATE \"Users\" SET \"PublicIdHash\" = '98501d8593fb9f46253e45348847ec167fe501916ffdaf2bfcfb16ce61e50859', \"PublicIdPrefixHash\" = 'e8c4abd33a39c3aad881e3b0b74944ab13888b0d38c380e96f0b3f1d827a9018' WHERE \"Id\" = 'c741e233-bb00-4c7e-b203-161d9145ae44';");
            migrationBuilder.Sql(
                "UPDATE \"Users\" SET \"PublicIdHash\" = '7c466b9dfca5d35b400ea0d26a594527a724045b8bbb5d1177b69a4e94f47ac7', \"PublicIdPrefixHash\" = 'f3cb9c12792655a105c767f3ca34146acc22febabf8c5ac8c39ee424ffa36bbf' WHERE \"Id\" = '90b61304-9868-4287-bc4f-cbfc36a65355';");

            migrationBuilder.CreateIndex(
                name: "IX_Users_PublicIdHash",
                table: "Users",
                column: "PublicIdHash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Users_PublicIdPrefixHash",
                table: "Users",
                column: "PublicIdPrefixHash");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Users_PublicIdHash",
                table: "Users");

            migrationBuilder.DropIndex(
                name: "IX_Users_PublicIdPrefixHash",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "PublicIdHash",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "PublicIdPrefixHash",
                table: "Users");
        }
    }
}
