title: Haplo List Approval
module_owner: Am
--

h3(feature). haplo:list_approval

Use this feature to repeat a state for all people in a given entity. Once entered the state will be repeated for each user in the entity given before the state can be exited to a different state. The current user for the state is the @target@ role. To setup list approval for a state pass specification with the properties below:

h3(property). listEntity

**REQUIRED**: the name of the entity of people to repeat the state for.

h3(property). state

**REQUIRED**: the name of the state to apply list approval.

This state must have the actionable by set to @target@.

h3(property). forwardTransition

**REQUIRED**: the name of a transition (or a list/array of transition names) on the state to be used for moving to the next person in the entity or exiting the state.

Each transition should be defined on the state to have the first destination as the state (so we can repeat it) and the second destination as the destination post list approval.

h3(property). resetTransition

The name of the transition that if used requires a new approval from everyone in the entity whether they have recently approved or not.

By default when returning to the state the remaining people to approve will need to approve - which will be everyone if they have all previously approved. Use this property when a change in the application needs to be revisited by everyone in the entity by force.

h3(property). includeDecisionReview

An object with the following properties: 

**REQUIRED**: .path    A base path for the document.

**REQUIRED**: .selector    A selector.

*OPTIONAL*: .panel    An integer denoting which panel the link to the document review should be in - if ommitted the default is 200 for the Application panel.

*OPTIONAL*: .inPanelPriority    An integer denoting the sort priority of the link in the panel - if ommitted the default is 100, likely at the top of the panel.

*OPTIONAL*: .panelName    A string to be used as the title of the link - if ommitted the default is "Review prior decisions".

*IMPORTANT*: NOTE: This is only applicable if multiple forwardTransitions have been set to allow the decisions to be viewed by the appropriate users - this assumes there is no form to be filled, and only notes and transitions are reviewed. For example:

<pre>language=javascript
EgWorkflow.states({
    dispatch_decision: {
        dispatch: [ "dispatch_approved", "dispatch_not_approved", "returned_to_object:creator_form_wait_decision"]
    },
    wait_approver: {
        actionableBy: "target",
        transitions: [
            ["approve", "wait_approver", "wait_decision"],
            ["not_approve", "wait_approver", "wait_decision"],
            ["decline", "wait_submit"]
        ],
        flags: ["directToTransitionsEGWorkflow"]
    }
});

EgWorkflow.panelHeading(400, "Decisions")

EgWorkflow.use("haplo:list_approval", {
    state: "wait_approver",
    listEntity: "approversMinusSubmitter",
    forwardTransition: ["approve", "not_approve"],
    includeDecisionReview: { 
        selector: {state:"wait_decision"},
        path: "/do/uoe-example-workflow",
        panel: 400, //optional
        inPanelPriority: 200, //optional
        panelName: "Review example workflow forms" //optional
    }
});
</pre>