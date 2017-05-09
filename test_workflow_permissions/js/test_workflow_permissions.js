/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */

P.PermTestWorkflow = P.workflow.implement("permissions_test", "Permissions test workflow");
P.PermTestWorkflow.objectElementActionPanelName("permissions_test");
P.PermTestWorkflow.use("std:entities", {
    "originalVictim": ["object", A.Victim],
    "originalVictor": ["object", A.Victor]
});

P.PermTestWorkflow.use("std:entities:entity_replacement", {replacements:{
    "victim": {
        entity: "originalVictim",
        assignableWhen: {state: "anger"},
        replacementTypes: [T.Person]
    },
    "victor": {
        entity: "originalVictor",
        assignableWhen: {state: "anger"},
        replacementTypes: [T.Person]
    }
}});

P.PermTestWorkflow.use("std:entities:roles");
P.PermTestWorkflow.states({
    sleeping: {
        actionableBy: "object:creator", // Replaceable entities aren't allowed here in the initial state, so we need a setup state as a buffer.
        transitions: [
            ["awaken", "denial"]
        ]
    },
    denial: {
        actionableBy: "victim",
        transitions: [
            ["proceed", "guilt"]
        ]
    },
    guilt: {
        actionableBy: "victor",
        transitions: [
            ["proceed", "anger"],
            ["regress", "denial"]
        ]
    },
    anger: {
        actionableBy: "victim",
        transitions: [
            ["proceed", "depression"],
            ["regress", "guilt"]
        ]
    },
    depression: {
        actionableBy: "victim",
        transitions: [
            ["proceed", "upward_turn"],
            ["regress", "anger"]
        ]
    },
    upward_turn: {
        actionableBy: "victim",
        transitions: [
            ["proceed", "reconstruction"],
            ["regress", "depression"]
        ]
    },
    reconstruction: {
        actionableBy: "victor",
        transitions: [
            ["proceed", "acceptance"],
            ["regress", "upward_turn"]
        ]
    },
    acceptance: {
        finish: true
    }
});
P.PermTestWorkflow.start(function(M, initial, properties) {
    initial.state = "sleeping";
});
P.PermTestWorkflow.use("std:integration:rules_for_permission_implementation", [
    {entity: "victor", hasPermission: "read"},
    {inState: "denial", actionableByHasPermission: "read-edit"},
    {inState: "guilt", actionableByHasPermission: "read-edit"},
    {inState: "anger", actionableByHasPermission: "read-edit"},
    {inState: "depression", actionableByHasPermission: "read-edit"}
]);

P.implementService("haplo:descriptive_object_labelling:setup", function(setup) {
    console.log("labelling setup happens");
    setup(T.Grief, {selfLabelling:true, workflowPermissionLabels:true});
    setup(T.Person, {selfLabelling:true});
});
