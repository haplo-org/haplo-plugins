title: Haplo Workflow Transition Decision Form
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
