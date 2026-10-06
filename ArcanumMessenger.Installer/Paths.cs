using System.Text;

namespace ArcanumMessenger.Installer;

static class Paths
{
    // ARCANUM_HOME moves the whole install somewhere else (handy for testing).
    public static readonly string Home = Environment.GetEnvironmentVariable("ARCANUM_HOME") is { Length: > 0 } home
        ? Path.GetFullPath(home)
        : Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), ".arcanum");

    public static string Env => Path.Combine(Home, ".env");
    public static string Compose => Path.Combine(Home, "docker-compose.yml");
    public static string DefaultCertsDir => Path.Combine(Home, "certs");
    public static string CaDir => Path.Combine(Home, "ca");
    public static string CaCert => Path.Combine(CaDir, "arcanum-ca.crt");
    public static string CaKey => Path.Combine(CaDir, "arcanum-ca.key");

    // Created readable by the owner only - there's no moment where anyone else could read it.
    public static void WritePrivate(string path, string text)
    {
        File.Delete(path);
        var options = new FileStreamOptions { Mode = FileMode.CreateNew, Access = FileAccess.Write };
        if (!OperatingSystem.IsWindows()) options.UnixCreateMode = UnixFileMode.UserRead | UnixFileMode.UserWrite;
        using var writer = new StreamWriter(path, new UTF8Encoding(false), options);
        writer.Write(text);
    }

    public static void MakePrivate(string path)
    {
        if (!OperatingSystem.IsWindows()) File.SetUnixFileMode(path, UnixFileMode.UserRead | UnixFileMode.UserWrite);
    }

    public static string ExpandHome(string path) =>
        path == "~" || path.StartsWith("~/")
            ? Environment.GetFolderPath(Environment.SpecialFolder.UserProfile) + path[1..]
            : path;
}
