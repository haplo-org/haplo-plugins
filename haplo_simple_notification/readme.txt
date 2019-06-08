title: Haplo Simple Notification
--
This is a layer on top of the @WorkUnit@ functionality to be used as a simple method for sending tasks to users, including email notifications. Recipients can also choose to reply where replies are sent to the user found in the @createdBy@ property of the @WorkUnit@.

h3(service). "haplo:simple_notification:details:"+kind

To declare a notification kind in your plugin begin by registering the service like:

<pre>language=javascript
P.implementService("haplo:simple_notification:details:example_plugin:example", function(workUnit) {
    return {
    	...
    }
});
</pre>

where the @serviceFunction@ takes 1 argument:

# JavaScript object implementing the @WorkUnit@ interface being the instance of your notification kind.

To avoid conflicts with other plugins please prefix the 'type' string with the name of the plugin where you registered the service you are using (and a colon).

Now return your definition as an object with the following properties:

h3(property). title

*REQUIRED*: a string used for visually identifying your notification kind on pages and emails.

h3(property). text

*REQUIRED*: a string of the message of your notification.

h3(property). buttonLabel

A string of the name of the 'task complete' confirmation button.

Defaults to "Mark as complete".

h3(property). taskNote

A string of the prompt that appears on the task list.

Default is "Please mark this as complete".

h3(property). link

A string of a request handler path.

Use this property to override the default request handling which uses a @std:ui:confirm@ template but remember that you will be responsible for closing the task @WorkUnit@ (which is not passed to your request handler for you).

h3(service). haplo:simple_notification:create

Creates an instance of your notification kind.

h4. Usage

Call the service with a JavaScript object which can consist of:

h3(property). kind

*REQUIRED*: the suffix string you used to declare your notification kind (see above).

h3(property). recipient

The @SecurityPricipal@ of the user/group receiving the task.

Can be set with a numeric @ID@ or @SecurityPrincipal object@ (as it is set on the actionableBy property).

h3(property). ref

A @Ref@ object which you want the notification instance to refer to.

Incidently the notification instance (@WorkUnit@) will be displayed on that object's page.

h3(property). data

JavaScript object with items of your choice that can be serialised to JSON.

Use to store arbitrary data about the state of the notification instance.

h3(property). workflow

A @WorkflowInstance@ such that replies will be saved to the timeline of it.

h3(property). deduplicate

A boolean that if true the notification will not be created if an instance of the notification kind exists for the @recipient@ and @ref@ given.

h3(service). haplo:simple_notification:closed:example:example_kind
 
By default when 'task complete' is confirmed in the @std:ui:confirm@ template you'll be redirected to the task list.

You can customise this by returning a string of your own path for @E.response.redirect()@.
