/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2019            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


// The 'shape' of the nonlinear workflow is the combination of the states of the main
// workflow and the sub-workflows.
var Shape = P.Shape = function(M) {
    this.M = M;

    // Find all the underlying workunits for the sub-workflows.
    var subworkflowWorkUnits = {};
    var wuq = O.work.query().
        tag('_nonlinearparent', ''+M.workUnit.id).
        anyVisibility().
        isEitherOpenOrClosed();
    _.each(wuq, function(wu) {
        if(subworkflowWorkUnits[wu.workType]) {
            subworkflowWorkUnits[wu.workType].push(wu);
        } else {
            subworkflowWorkUnits[wu.workType] = [wu];
        }
    });

    // Generate information about each of the sub-workflows
    this.subworkflows = _.map(P.subworkflowsByParent[M.workUnit.workType] || [], function(spec) {
        var wus = subworkflowWorkUnits[spec.name];
        if(wus && wus.length) {
            return _.map(wus, function(wu) { return new SubworkflowInfo(M, spec, wu); });
        } else {
            return [new SubworkflowInfo(M, spec, undefined)];
        }
    });
};

Shape.prototype.__defineGetter__("existingSubworkflows", function() {
    if(this.$existingSubworkflows) { return this.$existingSubworkflows; }
    else {
        this.$existingSubworkflows = _.chain(this.subworkflows).
            flatten().
            filter(function(s) { return s.workUnit; }).
            sortBy(function(s) { return s.workUnit.createdAt; }).
            value();
    }
    return this.$existingSubworkflows;
});

Shape.prototype.__defineGetter__("startableSubworkflows", function() {
    if(!("$startableSubworkflows" in this)) {
        this.$startableSubworkflows = _.filter(this.notStartedSubworkflowsForCurrentStage, function(subs) {
            return subs[0].canAutomaticallyStart();
        });
    }
    return this.$startableSubworkflows;
});

Shape.prototype.__defineGetter__("transitionPreventableSubworkflows", function() {
    if(!("$transitionPreventableSubworkflows" in this)) {
        this.$transitionPreventableSubworkflows = _.filter(this.subworkflows, function(subs) {
            return subs[0].canPreventTransition();
        });
    }
    return this.$transitionPreventableSubworkflows;
});

Shape.prototype.__defineGetter__("notStartedSubworkflowsForCurrentStage", function() {
    if(!("$notStartedSubworkflowsForCurrentStage" in this)) {
        this.$notStartedSubworkflowsForCurrentStage = _.filter(this.subworkflows, function(subs) {
            var notStartedSubworkflow = !subs[0].workUnit;
            if(!notStartedSubworkflow) {
                notStartedSubworkflow = _.every(subs, function(sub) {
                    return (sub.closed && "1" === sub.workUnit.tags["haplo_workflow_nonlinear:subworkflow_should_repeat"]);
                });
            }
            return notStartedSubworkflow;
        });
    }
    return this.$notStartedSubworkflowsForCurrentStage;
});

Shape.prototype.existingVisibleSubworkflowsForUser = function(user) {
    return _.filter(this.existingSubworkflows, function(sub) {
        return sub.userCanView(user);
    });
};

Shape.prototype.manuallyStartableSubworkflowsForUser = function(user) {
    return _.filter(this.notStartedSubworkflowsForCurrentStage, function(subs) {
        return subs[0].userCanStartManually(user);
    });
};

// This needs to be called in a loop
Shape.prototype.performSingleUpdateWorkflowStep = function() {
    var M = this.M;

    // Optionally automatically start subworkflows.
    var startedSubworkflow = false;
    _.each(this.startableSubworkflows, function(subs) {
        subs[0].start({});
        startedSubworkflow = true;
    });
    if(startedSubworkflow) { return true; }

    // Optionally prevent transition if there isn't a completed subworkflow for this stage.
    var transitionPrevented = !_.every(this.transitionPreventableSubworkflows, function(subs) {
        return _.some(subs, function(sub) {
            return (sub.closed && "1" !== sub.workUnit.tags["haplo_workflow_nonlinear:subworkflow_should_repeat"]);
        });
    });
    if(transitionPrevented) { return false; }

    var subworkflowOpen = _.some(this.subworkflows, function(subs) {
        return _.some(subs, function(sub) {
            return (sub.workUnit && !sub.closed);
        });
    });

    var transition = M.transitions.list.length ? M.transitions.list[0] : undefined;
    if(transition) {
        // Never complete the workflow while a sub-workflow is open - however if the destination is
        // a dispatch state we can't tell that the workflow will finish.
        if(subworkflowOpen && transition.destinationFinishesWorkflow) {
            return false;
        }
        M.transition(transition.name);
        return true;
    }

    return false;
};

