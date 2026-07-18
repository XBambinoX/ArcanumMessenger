// Temporary stand-in for a real "my profile" endpoint. The display id is
// deliberately not the database id - it's a separate, shareable lookup
// code. Generated once here as a preview of the format; the real one
// will be generated and persisted server-side.
const ID_CHARS =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

function generateDisplayId(): string {
    const group = () =>
        Array.from(
            { length: 4 },
            () => ID_CHARS[Math.floor(Math.random() * ID_CHARS.length)],
        ).join("");
    return [group(), group(), group(), group()].join("-");
}

export const mockProfile = {
    username: "You",
    displayId: generateDisplayId(),
};
