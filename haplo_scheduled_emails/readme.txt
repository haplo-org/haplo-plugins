title: Scheduled emails
module_owner: TODO
--

h3(service). "haplo:scheduled_emails:discover_implementations"

This plugin provides functionality for registering scheduled emails with types, to be sent out for each object of that type at pre-defined intervals.

h2. Usage:

In your plugin you should define standalone entities using @P.hresCombinedApplicationStandaloneEntities()@, e.g.

<pre>language=javascript
var standaloneEntities = P.hresCombinedApplicationStandaloneEntities({
    supervision_meeting: function() {
        return this.object_refList;
    },
    pgr: ["supervision_meeting", A.Researcher]
});
</pre>

You should then register the @discover_implementations@ service:

<pre>language=javascript
P.implementService("haplo:scheduled_emails:discover_implementations", function(discover) {
    discover.scheduledEmail({
        // ...
    });
});
</pre>

@discover.scheduledEmail()@ takes a spec with the following keys:

| @kind@ | Unique internal identifier |
| @displayName@ | Displayed on scheduled email testing pages. Not @NAME@ interpolated |
| @objectType@ | e.g. @T.SupervisionMeeting@ |
| @panelName@ | the action panel for the email testing link |
| @getDateForObject(obj)@ | A function returning a list of date objects, or an empty list if no scheduled emails should be sent (e.g. if a student has suspended) |
| @getSpecForObject(obj)@ | A function returning the spec for the email (template, recipients, view etc.) |
| @entities(obj)@ | A function returning the entities for your object, e.g @standaloneEntities.constructEntitiesObject(obj.ref)@ |

Each implementation can define multiple scheduled emails by calling @discover.scheduledEmail()@ multiple times, with each identified by a unique @kind@ key.


h2. Testing

h3(config). "haplo_scheduled_emails:enable_test_in_application"

To enable testing scheduled emails in your application you must set this config data to the application hostname.

If a panelName has been provided in the @scheduledEmail@ spec a link will be added to that action panel, allowing testing scheduled emails for individual objects. The testing page includes a list of scheduled emails registered for that object along with the dates they will be sent and the option to test each email.

Handlers for testing are also provided:

h3(handler). /do/haplo-scheduled-emails/test-scheduling

Test all emails scheduled to be sent today.

h3(handler). /do/haplo-scheduled-emails/test-emails

Optional path element: Object (string ref). Limit list to scheduled emails for that object, as used by 'Test scheduled emails for object' above.
If accessed without an object will list all objects in the application with scheduled emails.

NB. If the page is viewed without an object parameter, using the 'test' button will send all emails scheduled for that date for all objects of that type (not limited to the object you clicked on).

h2. Example usage

PhD supervision meetings
Westminster funding 2019