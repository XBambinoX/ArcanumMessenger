using System.Text;
using System.Text.RegularExpressions;

namespace ArcanumMessenger.Installer;

// The install's .env, in docker compose's syntax. Only ever appended to.
sealed partial class EnvFile
{
    readonly string path;
    readonly Dictionary<string, string> values = [];

    public bool Existed { get; }

    public EnvFile(string path)
    {
        this.path = path;
        Existed = File.Exists(path);
        if (!Existed) return;

        foreach (var line in File.ReadAllLines(path))
        {
            var match = Line().Match(line);
            if (match.Success) values[match.Groups[1].Value] = Unquote(match.Groups[2].Value.Trim());
        }
    }

    public string? this[string key] => values.TryGetValue(key, out var value) && value.Length > 0 ? value : null;

    public IEnumerable<KeyValuePair<string, string>> All => values;

    public void Create(string header)
    {
        Paths.WritePrivate(path, header + "\n");
    }

    public void Add(string key, string value)
    {
        // A hand-edited file may not end with a newline
        var bytes = File.ReadAllBytes(path);
        var separator = bytes.Length > 0 && bytes[^1] != '\n' ? "\n" : "";
        File.AppendAllText(path, $"{separator}{key}={Quote(value)}\n");
        values[key] = value;
    }

    // Never overwrites: changing ENCRYPTION_KEK or a pepper on a live install locks everyone out for good.
    public void Default(string key, string value)
    {
        if (this[key] == null) Add(key, value);
    }

    // Quotes anything beyond plain characters, so a space, $ or # in a password reaches the app as is.
    public static string Quote(string value)
    {
        if (Plain().IsMatch(value)) return value;
        if (!value.Contains('\'')) return $"'{value}'";
        var escaped = new StringBuilder();
        foreach (var c in value)
        {
            if (c is '\\' or '"' or '$') escaped.Append('\\');
            escaped.Append(c);
        }
        return $"\"{escaped}\"";
    }

    static string Unquote(string raw)
    {
        if (raw.Length >= 2 && raw[0] == '\'' && raw[^1] == '\'') return raw[1..^1];
        if (raw.Length >= 2 && raw[0] == '"' && raw[^1] == '"')
            return Escape().Replace(raw[1..^1], m => m.Groups[1].Value switch { "n" => "\n", "t" => "\t", var c => c });
        return InlineComment().Replace(raw, "");
    }

    [GeneratedRegex(@"^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$")]
    private static partial Regex Line();

    [GeneratedRegex(@"^[A-Za-z0-9_./+=:@-]*$")]
    private static partial Regex Plain();

    [GeneratedRegex(@"\\(.)")]
    private static partial Regex Escape();

    [GeneratedRegex(@"\s+#.*$")]
    private static partial Regex InlineComment();
}