// --------------------------------------------------------------------------

var SubworkflowInfo = P.SubworkflowInfo = function(parentM, spec, workUnit) {
    this.parentM = parentM;
    this.spec = spec;
    this.workUnit = workUnit;
    this.closed = workUnit ? workUnit.closed : false;
};
SubworkflowInfo.prototype.__defineGetter__("M", function() {
    if('$M' in this) { return this.$M; }
    this.$M = this.workUnit ? this.spec._workflow.instance(this.workUnit) : undefined;
    return this.$M;
});

SubworkflowInfo.prototype.__defineGetter__("isSubsequent", function() {
    if(!("$isSubsequent" in this)) {
        this.$isSubsequent = (this.workUnit && P.isSubworkflowWorkUnitSubsequent(this.workUnit));
    }
    return this.$isSubsequent;
});

// Assumes the permission is not given if property is missing.
SubworkflowInfo.prototype._userCan = function(user, subworkflowActionPropertyKey) {
    var subworkflowActionProperty = this.spec[subworkflowActionPropertyKey];
    if(!subworkflowActionProperty) {
        return false;
    }
    var i, rule, roles, subworkflowRoles, ruleSelectsParentState, userHasAnyParentRuleRoles,
        userHasAnySubworkflowRuleRoles, ruleApplies, allow = false, deny = false;
    for(i = subworkflowActionProperty.length-1; i >= 0; i -= 1) {
        rule = subworkflowActionProperty[i];
        roles = rule.roles || [];
        subworkflowRoles = rule.subworkflowRoles || [];
        ruleSelectsParentState = this.parentM.selected(rule.selector || {});
        userHasAnyParentRuleRoles = roles.length > 0 ? this.parentM.hasAnyRole(user, roles) : subworkflowRoles.length < 1;
        userHasAnySubworkflowRuleRoles = subworkflowRoles.length > 0 ?
            this.M.hasAnyRole(user, subworkflowRoles) : roles.length < 1;
        ruleApplies = (ruleSelectsParentState && (userHasAnyParentRuleRoles || userHasAnySubworkflowRuleRoles));
        if(!ruleApplies) {
            continue;
        }
        switch(rule.action) {
            case "allow":
                allow = true;
                break;
            case "deny":
                deny = true;
                break;
            default:
                if(rule.action !== undefined) {
                    throw new Error("Sub-workflow rule 'action' argument must be either 'allow' or 'deny' when specified.");
                }
                allow = true;
                break;
        }
    }
    return (allow && !deny);
};

SubworkflowInfo.prototype.userCanView = function(user) {
    var allUsersCanView = !this.spec.canView;
    return (allUsersCanView || O.currentUser.isSuperUser || this._userCan(user, "canView"));
};

SubworkflowInfo.prototype.userCanStartManually = function(user) {
    return this._userCan(user, "canStartManually");
};

SubworkflowInfo.prototype.canAutomaticallyStart = function() {
    return (this.spec.start && this.parentM.selected(this.spec.start));
};

SubworkflowInfo.prototype.canPreventTransition = function() {
    return (this.spec.preventTransition && this.parentM.selected(this.spec.preventTransition));
};

SubworkflowInfo.prototype.start = function(additionalProperties) {
    var parentM = this.parentM;
    var properties = _.extend({_parentM:parentM}, additionalProperties);
    if(parentM.workUnit.ref) {
        properties.object = parentM.workUnit.ref.load();
    }
    // Deprecated.
    if(additionalProperties.actionableRef && !("submitter" in properties)) {
        properties.submitter = additionalProperties.actionableRef;
    }
    return this.spec._workflow.create(properties);
};

// --------------------------------------------------------------------------

var updateNonlinearWorkflow = P.updateNonlinearWorkflow = function(M) {
    var safety = 256;
    while((--safety) > 0) {
        var shape = new Shape(M);
        if(!(shape.performSingleUpdateWorkflowStep())) {
            break;
        }
    }
    if(safety <= 0) {
        throw new Error("Updating nonlinear workflow exceeded iteration limit. Does your definition have a cycle?");
    }
};

P.subworkflowHasChangedState = function(M, subworkflowM) {
    updateNonlinearWorkflow(M);
};
