using System.ComponentModel;
using System.Diagnostics;

namespace ArcanumMessenger.Installer;

static class Shell
{
    // Output is captured; a missing program comes back as exit code 127.
    public static async Task<(int Code, string Out, string Err)> CaptureIn(string? dir, string file, params string[] args)
    {
        var info = Start(dir, file, args);
        info.RedirectStandardOutput = true;
        info.RedirectStandardError = true;
        try
        {
            using var process = Process.Start(info)!;
            var stdout = process.StandardOutput.ReadToEndAsync();
            var stderr = process.StandardError.ReadToEndAsync();
            await process.WaitForExitAsync();
            return (process.ExitCode, (await stdout).Trim(), (await stderr).Trim());
        }
        catch (Win32Exception)
        {
            return (127, "", $"{file} isn't installed");
        }
    }

    public static Task<(int Code, string Out, string Err)> Capture(string file, params string[] args) =>
        CaptureIn(null, file, args);

    // Output goes straight to the terminal.
    public static int Run(string? dir, string file, params string[] args)
    {
        try
        {
            using var process = Process.Start(Start(dir, file, args))!;
            process.WaitForExit();
            return process.ExitCode;
        }
        catch (Win32Exception)
        {
            return 127;
        }
    }

    // sudo unless we already are root.
    public static int RunAsRoot(string file, params string[] args) =>
        Environment.IsPrivilegedProcess ? Run(null, file, args) : Run(null, "sudo", [file, .. args]);

    public static bool Exists(string command)
    {
        var extensions = OperatingSystem.IsWindows()
            ? (Environment.GetEnvironmentVariable("PATHEXT") ?? ".EXE").Split(';', StringSplitOptions.RemoveEmptyEntries)
            : [""];
        var dirs = (Environment.GetEnvironmentVariable("PATH") ?? "").Split(Path.PathSeparator, StringSplitOptions.RemoveEmptyEntries);
        return dirs.Any(dir => extensions.Any(ext => File.Exists(Path.Combine(dir, command + ext))));
    }

    static ProcessStartInfo Start(string? dir, string file, string[] args)
    {
        var info = new ProcessStartInfo(file) { UseShellExecute = false, WorkingDirectory = dir ?? "" };
        foreach (var arg in args) info.ArgumentList.Add(arg);
        return info;
    }
}
