title: Workflow review documents
--

h2. Background

This plugin provides a workflow feature to force users making workflow transitions to review the committed or edited contents of document stores that are visible to them.

h3(feature). haplo:workflow:force_review_documents

The minimal setup is:

<pre>language=javascript
EgWorkflow.use("haplo:workflow:force_review_documents", { selector: {} });
</pre>

To customise the behaviour of the feature set the following:

h3(property). selector

**REQUIRED**: A @Selector@ that chooses which states need this force approval step.

It is recommended you use a @{flags:[...]}@ style selector, applying a single flag from the list on a state definition.

h3(property). filterDocumentStores

A list of Filter Rule objects (see below).

By default all forms that the user is permitted to see will be displayed for review but you can specify a subset of the document stores to be reviewed at certain times.

**REMEMBER**: Filter Rules are applied in order such that if they overlap the last is applied.

You can apply this feature to the workflow only once.

h3(config). "haplo_force_review_documents:use_transition_decision_forms_filtering"

It is also possible to specify a subset of transition decision forms to be reviewed, following the same set of rules. To do so, add the above to your system's config data and set it to true.

h2. Filter Rule

A JavaScript object which you can set options:

h3(property). selector

A @Selector@ that chooses when a subset of document stores should be reviewed.

h3(property). set

A list of document store names (or transition decision form @formId@s) that should be reviewed.

h3(property). exclude

A list of document store names (or transition decision form @formId@s) that should not be reviewed.

h3(service). haplo:workflow:review_documents:review_ui_deferred

Returns a Review UI (see below) or @undefined@ if no document stores were selected for review.

This service is provided so that you can integrate a workflow's forced Review UI in other places and plugins.

The document stores for review are selected as always according to the specification (see above) applied on the workflow.

h4. Usage

Call the service with:

* *REQUIRED:* @arg1@ being a @WorkflowInstance@ object
* *REQUIRED:* @arg2@ being a @SecurityPrincipal@ object.

Example:

<pre>language=javascript
var M = O.service("std:workflow:definition_for_name", workUnit.workType).instance(workUnit);
var reviewUI = O.service("haplo:workflow:review_documents:review_ui_deferred", M, O.currentUser));
</pre>

h2. Review UI

A JavaScript object with deferred interface values:

h3(key). documents

A deferred rendering of the document stores selected for review.

h3(key). links

A deferred rendering of links that can be used to navigate to document stores up and down the page.

This will render nothing if there is only 1 document store to review.
