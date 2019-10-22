title: Haplo Workflow Nonlinear
--

Framework for implementing workflows that do not follow a completely linear path i.e. there are branches in the workflow. The framework can also be used to break up a large and complex process into more manageable sub-workflows.

For a group of sub-workflows you should have 1 separate reserved workflow for handling the sub-workflows using a workflow state machine, workflow handlers etc. For best UX, this 'parent' workflow shouldn't have any feature consumer UI functionality attached to it - the sub-workflows should contain the forms etc.

Use the 'Nonlinear No User' group for all the parent state @actionableBy@ properties to opt-in attaching no feature consumer UI functionality. This group should have no users as the parent transitions should be entirely system controlled.

h3(feature). haplo:nonlinear

Use this feature to register your workflow as a parent workflow of a group of sub-workflows. The UI set-up for accessing the sub-workflows is done for you on top.

The timeline of the parent workflow is the combined timeline of the parent workflow timeline and every sub-workflow timeline as rendered by the @std:workflow:deferred_render_combined_timeline@ service.

h3(feature). haplo:nonlinear:sub-workflow

Use this feature to add a sub-workflow for your parent workflow. The specification accepts the properties below.

h3(property). name

**REQUIRED**: the full Work Unit @workType@ of the sub-workflow.

h3(property). customTaskTitle

A function. Return the task title for the workflow based on the workflow instance that is passed as the first argument.

If your sub-workflow instances contain a completely different set of information e.g. where each is submitted by a different user, the parent workflow's combined timeline will group the sub-workflow's timelines under 1 title which can look odd. For such cases consider implementing the @std:workflow:combined_timeline:title_for_instance@ service or use the properties @shouldDefineSubmitterRole@ and @addSubmitterNameToWorkflowTitles@ below.

**DEFAULT**: if workflow object is given, workflow process name and object title separated by a colon.

h3(property). backLinkText

The text of the back button on the sub-workflow show and manual start page.

**DEFAULT**: the workflow object's type name or "Back" if there is no workflow object.

h3(property). subsequentWorkflowTitlePrefix

Use this property to make it clearer that the original workflow instance is not being duplicated.

For this to work it requires parent workflow to have a workflow object when starting sub-workflows.

h3(property). shouldDefineSubmitterRole

Set to @true@ to enable saving of the @submitter@ additional property of sub-workflow creation (see service below) saved on the work unit tags as @submitter@ and the @submitter@ workflow role as defined by the @getActionableBy()@ and @hasRole()@ workflow functions which get the user from the submitter tag.

You will then want to use the @haplo:nonlinear:create@ workflow service below to start the sub-workflow.

h3(property). addSubmitterNameToWorkflowTitles

Set to @true@ to have the name of the @submitter@ actionable by sensibly inserted for you in the workflow titles throughout the parent workflow and sub-workflow UI.

The @std:workflow:combined_timeline:title_for_instance@ service is then implemented for you.

h3(property). start

A selector. When entering the selected parent states, the sub-workflow is automatically started.

If more than 1 sub-workflow should be needed in the parent workflow use the @shouldRepeatAfter@ property. Normally only 1 sub-workflow can be started per parent state.

Where it makes more sense to start sub-workflow inside your own workflow handler you can use the @haplo:nonlinear:create@ workflow service below.

h3(property). canView

Sub-workflow Permission Rules (see below) to control which workflow roles can view the sub-workflow.

A common use case is to allow all to view normally and to deny view in 1 or 2 instances e.g.

<pre>language=javascript
ExampleParentWorflow.use("haplo:nonlinear:sub-workflow", {
    name: "example_plugin:ewt",
    canView: [
    	{},
    	{roles:["researcher"], action:"deny"}
    ]
});
</pre>

**DEFAULT**: every workflow role can view the sub-workflow.

h3(property). canStartManually

Sub-workflow Permission Rules (see below) to control which workflow roles can manually start the sub-workflow.

