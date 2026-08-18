using System.Text.Json;
using System.Text.Json.Serialization;

namespace GiftCardPortal.Bff.Backend;

public partial class BackendApiClient
{
    static partial void UpdateJsonSerializerSettings(JsonSerializerOptions settings)
    {
        settings.Converters.Add(new GiftCardLifecycleActionJsonConverter());
        settings.Converters.Add(new RecipientContactTypeJsonConverter());
        settings.Converters.Add(new AuditActorTypeJsonConverter());
        settings.Converters.Add(new AuditOutcomeJsonConverter());
    }
}

internal sealed class RecipientContactTypeJsonConverter :
    JsonConverter<RecipientContactType>
{
    public override RecipientContactType Read(
        ref Utf8JsonReader reader,
        Type typeToConvert,
        JsonSerializerOptions options)
    {
        if (reader.TokenType == JsonTokenType.Number &&
            reader.TryGetInt32(out var numericType) &&
            numericType is 1 or 2)
        {
            return (RecipientContactType)numericType;
        }

        if (reader.TokenType == JsonTokenType.String)
        {
            return reader.GetString()?.ToLowerInvariant() switch
            {
                "email" => (RecipientContactType)1,
                "phone" => (RecipientContactType)2,
                _ => throw new JsonException(
                    "The backend returned an unsupported recipient contact type."),
            };
        }

        throw new JsonException(
            "The backend returned an invalid recipient contact type representation.");
    }

    public override void Write(
        Utf8JsonWriter writer,
        RecipientContactType value,
        JsonSerializerOptions options)
    {
        var numericType = (int)value;
        if (numericType is not (1 or 2))
        {
            throw new JsonException(
                "The portal attempted to write an unsupported recipient contact type.");
        }

        writer.WriteNumberValue(numericType);
    }
}

internal sealed class AuditActorTypeJsonConverter :
    JsonConverter<AuditActorType>
{
    public override AuditActorType Read(
        ref Utf8JsonReader reader,
        Type typeToConvert,
        JsonSerializerOptions options)
    {
        if (reader.TokenType == JsonTokenType.Number &&
            reader.TryGetInt32(out var numericType) &&
            numericType is >= 1 and <= 5)
        {
            return (AuditActorType)numericType;
        }

        if (reader.TokenType == JsonTokenType.String)
        {
            return reader.GetString()?.ToLowerInvariant() switch
            {
                "platformoperator" => (AuditActorType)1,
                "organizationmember" => (AuditActorType)2,
                "system" => (AuditActorType)3,
                "identityuser" => (AuditActorType)4,
                "posclient" => (AuditActorType)5,
                _ => throw new JsonException(
                    "The backend returned an unsupported audit actor type."),
            };
        }

        throw new JsonException(
            "The backend returned an invalid audit actor type representation.");
    }

    public override void Write(
        Utf8JsonWriter writer,
        AuditActorType value,
        JsonSerializerOptions options)
    {
        var numericType = (int)value;
        if (numericType is < 1 or > 5)
        {
            throw new JsonException(
                "The portal attempted to write an unsupported audit actor type.");
        }

        writer.WriteNumberValue(numericType);
    }
}

internal sealed class AuditOutcomeJsonConverter :
    JsonConverter<AuditOutcome>
{
    public override AuditOutcome Read(
        ref Utf8JsonReader reader,
        Type typeToConvert,
        JsonSerializerOptions options)
    {
        if (reader.TokenType == JsonTokenType.Number &&
            reader.TryGetInt32(out var numericOutcome) &&
            numericOutcome is 1 or 2)
        {
            return (AuditOutcome)numericOutcome;
        }

        if (reader.TokenType == JsonTokenType.String)
        {
            return reader.GetString()?.ToLowerInvariant() switch
            {
                "success" => (AuditOutcome)1,
                "failure" => (AuditOutcome)2,
                _ => throw new JsonException(
                    "The backend returned an unsupported audit outcome."),
            };
        }

        throw new JsonException(
            "The backend returned an invalid audit outcome representation.");
    }

    public override void Write(
        Utf8JsonWriter writer,
        AuditOutcome value,
        JsonSerializerOptions options)
    {
        var numericOutcome = (int)value;
        if (numericOutcome is not (1 or 2))
        {
            throw new JsonException(
                "The portal attempted to write an unsupported audit outcome.");
        }

        writer.WriteNumberValue(numericOutcome);
    }
}

internal sealed class GiftCardLifecycleActionJsonConverter :
    JsonConverter<GiftCardLifecycleAction>
{
    public override GiftCardLifecycleAction Read(
        ref Utf8JsonReader reader,
        Type typeToConvert,
        JsonSerializerOptions options)
    {
        if (reader.TokenType == JsonTokenType.Number &&
            reader.TryGetInt32(out var numericAction) &&
            numericAction is >= 1 and <= 4)
        {
            return (GiftCardLifecycleAction)numericAction;
        }

        if (reader.TokenType == JsonTokenType.String)
        {
            return reader.GetString()?.ToLowerInvariant() switch
            {
                "suspend" => (GiftCardLifecycleAction)1,
                "reactivate" => (GiftCardLifecycleAction)2,
                "cancel" => (GiftCardLifecycleAction)3,
                "expire" => (GiftCardLifecycleAction)4,
                _ => throw new JsonException(
                    "The backend returned an unsupported lifecycle action."),
            };
        }

        throw new JsonException(
            "The backend returned an invalid lifecycle action representation.");
    }

    public override void Write(
        Utf8JsonWriter writer,
        GiftCardLifecycleAction value,
        JsonSerializerOptions options)
    {
        var numericAction = (int)value;
        if (numericAction is < 1 or > 4)
        {
            throw new JsonException(
                "The portal attempted to write an unsupported lifecycle action.");
        }

        writer.WriteNumberValue(numericAction);
    }
}
