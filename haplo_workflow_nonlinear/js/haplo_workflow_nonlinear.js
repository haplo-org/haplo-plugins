/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2019            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


var subworkflowWorkUnitToParentInstance = P.subworkflowWorkUnitToParentInstance = function(workUnit) {
    var parentTag = workUnit.tags._nonlinearparent;
    if(!parentTag) { return undefined; }
    var wu = O.work.load(1*parentTag);
    return O.service("std:workflow:definition_for_name", wu.workType).instance(wu);
};

var isSubworkflowWorkUnitSubsequent = P.isSubworkflowWorkUnitSubsequent = function(workUnit) {
    var workUnits = O.work.query(workUnit.workType).
        isClosed().
        tag("_nonlinearparent", workUnit.tags._nonlinearparent);
    var firstClosedWorkUnit = (workUnits.length > 0) ? workUnits[workUnits.length-1] : undefined;
    return (firstClosedWorkUnit && (workUnit.id !== firstClosedWorkUnit.id));
};

var startSubworkflow = function(parentM, workflowDefn, additionalProperties) {
    var info = subworkflows[workflowDefn.fullName];
    if(!info) {
        throw new Error("Trying to start sub-workflow of kind "+workflowDefn.fullName+" but it is not defined as a sub-workflow.");
    }
    var subworkflow = new P.SubworkflowInfo(parentM, info.spec);
    return subworkflow.start(additionalProperties || {});
};

// --------------------------------------------------------------------------

var subworkflows = P.subworkflows = {};
var subworkflowsByParent = P.subworkflowsByParent = {};

// --------------------------------------------------------------------------

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

    workflow.implementWorkflowService("haplo:nonlinear:start", function(M, workflowDefn, additionalProperties) {
        return startSubworkflow(M, workflowDefn, additionalProperties);
    });

});

// --------------------------------------------------------------------------

P.workflow.registerWorkflowFeature("haplo:nonlinear:sub-workflow", function(workflow, spec) {
    if(spec.name in subworkflows) {
        throw new Error("Workflow already used as sub-workflow: "+spec.name);
    }
    subworkflows[spec.name] = {
        spec: spec,
        parent: workflow
    };
    var workflows = subworkflowsByParent[workflow.fullName];
    if(!workflows) { subworkflowsByParent[workflow.fullName] = workflows = []; }
    workflows.push(spec);

    var setShouldRepeat = function(M) {
        var workUnits = O.work.query(spec.name).
            isClosed().
            tag("_nonlinearparent", M.workUnit.id.toString()).
            tag("haplo_workflow_nonlinear:subworkflow_should_repeat", null);
        _.each(workUnits, function(workUnit) {
            workUnit.tags["haplo_workflow_nonlinear:subworkflow_should_repeat"] = "1";
            workUnit.save();
        });
    };

    if(spec.shouldRepeatAfter) {
        workflow.observeExit(spec.shouldRepeatAfter, setShouldRepeat);
    }

    if(spec.shouldRepeatOnObserveEnter) {
        workflow.observeEnter(spec.shouldRepeatOnObserveEnter, setShouldRepeat);
    }
});

// --------------------------------------------------------------------------

