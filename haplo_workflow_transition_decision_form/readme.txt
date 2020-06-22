title: Workflow transition decision form
--

h2. Background

This plugin provides a workflow feature to display a form on the transition page, and display the submitted information in the workflow's action panel.

A Form object is provided by the consuming plugin. The name of the form will be used in the UI, and the ID of the form to distinguish forms within the workflow.

h3(feature). haplo:transition_decision_form

<pre>language=javascript
EgWorkflow.use("haplo:transition_decision_form", {
    selector: {},
    // transitions: ["t1", "t2", ...] (optional)
    form: TransitionForm,
    panel: 1000,
    priority: 200, // within the panel
    path: "/do/workflow-name/form-name"
    // prepareFormInstance: function(M, instance)
});
</pre>

To customise the behaviour of the feature set the following:

h3(property). selector

A @Selector@ that chooses which states will require this transition form.

h3(property). transitions

A list of transitions which require this form.

h3(property). form

The form to use.

If no elements are required, then it will be possible to submit an empty form. In this case, nothing will be shown in the action panel.

h3(property). panel

Which panel to display the link in.

h3(property). priority

The priority for the link within the panel.

h3(property). path

A path to use to declare the handler to display the form.

h3(property). prepareFormInstance(M, instance)

A function to set up a form instance before it's used.

<b>External data available by default</b>
This feature provides the following items in the instance's @externalData@ by default for your convenience:

| key | value | Use case |
| @std_document_store:key@ | M | For example, useful when creating @globalTemplateFunctions@ which need access to M |
| @requestedTransition@ | transition name as a string | For example, useful when conditionally displaying elements in forms based on the transition selected by the user |

h3(property). blankDocumentForKey(M)

Return what the blank document for a given key should be. You should return a JSON document that sets any default values you want to be set when the user first edits the document store.

h3(property). view

Similar to the docstore version of view, but hides links from the application panel (which are, by default, visible to everyone in the workflow). This has the concept of "allowing for roles at selectors" and takes a list of these definition objects, which has properties:

roles: ["researcher", ...] - list of roles to match on

selector: {state:"state"} - Workflow selector to match on

action: "deny" - Default: allow. specify whether to eg: give permissions for a particular matched role/selector or whether to deny access

<hr>

h3(workflowService). "haplo:transition_decision_form:last_committed_document"

A "workflow service":https://docs.haplo.org/standard/workflow/interfaces/instance#workflowService to get the last committed document for a given @formId@. Returns an empty object if there isn't one.