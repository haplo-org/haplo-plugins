/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */

var createNewApprovalLookup = function(allApprovers) {
    var lookup = O.refdict();
    // Skip users without accounts
    _.each(allApprovers, function(approverRef) {
        var user = O.user(approverRef);
        if(!user || !user.isActive) { lookup.set(approverRef, true); }
    });
    return lookup;
};

var checkifTransitionArrayReturnCorrectTimeline = function(forwardTransition, timeline) {
    if(_.isArray(forwardTransition)) {
        return timeline.or( (select) => {
            _.each(forwardTransition, (ft) => 
                select.where("action","=", ft));
            });
    } else {
        return timeline.where("action","=", forwardTransition);
    }
};

P.workflow.registerWorkflowFeature("haplo:list_approval",
    function(workflow, spec) {
        var createLookup = function(M) {
            var timeline = M.timelineSelect().where("previousState","=",spec.state).order("datetime");
            var allApprovers = M.entities[spec.listEntity+"_refList"];
            var approvedLookup = createNewApprovalLookup(allApprovers);

            if(!spec.resetTransition) {
                checkifTransitionArrayReturnCorrectTimeline(spec.forwardTransition, timeline);
            } else {
                timeline.or( function(select) {
                    checkifTransitionArrayReturnCorrectTimeline(spec.forwardTransition, select)
                    .where("action", "=", spec.resetTransition);
                });
            }

            _.each(timeline, function(e) {
                var userRef = e.user.ref;
                if(userRef) { approvedLookup.set(userRef, true); }
                if(approvedLookup.length === allApprovers.length ||
                    (spec.resetTransition && spec.resetTransition === e.action)
                ) {
                    // This means all users have previously approved but this is running
                    // therefore we've entered this state again so reset or it means
                    // some people may have approved already but we need new approval
                    // from everyone so reset.
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
            let isInForwardTransitions = _.isArray(spec.forwardTransition) ? _.contains(spec.forwardTransition, transition) : false;
            if(isInForwardTransitions || (transition === spec.forwardTransition)) {
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
            let isInForwardTransitions = _.isArray(spec.forwardTransition) ? _.contains(spec.forwardTransition, name) : false;
            if(isInForwardTransitions || (name === spec.forwardTransition)) {
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

        let includesAllNecessaryDecisionReviewProperties = spec.includeDecisionReview ? spec.includeDecisionReview.path && spec.includeDecisionReview.selector && _.isArray(spec.forwardTransition) : false;

        if(includesAllNecessaryDecisionReviewProperties) {

            //panel 200 should be Application panel
            workflow.actionPanel({}, function(M, builder) {
                let panelName = spec.includeDecisionReview.panelName ? spec.includeDecisionReview.panelName : "Review prior decisions";
                builder.panel(spec.includeDecisionReview.panel || 200).link(spec.includeDecisionReview.inPanelPriority || 100, 
                    spec.includeDecisionReview.path+"/decision-review/"+M.workUnit.id, 
                       panelName );
            });

            workflow.plugin.respond("GET,POST", spec.includeDecisionReview.path+"/decision-review", [
                {pathElement:0, as:"workUnit"}
            ], function(E, workUnit) {
                E.setResponsiblePlugin(P); // take over as source of templates, etc
                let M = workflow.instance(workUnit);
                if(!M.selected(spec.includeDecisionReview.selector) && !M.workUnit.isActionableBy(O.currentUser) || !spec.includeDecisionReview) {
                    O.stop( { message: "You are not permitted to view these decisions.", pageTitle: "Unauthorised Access" });
                }

                let timelineQuery = M.timelineSelect().where("state", "=", spec.state).order("datetime", true),
                    FTisArray = _.isArray(spec.forwardTransition),
                    decisions = {};

                _.each(timelineQuery, (tq) => {
                    let isForwardTransition = FTisArray ? _.contains(spec.forwardTransition, tq.action) : spec.forwardTransition === tq.action;
                    if(tq.action === "NOTE" || isForwardTransition) {
                        let existingDecision = decisions[tq.user.id] ? decisions[tq.user.id] : false,
                            decisionInfo = { 
                                user: tq.user.name, 
                                datetime: tq.datetime, 
                                transition: { 
                                    label: M.getTextMaybe("transition:"+tq.action), 
                                    indicator: M.getTextMaybe("transition-indicator:"+tq.action), 
                                    notes: M.getTextMaybe("transition-notes:"+tq.action)
                                }
                            };
                        if(tq.action === "NOTE") { decisionInfo = JSON.parse(tq.json).private ? { private: JSON.parse(tq.json).text } : { notes: JSON.parse(tq.json).text }; }
                        if(existingDecision) { _.extend(decisions[tq.user.id], decisionInfo); }
                        else { decisions[tq.user.id] = decisionInfo; }
                    }
                });
                let view = { M: M, decisions: _.toArray(decisions) };
                E.render(view, "view-decisions");
            });
        }
    }
);
