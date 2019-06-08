title: Integration messages
module_owner: Jenny
--

The purpose of the @haplo_integration_messages@ plugin is to facilitate sending batches of messages (structured information, e.g. XML files providing details of events that happened within the system) to external systems. It accepts messages from elsewhere in the system, and then provides a framework for sending them at regular intervals or letting an external system poll for new messages. 

It's important that the data stored in the message is complete, containing all information needed to send the information to the external system. If it doesn't contain everything, you could make troubleshooting later more difficult than it needs to be. (If you're implementing a custom formatter, it shouldn't need any additional logic which loads information from a database.)

See https://support.haplo.com/setup/integrations for details of the APIs and admin UI this exposes.

h3(service). @haplo:integration-message:discover@

Implement this service so your message queue appears in the admin UI, and the relevant integration methods are enabled.

<pre>language=javascript
P.implementService("haplo:integration-message:discover", function(discover) {
    discover({
        group: "student",
        method: "poll",
        title: "Student Records System update messages",
        description: "Send messages to student records system in response to events"
    });
});
</pre>

@method@ may be @"poll"@ or @"send"@.

h3(service). @haplo:integration-message:add@

Queue up a message to be sent a later time. Takes one @details@ argument, with the following properties:

| @group@ | The type of message to be sent. This should correspond to an implementation of @haplo:integration-message:format-http-request@ (described below) |
| @data@ | Any data that is necessary to be able to send the message. This will be determined by the implementation, and should be documented elsewhere. |

h3(service). @haplo:integration-message:send@

Used when the message queue pushes messages to an external service.

Send all queued up messages, and mark them as sent. Takes one @details@ argument, with one property, @group@. This should correspond to the group used when the messages were added, and to an implementation of @haplo:integration-message:format-http-request@.

This is called on a schedule determined by the client plugin. For instance, implement the hook @hScheduleDailyEarly@ to send messages once a day in the early morning.

h3(service). @haplo:integration-message:write-messages:GROUP@

The purpose of this service is to format all of the messages that we have stored for a particular group. For instance, while we store data about the messages in JSON format, the client's system may have particular requirements, or they don't like our default format.

Implementing this service is optional, and a reasonable JSON format will be generated if there's no formatter.

*IMPORTANT* - this service should not load objects or data from databases to format this message, as that could make the formatted output change over time, and make it harder to debug integrations.

Arguments are an array of messages, and a token representing the message list that may be used by the client to mark them as sent if they're using the poll API.

Returns a BinaryData object.

@function(messages, token)@

@messages@ is an array of messages. Messages are object with properties @id@, which is a unique id for the message, and @data@, which is the data stored for the message. Implementations should use the data for the messages to set body of @httpClient@ to the correct format.

@token@ is the token used for marking messages as read, eg in the poll API.

