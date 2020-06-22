title: Workflow complete form in advance
--

h3(feature). "haplo:complete_form_in_advance_of_workflow"

This plugin provides functionality for filling out forms ahead of starting the associated workflow, e.g. for inputting panel logistics for progress reviews in advance.

h2. Usage:

<pre>language=javascript
EgWorkflow.use("haplo:complete_form_in_advance_of_workflow", spec);
</pre>

The feature takes a spec containing the following keys:

| @name@ | Unique name for the document store |
| @form@ | FormDescription, passed to docstore @formsForKey@ |
| @formTitle@ | (optional) String, used for @infoPageBuildService@ 'Edit'/'View' link text |
| @infoPageBuildService@ | (optional) Service name for including on a "@haplo:information_page@":/haplo-plugins/haplo_information_pages |
| @dashboardName@ | (optional) Name of dashboard to include 'Edit' links |
| @workflowDocumentStore@ | (optional) Name of workflow document store. If provided and the workflow is open at the point of editing, used to keep the two document stores in sync. Requires @delegateOnEnter@ and @clearOnExit@ selectors to be set. |
| @canUpdateDetails@ | Action object specifying who can edit the form |
| @canViewDetails@ | Action object specifying who can view the form document |
| @delegateOnEnter@ | Selector used with @observeEnter@. Tags the workunit to indicate the data has been handed over to the workflow. (required if @workflowDocumentStore@ is used) |
| @clearOnExit@ | Selector used with @observeExit@ to clear the document store. Use this after transferring data to e.g. a @haplo:meeting_scheduling@ form in the workflow to remove any duplicated data |
| @pageTitle(project)@ | (optional) Function returning a string to append to form/overlay page title |
| @blankDocument(project)@ | (optional) Equivalent to @blankDocumentForKey@, applied if current document is empty |
| @updateDocumentBeforeEdit(project, document)@ | (optional) Equivalent to document store @updateDocumentBeforeEdit@ function |
| @onConfirm(document, project)@ | (optional) Called when saved if form is complete |

This registers a docstore, uniquely identified by its @spec.name@. You can then fill in the form directly by linking to the following handler:

h3(handler). /do/haplo-workflow-complete-form-in-advance/input-details

* *REQUIRED* Path element @1@ : project @ref@
* *REQUIRED* Path element @2@ : @spec.name@ as defined above
* _*OPTIONAL*_ Path element @3@ : if "overlay", display using @Haplo.ui.openCovering()@

It may be more convenient to access this either from an information page or by integrating it into a dashboard.

h3(service). "haplo:complete_form_in_advance_of_workflow:get_document:"+spec.name

Call this service with the project ref as the only argument to retrieve the docstore's @lastCommittedDocument@.

h2. Information page integration

To include a link on the workflow's overview page for individual projects, set up the page as an "information page":/haplo-plugins/haplo_information_pages - replace @E.render({})@ in your overview handler with the following, and set the @infoPageBuildService@ name in the advance form feature spec.

<pre>language=javascript
let builder = O.service("haplo:information_page:overview", {
    buildService: "client_eg_workflow:project_overview_page",
    pageTitle: "E.g Workflow overview",
    object: project
}).
section(100, P.template("overview").deferredRender({
    // ...
})).
respond(E);
</pre>

This will include a sidebar link to the form titled @'Edit '+spec.formTitle@ if the user has permission to edit the form, or @'View '+spec.formTitle@ if the user has permission to view the document.

h2. Dashboard integration

To complete the form via a dashboard, set the @spec.dashboardName@ property. This will add a column to the end of the specified dashboard with an 'Edit' link for each row, which opens the form for that row's project as an overlay.

The default overlay page title is 'Edit details'. You can optionally use @spec.pageTitle(project)@ to append extra text, e.g. to confirm the right dashboard row was selected: "PGR name : School"

You will need to update @get_facts_for_object@ for your collection to retrieve the saved details, and invalidate facts for that object (e.g. in @spec.onConfirm@ ) to ensure they display on the dashboard.

If you are using this feature to register panel scheduling arrangements in advance, it may be useful to integrate this with the 'upcoming panels and vivas' dashboard.
Set the @phd_doctoral_supervision:advance_panel_scheduling_types@ config data with the @spec.name@ set above and a display title to include on the dashboard. (see "PhD doctoral supervision":/phd/phd_doctoral_supervision#reporting)

h2. workflowDocumentStore usage

If the feature still needs to be used after the workflow has started (e.g. for rescheduling progression panels via a dashboard), provide the corresponding document store in the workflow as @spec.workflowDocumentStore@. This allows the feature to keep the two stores in sync by loading the latest workflow document store contents before editing the advance form, and sets the workflow store currentDocument on submitting the advance form.
This requires the selectors @delegateOnEnter@ and @clearOnExit@ to be set, marking the range of states for which the feature should reflect changes to the document store.

h2. Example usage

Leicester probation
LBU confirmation of registration

*NOTE:* Each document in the document store is uniquely identified by project ref. If your workflow is likely to have multiple concurrent applications, each requiring its own advance form, this feature may not be suitable.