If more than 1 of a sub-workflow should be needed in the parent workflow use the @shouldRepeatAfter@ property. Normally only 1 sub-workflow can be started per parent state.

**DEFAULT**: no workflow role can manually start the sub-workflow.

h3(property). preventTransition

A selector. For the selected parent states, transitions are blocked in the parent state while 1 of these workflows is not completed. This allows you to specify when the sub-workflow is required to be completed before moving on.

If more than 1 of a sub-workflow should be needed in the parent workflow use the @shouldRepeatAfter@ property.

Transitions are attempted by the parent workflow for every completed sub-workflow state change and when the parent workflow is started. Note that only the first transition in the parent state transitions is attempted and that by default the workflow will not attempt a transition if it finishes the parent workflow while some sub-workflow is still open.

Note that with the right parent state machine and sub-workflow implementations it is possible to branch multiple times and wait for different sets of branches to 'merge' before moving the parent workflow to prevent workflow races. Usually this means having your sub-workflow start-able in a set of states before a set of states after which the information is required by the system and user where transition should be prevented. The point is that you are only limited by what you can express with a finite state machine.

You can leave the sub-workflow as optional as long as you remember to guard against missing the instances of your sub-workflow when trying to read information from it.

**IMPORTANT**: an attempt is made to not finish the parent workflow if a sub-workflow is still open, however it is hard to check if we about to finish the parent workflow if a finish state can be reached by a dispatch state. Ensure you won't have any open workflow lying around when the parent workflow is finished. Usually it's not a problem as you'll wait for the sub-workflows to finish at some point anyway.

h3(property). shouldRepeatAfter

A selector. When exiting the selected parent states, the completed sub-workflows are saved as a 'sub-workflow to repeat' if it's ever required by the @start@, @preventTransition@ and @canStartManually@ properties again.

To repeat before exiting the selected parent states, set the @haplo_workflow_nonlinear:subworkflow_should_repeat@ tag to @"1"@ once the sub-workflow is completed (closed).

h3(property). shouldRepeatOnObserveEnter

A selector. Functionally similar to @shouldRepeatAfter@, however we set the @haplo_workflow_nonlinear:subworkflow_should_repeat@ tag to @"1"@ when the selector is entered.

Often the requirement is to repeat a workflow until it is approved. In this case, the recommended way is via an intermediary and dispatch state as:

<pre>language=javascript
EgWorkflow.states({
    wait_initial_review_subworkflow: {
        actionableBy: "nonlinear:no-user",
        transitions: [
            ["complete", "dispatch_initial_review_subworkflow"]
        ],
        flags: ["waitReviewSubworkflow"]
    },
    dispatch_initial_review_subworkflow: { 
        dispatch: ["some_exit_state", "wait_further_review_subworkflow"]
    },
    wait_further_review_subworkflow: { // Our intermediary state
        actionableBy: "nonlinear:no-user",
        transitions: [
            ["complete", "dispatch_initial_review_subworkflow"]
        ],
        flags: ["waitReviewSubworkflow"]
    }, //...
});

EgWorkflow.resolveDispatchDestination({state:"dispatch_initial_review_subworkflow"}, function(M) {
    let document = // the subworkflow decision form
    switch(document.decision) {
        case "approve":
            return "some_exit_state";
        case "notApprove":
            return "wait_further_review_subworkflow";
        default:
            throw new Error("Unknown destination for decision: "+document.decision);
    }
});

EgWorkflow.use("haplo:nonlinear:sub-workflow", {
    name: "example_plugin:rw",
    shouldRepeatOnObserveEnter: {state:"wait_further_review_subworkflow"},
    preventTransition: {flags:["waitReviewSubworkflow"]}
});
</pre>

h3(property). shouldRepeatWhile

A selector. When the parent workflow is selected when we are finishing a sub-workflow, the sub-workflow is saved as a 'sub-workflow to repeat' if it's ever required by the @start@, @preventTransition@ and @canStartManually@ properties again.

