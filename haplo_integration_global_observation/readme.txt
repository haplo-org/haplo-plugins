title: Global observer
module_owner: Ben
--

* Add the @"haplo_integration_global_observation"@ plugin to dependencies. (I've added it to the demo application in this branch.)

* In System Management, add line of config data @"haplo_integration_global_observation:enabled":true@. Don't add it to the client_application config data so that initial creation of objects in the system and data loading doesn't result in huge amounts of messages.

* Then editing objects and workflows transitioning add messages to an integration queue. To see the contents, click @SUPPORT -> Integrations -> Integration messages queue -> Global observation@

* See the documentation of the [underlying message queue API](https://support.haplo.com/setup/integrations/message-queue)

* As you run through workflows, use the admin UI page to see the various messages added. These are all based around objects (which is probably what we want) and includes the object attributes, and all workflows attached to it. And each workflow includes all the docstore forms. I think this is all the info they'll need to sync up the other systems.

* Where possible, in object attributes, there's a @"username"@ property from the user sync. So to demo it properly for them, you'll need to have the user sync installed and used to ingest data. Currently in forms, you only get the ref of any people you add, which is unhelpful. Not urgent though as most of the info is in the object attributes, which does have usernames.

* See the top of the @haplo_integration_global_observation.js@ file for a few config options.

* There is a new temporary @"JSON"@ button for superusers on all object pages, which allows you to see the JSON that would be added for the object, without being put inside a message.
