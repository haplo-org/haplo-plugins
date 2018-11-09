/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */

// TODO: Docs

var createNewApprovalLookup = function(allApprovers) {
    var lookup = O.refdict();
    // Skip users without acounts
    _.each(allApprovers, function(approverRef) {
        var user = O.user(approverRef);
        if(!user || !user.isActive) { lookup.set(approverRef, true); }
    });
    return lookup;
};

P.workflow.registerWorkflowFeature("haplo:list_approval",
    function(workflow, spec) {

        var createLookup = function(M) {
            var timeline = M.timelineSelect().where("previousState","=",spec.state).
                where("action","=",spec.forwardTransition).order("datetime");
            var allApprovers = M.entities[spec.listEntity+"_refList"];
            var approvedLookup = createNewApprovalLookup(allApprovers);
            // TODO skip users without accounts until we sort out workflow fallbacks properly
            // _.each(allApprovers, function(approverRef) {
            //     var user = O.user(approverRef);
            //     if(!user || !user.isActive) { approvedLookup.set(approverRef, true); }
            // });
            _.each(timeline, function(e) {
                var userRef = e.user.ref;
                if(userRef) { approvedLookup.set(userRef, true); }
                if(approvedLookup.length === allApprovers.length) {
                    // This means all users have previously approved but this is running
                    // therefore we've entered this state again so reset
                    approvedLookup = createNewApprovalLookup(allApprovers);
                }
            });
            return approvedLookup;
        };

        var getNext = function(M) {
            var allApprovers = M.entities[spec.listEntity+"_refList"];
            var approvedLookup = createLookup(M);
            var currentActionableUser = M.workUnit.actionableBy;
            if(currentActionableUser.ref) {
                approvedLookup.set(currentActionableUser.ref, true);
            }
            for(var x = 0; x < allApprovers.length; x++) {
                if(!approvedLookup.get(allApprovers[x])) {
                    return allApprovers[x];
                }
            }
        };

        var getNextIgnoreCurrent = function(M) {
            var allApprovers = M.entities[spec.listEntity+"_refList"];
            var approvedLookup = createLookup(M);
            for(var x = 0; x < allApprovers.length; x++) {
                if(!approvedLookup.get(allApprovers[x])) {
                    return allApprovers[x];
                }
            }
        };

        workflow.getActionableBy(function(M, actionableBy) {
            var sd = M.getStateDefinition(spec.state);
            if(!sd) { throw new Error("Can't find state", spec.state); }
            if(!sd.actionableBy) { throw new Error("No actionableBy in state", spec.state); }
            if(M.state === spec.state && actionableBy === sd.actionableBy) {
                // Load entities so auto move function will set up dependency tags
                var list = M.entities[spec.listEntity+"_refList"];
                var user, userRef = O.ref(M.target);
                if(userRef && (user = O.user(userRef))) {
                    return user;
                }
            }
        });

        // Check user is the current actionable user
        workflow.hasRole(function(M, user, role) {
            var sd = M.getStateDefinition(spec.state);
            if(!sd) { throw new Error("Can't find state", spec.state); }
            if(!sd.actionableBy) { throw new Error("No actionableBy in state", spec.state); }
            if(M.state === spec.state && role === sd.actionableBy) {
                var userRef = O.ref(M.target);
                return userRef == user.ref;
            }
        });

        workflow.setWorkUnitProperties({state:spec.state}, function(M, transition) {
            var targetRef;
            if(transition === spec.forwardTransition) {
                targetRef = getNext(M);
            } else {
                // if AUTOMOVE is running, we don't want it to go to the next one
                // unless the approver list has changed
                targetRef = getNextIgnoreCurrent(M);
            }
            if(targetRef) {
                M.workUnit.tags.target = targetRef.toString();
            }
        });

        workflow.resolveTransitionDestination({state:spec.state}, function(M, name, destinations) {
            if(name === spec.forwardTransition) {
                var next = getNext(M);
                if(next) {
                    return destinations[0];
                } else if(destinations.length === 2) {
                    // Remove target tag once finished
                    return {state: destinations[1]};
                }
                // Else using-plugin supplied multiple exit states so let it fall through
            }
        });

    }
);
