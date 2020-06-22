title: Group notification queue
--

Use interface below to add simple tasks to system-wide queues that are assigned to a particular group.

Members of the group have a central page where all outstanding/done tasks are listed, with any queue with outstanding tasks having an open work unit associated with said queue.

A queue task is a database row with the columns:

* schema @GROUP@ constant,
* task type,
* @Ref@ of source of task,
* the time it was pushed,
* the time it was completed and
* the user of the group that completed it.

h3(service). haplo:group_notification_queue:task_definition:TASK_TYPE

**REQUIRED**: Implement this service to return a @JavaScript@ object with the properties below for given ref of the object linked to the task in the queue.

h3(property). description

The description of the task in the queue.

h3(property). deferredRenderDescription

A deferred render in place of the @description@ property from above.

h3(service). haplo:group_notification_queue:push

Call service with a @JavaScript@ object with the properties below to push a task to the queue.

h3(property). group

**REQUIRED**: schema @GROUP@ constant of the group that identifies the queue which the task is pushed to.

h3(property). type

**REQUIRED**: the queue task type.

Used to call the @haplo:group_notification_queue:task_definition:TASK_TYPE@ service above.

h3(property). ref

**REQUIRED**: the @Ref@ of the source of the task.

This enables linking back and de-duplication.

h3(property). deduplicateOnRef

Boolean of whether to push the task if one with the required identifying properties above already exists and hasn't been done.

h3(service). haplo:group_notification_queue:queue_definition:SCHEMA_GROUP_CONSTANT

Implement this service to return a @JavaScript@ object with the properties below for the given number of tasks outstanding in the queue.

h3(property). pageTitle

The page title of the group queue.

**DEFAULT**: "Updates ([ group name from @SecurityPrincipal@ ])"

h3(property). workUnitTitle

The title of the associated work unit of the group queue with outstanding tasks.

**DEFAULT**: "Outstanding updates to complete"

h3(property). workUnitMessage

The message of the associated work unit of the group queue with outstanding tasks.

**DEFAULT**: "[ number of outstanding queue tasks ] [ update / updates ] to complete"

h3(service). haplo:group_notification_queue:url:action_page

Call this service with the schema @GROUP@ constant to get the URL of their queue.

If there are no outstanding queue tasks, the URL will be for the completed queue tasks page.
