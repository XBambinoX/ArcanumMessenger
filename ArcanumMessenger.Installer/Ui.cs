using Spectre.Console;

namespace ArcanumMessenger.Installer;

sealed class FatalException(string message) : Exception(message);

// All text is escaped here, so a path or an address never gets read as markup.
static class Ui
{
    // Brand colours, from index.css
    const string Violet = "#7c3aed";
    const string VioletLight = "#a78bfa";
    const string Green = "#4fb85c";
    const string Yellow = "#fbbf24";
    const string Red = "#f87171";

    static bool Unicode => AnsiConsole.Profile.Capabilities.Unicode;
    static string Esc(string text) => Markup.Escape(text);

    public static void Banner(string subtitle)
    {
        var title = new Markup($"[bold {VioletLight}]A R C A N U M[/]\n[dim]{Esc(subtitle)}[/]").Centered();
        AnsiConsole.WriteLine();
        AnsiConsole.Write(new Panel(title)
            .Border(BoxBorder.Rounded)
            .BorderColor(Color.FromHex(Violet))
            .Padding(new Padding(6, 1)));
    }

    public static void Section(string title)
    {
        AnsiConsole.WriteLine();
        AnsiConsole.MarkupLine($"[bold {VioletLight}]{Esc(title)}[/]");
    }

    public static void Note(string text) => AnsiConsole.MarkupLine($"[dim]{Esc(text)}[/]");
    public static void Ok(string text) => AnsiConsole.MarkupLine($"[{Green}]{(Unicode ? "✓" : "+")}[/] {Esc(text)}");
    public static void Warn(string text) => AnsiConsole.MarkupLine($"[{Yellow}]![/] {Esc(text)}");
    public static void Fail(string text) => AnsiConsole.MarkupLine($"[{Red}]{(Unicode ? "✗" : "x")}[/] {Esc(text)}");
    public static FatalException Die(string text) => new(text);

    // Asks until it gets a non-empty answer.
    public static string Ask(string question, string? defaultValue = null, bool secret = false)
    {
        var prompt = new TextPrompt<string>($"[{Violet}]?[/] {Esc(question)}").PromptStyle(VioletLight);
        if (defaultValue != null) prompt.DefaultValue(defaultValue).DefaultValueStyle("dim");
        if (secret) prompt.Secret();
        return AnsiConsole.Prompt(prompt).Trim();
    }

    public static string AskOptional(string question) =>
        AnsiConsole.Prompt(new TextPrompt<string>($"[{Violet}]?[/] {Esc(question)}")
            .PromptStyle(VioletLight)
            .AllowEmpty()).Trim();

    public static bool Confirm(string question, bool defaultValue) =>
        AnsiConsole.Prompt(new ConfirmationPrompt($"[{Violet}]?[/] {Esc(question)}") { DefaultValue = defaultValue });

    public static string Choose(string question, params string[] choices) =>
        AnsiConsole.Prompt(new SelectionPrompt<string>()
            .Title($"[{Violet}]?[/] {Esc(question)}")
            .HighlightStyle(new Style(Color.FromHex(VioletLight), decoration: Decoration.Bold))
            .UseConverter(Esc)
            .AddChoices(choices));

    // Everything starts selected.
    public static List<string> ChooseMany(string question, IReadOnlyList<string> choices)
    {
        var prompt = new MultiSelectionPrompt<string>()
            .Title($"[{Violet}]?[/] {Esc(question)}")
            .InstructionsText("[dim](space toggles, enter confirms)[/]")
            .HighlightStyle(new Style(Color.FromHex(VioletLight)))
            .UseConverter(Esc)
            .NotRequired()
            .AddChoices(choices);
        foreach (var choice in choices) prompt.Select(choice);
        return AnsiConsole.Prompt(prompt);
    }

    public static Task<T> Spin<T>(string title, Func<Task<T>> work) =>
        AnsiConsole.Status()
            .Spinner(Spinner.Known.Dots)
            .SpinnerStyle(new Style(Color.FromHex(VioletLight)))
            .StartAsync(Esc(title), _ => work());

    public static void Box(IEnumerable<string> markupLines) =>
        AnsiConsole.Write(new Panel(new Markup(string.Join('\n', markupLines)))
            .Border(BoxBorder.Rounded)
            .BorderColor(Color.FromHex(Violet))
            .Padding(new Padding(3, 1)));

    public static string Bold(string text, string colour) => $"[bold {colour}]{Esc(text)}[/]";
    public static string Plain(string text) => Esc(text);
    public static string Dim(string text) => $"[dim]{Esc(text)}[/]";
    public const string GreenColour = Green;
    public const string YellowColour = Yellow;
}
