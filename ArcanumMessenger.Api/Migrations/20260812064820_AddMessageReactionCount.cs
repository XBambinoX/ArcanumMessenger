using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ArcanumMessenger.Migrations
{
    /// <inheritdoc />
    public partial class AddMessageReactionCount : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "Count",
                table: "MessageReactions",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            // Existing rows each represented exactly one reaction under the
            // old toggle-only model - backfill them to 1 so they don't
            // silently disappear from the aggregated total (0 would).
            migrationBuilder.Sql("UPDATE \"MessageReactions\" SET \"Count\" = 1;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Count",
                table: "MessageReactions");
        }
    }
}
