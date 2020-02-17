title: Haplo Workflow Direct to Transitions
--
This plugin implements the @"haplo:directToTransitions"@ feature to add transition panels to main page of workflow ui.

h2(feature). haplo:directToTransitions


h3(property). selector

* Selector specifying the flag which indicates when to apply directToTransitions

h3(property). exclude

* *OPTIONAL* An array of string transition names to exclude from adding to ui

*IMPORTANT*: including @exclude@ property does not block this transition, consider using @filterTransition@ feature for this use case.

Example:

<pre>language=javascript
EgWorkflow.states({
    "wait_some_action": {
        actionableBy: "some_role",
        transitions: [
            ["submit_decision", "wait_a_different_action"],
            ["defer_decision", "dispatch_decision_deferal"],
            ["a_third_transition", "wait_another_action"]
        ],
        flags: ["directToTransitions"]
    }
});

EgWorkflow.use("haplo:directToTransitions  ", {
    selector:{flags:["directToTransitions"]},
    exclude:["a_third_transition"]
});
</pre>

In the example above, all transitions but @"a_third_transition"@ will display in the main ui of the workflow. 