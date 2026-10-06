namespace ArcanumMessenger.Installer;

// The running app: the compose file in Paths.Home and its containers.
static class Stack
{
    public const string ApiContainer = "arcanum-api-prod";
    public const string ClientContainer = "arcanum-client-prod";
    public const string DbVolume = "arcanum-prod_postgres_data_prod"; // compose project "arcanum-prod" + the volume's name
    const string ImagePrefix = "ghcr.io/xbambinox/";

    public static bool Installed => File.Exists(Paths.Env) && File.Exists(Paths.Compose);

    public static int Compose(params string[] args) => Shell.Run(Paths.Home, "docker", ["compose", .. args]);

    public static Task<(int Code, string Out, string Err)> ComposeCapture(params string[] args) =>
        Shell.CaptureIn(Paths.Home, "docker", ["compose", .. args]);

    public static async Task CheckDocker()
    {
        Ui.Section("Requirements");
        var desktop = !OperatingSystem.IsLinux();
        if (!Shell.Exists("docker"))
            throw Ui.Die(desktop
                ? "Docker isn't installed - get Docker Desktop at https://www.docker.com/products/docker-desktop/"
                : "Docker isn't installed - see https://docs.docker.com/engine/install/");
        if ((await Shell.Capture("docker", "compose", "version")).Code != 0)
            throw Ui.Die("The Docker Compose plugin ('docker compose') isn't installed.");
        if ((await Shell.Capture("docker", "info")).Code != 0)
        {
            var user = Environment.UserName;
            throw Ui.Die(desktop
                ? "Can't reach Docker. Start Docker Desktop and wait until it says it's running."
                : $"Can't reach the Docker daemon. Is it running, and can {user} use it? (sudo usermod -aG docker {user}, then log in again)");
        }

        var server = (await Shell.Capture("docker", "version", "--format", "{{.Server.Version}}")).Out;
        var compose = (await Shell.Capture("docker", "compose", "version", "--short")).Out;
        Ui.Ok($"Docker {server} with Compose {compose}");
    }

    // The compose file ships inside this binary, so it always matches the images it pulls.
    public static void WriteComposeFile(string version, string tag)
    {
        using var resource = typeof(Stack).Assembly.GetManifestResourceStream("docker-compose.yml")!;
        var compose = new StreamReader(resource).ReadToEnd().Replace("${ARCANUM_TAG:-latest}", tag);
        var header = $"# Written by the Arcanum installer {version}. `arcanum update` replaces this file - keep your changes in .env.\n\n";
        File.WriteAllText(Paths.Compose, header + compose);
    }

    public static async Task<bool> VolumeExists(string name) =>
        (await Shell.Capture("docker", "volume", "inspect", name)).Code == 0;

    public static async Task<List<string>> OwnImages()
    {
        var (_, images, _) = await ComposeCapture("config", "--images");
        return images.Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Where(image => image.StartsWith(ImagePrefix))
            .ToList();
    }

    static async Task<string> Inspect(string container, string format) =>
        (await Shell.Capture("docker", "inspect", "-f", format, container)).Out;

    // The compose service behind each container we wait for
    static readonly (string Container, string Service)[] Watched = [(ApiContainer, "api"), (ClientContainer, "client")];

    // null when everything is healthy; otherwise the service that keeps failing, or the slowest one after 5 minutes.
    public static async Task<(string Service, bool Failing)?> WaitUntilHealthy()
    {
        var waitingFor = "api";
        for (var i = 0; i < 150; i++)
        {
            var allHealthy = true;
            foreach (var (container, service) in Watched)
            {
                var health = await Inspect(container, "{{if .State.Health}}{{.State.Health.Status}}{{end}}");
                var restarts = int.TryParse(await Inspect(container, "{{.RestartCount}}"), out var n) ? n : 0;
                if (health == "unhealthy" || restarts > 0) return (service, true);
                if (health != "healthy" && allHealthy) waitingFor = service;
                allHealthy &= health == "healthy";
            }
            if (allHealthy) return null;
            await Task.Delay(TimeSpan.FromSeconds(2));
        }
        return (waitingFor, false);
    }
}
