using ArcanumMessenger.Entities;

namespace ArcanumMessenger.Controllers.Messenger;

internal static class PrivacyEnumConverters
{
    public static string ToApiString(this PhoneVisibility v) => v switch
    {
        PhoneVisibility.Everyone => "everyone",
        PhoneVisibility.Contacts => "contacts",
        PhoneVisibility.Nobody => "nobody",
        _ => "contacts"
    };

    public static bool TryParsePhoneVisibility(string value, out PhoneVisibility result)
    {
        switch (value)
        {
            case "everyone": result = PhoneVisibility.Everyone; return true;
            case "contacts": result = PhoneVisibility.Contacts; return true;
            case "nobody": result = PhoneVisibility.Nobody; return true;
            default: result = default; return false;
        }
    }

    public static string ToApiString(this AddPermission v) => v switch
    {
        AddPermission.Everyone => "everyone",
        AddPermission.Contacts => "contacts",
        _ => "everyone"
    };

    public static bool TryParseAddPermission(string value, out AddPermission result)
    {
        switch (value)
        {
            case "everyone": result = AddPermission.Everyone; return true;
            case "contacts": result = AddPermission.Contacts; return true;
            default: result = default; return false;
        }
    }

    public static bool TryParseThemes(string value, out Themes result)
    {
        switch (value)
        {
            case "system": result = Themes.System; return true;
            case "dark": result = Themes.Dark; return true;
            case "light" : result = Themes.Light; return true;
            default: result = default; return false;
        }
    }

    public static bool TryParseNotifications(string value, out Notifications result)
    {
        switch (value)
        {
            case "bubble" : result = Notifications.Bubble; return true;
            case "chime" : result = Notifications.Chime; return true;
            case "bell" : result = Notifications.Bell; return true;
            default: result = default; return false;
        }
    }

    public static bool TryParseLanguages(string value, out Languages result)
    {
        switch (value)
        {
            case "en": result = Languages.En; return true;
            case "uk": result = Languages.Uk; return true;
            case "de": result = Languages.De; return true;
            default: result = default; return false;
        }
    }
}