**IMPORTANT**: you probably don't want the @preventTransition@ property to select what this selects as you'll get an infinite loop.

h3(property). shouldRepeatUntilLastOpen

A boolean that when set to @true@ and when finishing the sub-workflows that are not the last open sub-workflow they are saved as a 'sub-workflow to repeat' if it's ever required by the @start@, @preventTransition@ and @canStartManually@ properties again.

This makes the parent workflow consider all open sub-workflows when applying the @start@, @preventTransition@ and @canStartManually@ properties so for example you can wait for all open sub-workflows before transitioning.

h2. Sub-workflow Permission Rules

are a list of @JavaScript@ objects with the properties below. They are very similar to document store permissions and are checked after object store permissions where possible. Every rule is read - the first matching @"deny"@ or @"allow"@ rule determines action. Omit @roles@ and @subworkflowRoles@ properties to express that rule applies to every workflow role.

**IMPORTANT**: these are not substitutes for permissions at features such as document stores and @std:notes@ - the rules should be reflected there as well because the features won't check these rules before there own rules in their own respond handlers and other places where they can be displayed.

h3(property). roles

A list of workflow roles as determined by the @getActionableBy()@ at parent workflow for which the rule applies.

h3(property). subworkflowRoles

A list of workflow roles as determined by @getActionableBy()@ at sub-workflow, which were not possible to define on parent workflow, for which the rule applies.

h3(property). selector

to select parent workflow states for when the rule applies.

**DEFAULT**: The empty selector @{}@ which selects all parent states.

h3(property). action

@"allow"@ or @"deny"@. Specify whether to grant or deny access to action when rule applies.

**DEFAULT**: @"allow"@

h3(service). haplo:nonlinear:get_parent_instance

Call the workflow service on sub-workflows to get their parent as a workflow instance.

h3(service). haplo:nonlinear:get_other_instance

Workflow service for sub-workflows. Returns the latest sub-workflow with the same parent for the given workflow definition.

h3(service). haplo:nonlinear:is_subsequent

Call the workflow service on sub-workflows. Returns a boolean of whether or not the sub-workflow was not created by the parent workflow instance first.

The same logic is used for the @subsequentWorkflowTitlePrefix@ property.

h3(service). haplo:nonlinear:start

Workflow service for parent workflows to start a new instance of the given sub-workflow definition. Call the service with:

* **REQUIRED**: @arg1@ the sub-workflow workflow definition object.
* @arg2@ the @JavaScript@ object of the additional properties to pass to start the workflow.

You can read your additional properties in the properties parameter of the @Subworkflow.start()@ function that is used to initialise the workflow instance. The special additional properties are:

h3(property). submitter

A user @Ref@ or @SecurityPrinciple@. Used by functionality enabled by the @shouldDefineSubmitterRole@ sub-workflow property above.

h3(property). actionableRef

**DEPRECATED**: Ref used as @submitter@ property.

h3(service). haplo:nonlinear:get_parent_workflow_of_subworkflow

**DEPRACATED**: use @haplo:nonlinear:get_parent_instance@ workflow service instead.

Returns the parent workflow instance for a given sub-workflow instance.

h3(service). haplo:nonlinear:create_subworkflow

**DEPRECATED**: use @haplo:nonlinear:start@ workflow service instead.

Start a new instance of the given sub-workflow definition. Call the service with:

* **REQUIRED**: @arg1@ the sub-workflow workflow definition object.
* **REQUIRED**: @arg2@ the parent @WorkflowInstance@.
* @arg3@ the @JavaScript@ object of the additional properties to pass to start the workflow.

You can read your additional properties in the properties parameter of the @Subworkflow.start()@ function that is used to initialise the workflow instance. The special additional properties are:

h3(property). submitter

A user @Ref@ or @SecurityPrinciple@. Used by functionality enabled by the @shouldDefineSubmitterRole@ sub-workflow property above.

h3(property). actionableRef

**DEPRECATED**: Ref used as @submitter@ property.
