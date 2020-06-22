title: Workflow interview scheduling
--
h3(feature). haplo:meeting_scheduling

Adds functionality for meeting scheduling to workflows. This includes the date forms, UI, and automatic transitioning of the workflow after the meeting has taken place.

When passing through arranging state for an extra time consider skipping it; we should rethink what this feature does at such stages.

Feature spec contains:

h3(property). path

*REQUIRED*: the response path of the consuming plugin, as defined in its plugin.json file.

h3(property). meetingTransition

*REQUIRED*: the name of the transition to the post-meeting state.

Used for automatic transitioning on the day of the interview (possibly - attempted on each early morning).

Can be from many pre-meeting states, but all should have the same transition name.

h3(property). meetingDateDesc

Attribute schema object to use instead of @haplo:attribute:meeting-date@.

Use this property if you need different types of interviews to be used on the workflow object.

h3(property). meetingLocationDesc

Attribute schema object to use instead of @haplo:attribute:meeting-location@.

Use this property if you need different types of interviews to be used on the workflow object.

h3(property). documentStore

*REQUIRED*: a @std:document_store@ specification js object except some keys are in the form of:

bq. customFormsForKey, customPrepareFormInstance, customBlankDocumentForKey, customUpdateDocumentBeforeEdit, customShouldEditForm, customShouldDisplayForm, customGetAdditionalUIForViewer and customGetAdditionalUIForEditor.

Sensible UI is provided for when entering an interview date in the past.

History is not viewable by default - provide a history property in the documentStore specification to override this.

Custom text can be implemented using usual document store workflow text system integration.

h4. Form contract

If the default meeting arranging form is not suitable, customFormsForKey must have:

* a *required* path @date@ of type @date@;
* if time can be entered it is the string in the form of @HH:MM@ stored at path @time@ and
* if a location can be entered it is stored at path @location@.

@date@ and @time@ paths are used to populate the @haplo:attribute:meeting-date@ desc of the workflow object where time toggles DateTime precision constant Minute. @location@ is used to populate @haplo:attribute:meeting-location@ desc of the workflow object.

h3(function). onScheduled(M, document)

is called as soon as the meeting has been scheduled and right before document is committed.

h3(function). onSaveCompletedForm(featureSpec, M, workflowObject, document)

where you can do your own actions right before interview is scheduled.

This is actually @onSetCurrentDocument@ except only when document @isComplete@ and not equal to the last committed.

If you return a truthy, feature will not update the system with the schedule entered by user (or call @onSchedule(...)@) for you.

h3(property). projectDate

is the string name of Project Date to save interview date to.

h3(service). haplo_meeting_scheduling:meeting_date_passed

is called to update the @projectDate@ if specified and perform the @meetingTransition@ if available at this stage for your workflow on day of the meeting using @hScheduleDailyEarly@.

Call the service with:

* *REQUIRED:* @arg1@ being a js object, possibly implementing the @WorkUnit@ interface.
* @arg2@ being the result of @SCHEMA.getAttributeInfo()@ for the @meetingDateDesc@ if used otherwise it is assumed that the context is @haplo:attribute:meeting-date@.

If the system was updated with the schedule by this feature you should probably delete the @tag("interviewScheduled", "t")@ after calling this service as it could be repeated in the future since it is internally used. Incidentally this is the tag you can use to find workflow instances with outstanding interviews.

Implement this service to listen to when interview dates pass for a potential @WorkUnit@.


h3(service). haplo_meeting_scheduling:get_used_worktype_meeting_date_desc

If called, returns workTypeMeetingDateDescsUsed to be sure the correct attributes are checked for meeting specific data, see usage in ds_researcher_reporting.js.