// After the fact notifications of state changes in child workflows
P.implementService("std:workflow:notify:transition", function(M, transition, previousState) {
    var info = subworkflows[M.workUnit.workType];
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

var setupSubworkflow = function(subworkflow, info) {

    info.spec._workflow = subworkflow;

    // Sub-workflows must be tagged with ID of parent workflow
    subworkflow.start(function(M, initial, properties) {
        if(!('_parentM' in properties)) {
            throw new Error("Manual creation of sub-workflow not allowed. Nonlinear sub-workflow must be started by the parent workflow.");
        }
        M.workUnit.tags._nonlinearparent = ''+properties._parentM.workUnit.id;
        var submitter = properties.submitter;
        if(info.spec.shouldDefineSubmitterRole && submitter) {
            M.workUnit.tags.submitter = O.isRef(submitter) ? submitter : submitter.id.toString();
        }
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
            var taskTitle = M.getWorkflowProcessName();
            if(info.spec.subsequentWorkflowTitlePrefix && isSubworkflowWorkUnitSubsequent(M.workUnit)) {
                taskTitle = info.spec.subsequentWorkflowTitlePrefix+taskTitle;
            }
            if(info.spec.addSubmitterNameToWorkflowTitles) {
                var submitter = M.getActionableBy("submitter");
                if(submitter) {
                    taskTitle += ": "+submitter.name;
                }
            }
            taskTitle += ": "+M.workUnit.ref.load().title;
            return taskTitle;
        }
    });

    if(info.spec.addSubmitterNameToWorkflowTitles) {
        subworkflow.implementWorkflowService("std:workflow:combined_timeline:title_for_instance", function(M) {
            var submitter = M.getActionableBy("submitter");
            return subworkflow.getWorkflowProcessName()+(submitter ? ": "+submitter.name : "");
        });
    }

    // Hide the timeline for sub-workflows
    subworkflow.renderWork({}, function(M) {
        return true;
    });

    if(info.spec.shouldDefineSubmitterRole) {
        subworkflow.getActionableBy(function(M, actionableBy) {
            if(actionableBy === "submitter") {
                var submitter = M.workUnit.tags.submitter;
                if(submitter) {
                    var submitterRef = O.ref(submitter);
                    return O.user(submitterRef ? submitterRef : parseInt(submitter, 10));
                }
            }
        });

        subworkflow.hasRole(function(M, user, role) {
            if(role === "submitter") {
                var submitterUser = M.getActionableBy("submitter");
                if(submitterUser) {
                    return user.id === submitterUser.id;
                }
            }
        });
    }

    if(info.spec.shouldRepeatWhile) {
        subworkflow.setWorkUnitProperties({}, function(M) {
            if(M.getStateDefinition(M.state).finish) {
                var parentM = subworkflowWorkUnitToParentInstance(M.workUnit);
                if(parentM.selected(info.spec.shouldRepeatWhile)) {
                    M.workUnit.tags["haplo_workflow_nonlinear:subworkflow_should_repeat"] = "1";
                }
            }
        });
    }

    if(info.spec.shouldRepeatUntilLastOpen) {
        subworkflow.setWorkUnitProperties({}, function(M, transition) {
            if(M.getStateDefinition(M.state).finish) {
                var openCount = O.work.query(subworkflow.fullName).
                    tag("_nonlinearparent", M.workUnit.tags._nonlinearparent).
                    count();
                if(openCount > 1) {
                    M.workUnit.tags["haplo_workflow_nonlinear:subworkflow_should_repeat"] = "1";
                }
            }
        });
    }

    subworkflow.implementWorkflowService("haplo:nonlinear:get_parent_instance", function(M) {
        return subworkflowWorkUnitToParentInstance(M.workUnit);
    });

    subworkflow.implementWorkflowService("haplo:nonlinear:get_other_instance", function(M, workflowDefn) {
        let workUnit = O.work.query(workflowDefn.fullName).
            isEitherOpenOrClosed().
            tag("_nonlinearparent", M.workUnit.tags._nonlinearparent).
            latest();
        return workUnit ? workflowDefn.instance(workUnit) : undefined;
    });

    subworkflow.implementWorkflowService("haplo:nonlinear:is_subsequent", function(M) {
        return isSubworkflowWorkUnitSubsequent(M.workUnit);
    });

};

P.workflow.registerOnLoadCallback(function(workflows) {
    _.each(subworkflows, function(info, name) {
        var subworkflow = workflows.getWorkflow(info.spec.name);
        if(!subworkflow) {
            throw new Error("Workflow "+info.spec.name+" was used as a sub-workflow in a nonlinear workflow, but wasn't defined.");
        }
        setupSubworkflow(subworkflow, info);
    });
});

// --------------------------------------------------------------------------

// Deprecated.
P.implementService("haplo:nonlinear:get_parent_workflow_of_subworkflow", function(M) {
    return subworkflowWorkUnitToParentInstance(M.workUnit);
});

// Deprecated.
P.implementService("haplo:nonlinear:create_subworkflow", function(workflowDefn, parentM, additionalProperties) {
    return startSubworkflow(parentM, workflowDefn, additionalProperties);
});

