using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ArcanumMessenger.Migrations
{
    /// <inheritdoc />
    public partial class AddSessionReplacedBySessionId : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "ReplacedBySessionId",
                table: "Sessions",
                type: "uuid",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ReplacedBySessionId",
                table: "Sessions");
        }
    }
}
