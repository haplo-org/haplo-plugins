/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2019            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


var subWorkflows = {};
var subWorkflowsByParent = P.subWorkflowsByParent = {};

// --------------------------------------------------------------------------

/*HaploDoc
node: /haplo_workflow_nonlinear
title: Haplo Nonlinear Workflows
sort: 2
--

Allows plugins to implement workflows that do not have to follow a completely linear path. This could be used to allow \
branching, or to break up a large and complex process into more manageable sub-workflows.

The using plugin should define multiple workflows - one to be the "controlling" workflow for this process, and the \
others as sub-workflows. The UI is neatest if the "controlling" process doesn't have any functionality attached \
to it, but instead acts as a framework from which to start the sub-workflows (containing all of the forms, etc.).

To facilitate this the plugin adds the "No User" group, for use as the @actionableBy@ in the "controlling" workflow. \
This should always be an empty group, as the transitions should be entirely system controlled. The "controlling" \
process will transition automatically once all of the sub-process are complete.

h2. Workflow features

h3(feature). "haplo:nonlinear"

Registers this workflow as the "controlling" workflow for this process, and sets up the workflow UI for display of \
multiple processes and their statuses. Takes no arguments.
*/
P.workflow.registerWorkflowFeature("haplo:nonlinear", function(workflow) {

    workflow.observeStart({}, function(M) {
        P.updateNonlinearWorkflow(M);
    });

    P.setupNonlinearWorkflowUI(workflow);

    // Special actionable by group for the main workflow where it's not assigned to anyone in particular,
    // which also hides the 'currently with' display.
    workflow.getActionableBy(function(M, actionableBy, target) {
        if(actionableBy === "nonlinear:no-user") {
            return O.group(Group.NonlinearNoUser);
        }
    });
    workflow.currentlyWithDisplayName({}, function(M) {
        if(M.workUnit.actionableBy.id === Group.NonlinearNoUser) {
            return false;
        }
    });

});

// --------------------------------------------------------------------------

/*HaploDoc
node: /haplo_workflow_nonlinear
sort: 5
--

h3(feature). "haplo:nonlinear:sub-workflow"

Registers a workflow as a sub-workflow for this process. Takes a single argument, a specification object.

|@name@|The full workType for the sub-workflow|*required*|
|@start@|A selector. When entering selected parent states, the sub-workflow is automatically started. If more than 1 of a sub-workflow should be needed in the parent workflow use the @shouldRepeatAfter@ property||
|@preventTransition@|A selector. For selected parent states, transitions are blocked in the parent state while 1 of these workflows is not completed||
|@canStartManually@|An array of objects, containing @selector@ and @roles@ keys, defining who can start this process manually, and when. A sub-workflow can be started manually only once per parent state. If more than 1 of a sub-workflow should be needed in the parent workflow use the @shouldRepeatAfter@ property||
|@shouldRepeatAfter@|A selector. When exiting the selected parent states, the sub-workflow is saved as a sub-workflow to 'repeat' if it's ever required by the @start@, @preventTransition@ and @canStartManually@ properties again||
*/
P.workflow.registerWorkflowFeature("haplo:nonlinear:sub-workflow", function(workflow, spec) {
    if(spec.name in subWorkflows) {
        throw new Error("Workflow already used as sub-workflow: "+spec.name);
    }
    subWorkflows[spec.name] = {
        spec: spec,
        parent: workflow
    };
    var workflows = subWorkflowsByParent[workflow.fullName];
    if(!workflows) { subWorkflowsByParent[workflow.fullName] = workflows = []; }
    workflows.push(spec);

    if(spec.shouldRepeatAfter) {
        workflow.observeExit(spec.shouldRepeatAfter, function(M) {
            var workUnits = O.work.query(spec.name).
                isClosed().
                tag("_nonlinearparent", M.workUnit.id.toString()).
                tag("haplo_workflow_nonlinear:subworkflow_should_repeat", null);
            _.each(workUnits, function(workUnit) {
                workUnit.tags["haplo_workflow_nonlinear:subworkflow_should_repeat"] = "1";
                workUnit.save();
            });
        });
    }
});

// --------------------------------------------------------------------------

// After the fact notifications of state changes in child workflows
P.implementService("std:workflow:notify:transition", function(M, transition, previousState) {
    var info = subWorkflows[M.workUnit.workType];
    if(info) {
        var parentTag = M.workUnit.tags._nonlinearparent;
        if(parentTag) {
            var parentWorkUnit = O.work.load(1*parentTag);
            var instance = info.parent.instance(parentWorkUnit);
            P.subworkflowHasChangedState(instance, M);
        }
    }
});

// --------------------------------------------------------------------------

var setupSubWorkflow = function(subworkflow, info) {

    info.spec._workflow = subworkflow;

    // Sub-workflows must be tagged with ID of parent workflow
    subworkflow.start(function(M, initial, properties) {
        if(!('_parentM' in properties)) {
            throw new Error("Manual creation of sub-workflow not allowed. Nonlinear sub-workflow must be started by the parent workflow.");
        }
        M.workUnit.tags._nonlinearparent = ''+properties._parentM.workUnit.id;
    });

    // Sub-workflows need a special page to display them
    subworkflow.taskUrl(function(M) {
        return "/do/subworkflow/show/"+M.workUnit.id;
    });

    // Clearer task title
    // TODO: How can this be overridden by the workflow definition, as we're adding this at the end?
    subworkflow.taskTitle(function(M) {
        if(info.spec.customTaskTitle) {
            return info.spec.customTaskTitle(M);
        }
        if(M.workUnit.ref) {
            return M.getWorkflowProcessName() + ': ' + M.workUnit.ref.load().title;
        }
    });

    // Hide the timeline for sub-workflows
    subworkflow.renderWork({}, function(M) {
        return true;
    });

};

P.workflow.registerOnLoadCallback(function(workflows) {
    _.each(subWorkflows, function(info, name) {
        var subworkflow = workflows.getWorkflow(info.spec.name);
        if(!subworkflow) {
            throw new Error("Workflow "+info.spec.name+" was used as a sub-workflow in a nonlinear workflow, but wasn't defined.");
        }
        setupSubWorkflow(subworkflow, info);
    });
});

// --------------------------------------------------------------------------

P.getParentWorkflowOfSubworkflow = function(M) {
    var parentTag = M.workUnit.tags._nonlinearparent;
    if(!parentTag) { return undefined; }
    var wu = O.work.load(1*parentTag);
    return O.service("std:workflow:definition_for_name", wu.workType).instance(wu);
};

// --------------------------------------------------------------------------

// TODO: rethink these interfaces - but beware Leeds exams uses them
P.implementService("haplo:nonlinear:get_parent_workflow_of_subworkflow", P.getParentWorkflowOfSubworkflow);
P.implementService("haplo:nonlinear:create_subworkflow", function(workflowDefn, parentM, subSpec) {
    var subworkflowDefn = subWorkflows[workflowDefn.fullName];
    if(!subworkflowDefn) {
        throw new Error("Trying to create subworkflow of kind "+workflowDefn.fullName+" but it is not defined as a subworkflow.");
    }
    var subworkflow = new P.SubworkflowInfo(parentM, subworkflowDefn.spec);
    return subworkflow.startWorkflow(subSpec);
});

