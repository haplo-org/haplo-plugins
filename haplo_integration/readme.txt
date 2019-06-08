title: Haplo Integration
module_owner: Ben
--

The @haplo_integration@ plugin provides admin tool for managing and debugging integrations with external systems, such as "integration messages":/haplo-plugins/haplo_integration_messages and "user syncs":/haplo-plugins/haplo_user_sync

A few admin pages are provided by this plugin:

| "/do/haplo-integration/admin" | A page that links to the error page (see below), and also to admin pages for all of the integrations included in this system |
| "/do/haplo-integration/errors" | A page that lists all of the errors that have happened in integrations in this system, split into current and acknowledged sections. |

Errors can be marked as acknowledged once they have been seen, and any actions needed based upon them have been taken. Thismoves hem from the current errors section, but they will remain available for viewing.


h3(service). @haplo:integration:error@

Call this service from the implementation of an integration to an external system to save any instances of errors that occur during that integration for viewing later. It is called with one parameter: @error@, which contains the fields (all optional) @message@, @details@, and @source@.

