/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


/*
 *  Committee scheduling workflow feature
 *
 *  Adds committee scheduling states and entities to workflows, where a committee rep can:
 *  schedule a meeting (either attaching the workflow/application to an existing meeting
 *  or scheduling a completely new meeting), forward to chair, forward to the deputy chair,
 *  and progress to the next stage of the workflow.
 *
 *  use by calling .use("haplo:committee_scheduling", spec) on a std:workflow object
 *  where spec is a JS object defining:
 *
 *      path: the path of your plugin, or where you want to have request handlers built
 *      scheduleInfo: a list of committee scheduling sections to be constructed/handled by the plugin
 *
 *  scheduleInfo should be a list of 1 or more JS objects defining:
 *      
 *      state: the name of the state for internal usage
 *      exitStates: an array of states that are potential exits for the committee phase,
 *          if this has more than one element, use resolveTransitionDestination to decide
 *          where to transition to
 *      committeeEntityName: the name for the committee in the entities system
 *      
 *  optionally you may define:
 *
 *      additionalTransitions: a list of additional transitions defined as they would be in a state machine,
 *          that users are able to use instead of progressing eg:
 *              ["return_to_researcher", "wait_researcher"]
 *      onlineDecision: an object that enables/defines online voting/discussion for the phase
 *          requires a "choices" property that is a list of form choices, eg:
 *              {choices: [["choice", "Descriptive name of choice"], ...]}
 *          choices may be a function(M) to allow per-workflow choices
 *
 *  By default, the committee rep state is only actionable by the first Committee rep on
 *  the committee object. Set the config data:
 *      "haplo_committee_scheduling:enable_committee_rep_takeover": true
 *  to enable other Committee reps to takeover being the rep/handling the scheduling/decision
 *  for all committee scheduling states in all workflows.
 *
 */

var TEXT = {
    "transition:progress_application": "Progress",
    "transition-indicator:progress_application": "primary",
    "transition-notes:progress_application": "Progress application to the next stage",
    "transition-confirm:progress_application": "You have chosen to progress the application to the next stage.",

    "transition:send_to_chair": "Forward application to Chair",
    "transition-indicator:send_to_chair": "primary",
    "transition-notes:send_to_chair": "Forward application to the committee Chair",
    "transition-confirm:send_to_chair": "You have chosen to forward the application to the Chair.",

    "transition:send_to_dep_chair": "Forward application to Deputy Chair",
    "transition-indicator:send_to_dep_chair": "primary",
    "transition-notes:send_to_dep_chair": "Forward application to the committee Deputy Chair",
    "transition-confirm:send_to_dep_chair": "You have chosen to forward the application to the Deputy Chair.",

    "transition:return_to_rep": "Return to committee representative",
    "transition-indicator:return_to_rep": "secondary",
    "transition-confirm:return_to_rep": "You have chosen to return the application to the committee representative.",

    "timeline-entry:progress_application": "Progressed the application",
    "timeline-entry:send_to_chair": "forwarded application to committee Chair",
    "timeline-entry:send_to_dep_chair": "forwarded application to committee Deputy Chair",
    "timeline-entry:return_to_rep": "returned application to committee representative"
};

var TRANSITION_BUTTON_PRIORITIES = {
    "send_to_chair": 110,
    "send_to_dep_chair": 120
};

P.workflow.registerWorkflowFeature("haplo:committee_scheduling",
    function(workflow, spec) {
        var plugin = workflow.plugin;

        // TODO changed so there's a specific one for each state with a specific flag
        // however lots of using plugins seem to rely on this so remove this once
        // that changes
        workflow.actionPanelTransitionUI({flags:["directToTransitions"]}, function(M, builder) {
            if(M.workUnit.isActionableBy(O.currentUser)) {
                _.each(M.transitions.list, function(t) {
                    builder.link(TRANSITION_BUTTON_PRIORITIES[t.name] || 150,
                        // Extra transitions appear after feature's own transitions
                        // Other things i.e. forms must appear between "forward to chair"
                        // and "forward to dep chair" options so "forward to chair" is more
                        // prominent (note schedule button added below)
                        "/do/workflow/transition/"+M.workUnit.id+"?transition="+t.name,
                        t.label, t.indicator);
                });
                return true;
            }
        });

        _.each(spec.scheduleInfo, function(stateInfo) {
            var committeeEntityName = stateInfo.committeeEntityName;
            var siFlags = stateInfo.flags || [];
            var siFlagsSetOnEnter = stateInfo.flagsSetOnEnter || [];
            var siFlagsSetOnExit = stateInfo.flagsSetOnExit || [];
            var siFlagsUnsetOnEnter = stateInfo.flagsUnsetOnEnter || [];
            var siFlagsUnsetOnExit = stateInfo.flagsUnsetOnExit || [];

            workflow.use("hres:schema:workflow:required_entities:add", [committeeEntityName]);
            workflow.use("hres:schema:workflow:required_entities:remove",
                [committeeEntityName+"Chair", committeeEntityName+"DepChair"]);

            var committeeEntities = {};
            if(O.application.config["haplo_committee_scheduling:enable_committee_rep_takeover"]) {
                committeeEntities[committeeEntityName+"Rep"] = function(context) {
                    var repRefs = [], M;
                    if("$M" in this) { M = this.$M; }
                    var committee = this[committeeEntityName+"_maybe"];
                    if(M && committee) { 
                        // look for repTakeovers stored in the workUnit data
                        var repTakeovers = M.workUnit.data.repTakeovers;
                        if(repTakeovers) {
                            var repRefStr = repTakeovers[committee.ref.toString()];
                            // if we have one, then put it at the start of our committee rep refs
                            // so that this user will be the default actionableBy for rep actions
                            if(repRefStr) {
                                repRefs.push(O.ref(repRefStr));
                            }
                        }
                    }
                    if(committee) {
                        committee.every(A.CommitteeRepresentative, function(rep) {
                            repRefs.push(rep);
                        });
                    }
                    return (context === "list") ? repRefs : repRefs[0];
                };
            } else { 
                committeeEntities[committeeEntityName+"Rep"] = [committeeEntityName, A.CommitteeRepresentative];
            }
            committeeEntities[committeeEntityName+"Chair"] = [committeeEntityName, A.Chair];
            committeeEntities[committeeEntityName+"DepChair"] = [committeeEntityName, A.DeputyChair];
            committeeEntities[committeeEntityName+"Member"] = [committeeEntityName, A.CommitteeMember];
            workflow.use("std:entities:add_entities", committeeEntities);

            var states = {};
            var committeeStateFlags = siFlags.concat(["directToTransitionsCommitteeSchedule"+stateInfo.state, "scheduleWorkflowExit"]);
            states[stateInfo.state] = {
                actionableBy: committeeEntityName+"Rep",
                transitions: [
                    ["progress_application"].concat(stateInfo.exitStates),
                    ["send_to_chair", stateInfo.state+"_chair"],
                    ["send_to_dep_chair", stateInfo.state+"_dep_chair"]
                ].concat(stateInfo.additionalTransitions || []),
                flags: committeeStateFlags,
                flagsSetOnEnter: siFlagsSetOnEnter,
                flagsSetOnExit: siFlagsSetOnExit,
                flagsUnsetOnEnter: siFlagsUnsetOnEnter,
                flagsUnsetOnExit: siFlagsUnsetOnExit
            };
            states[stateInfo.state+"_chair"] = {
                actionableBy: committeeEntityName+"Chair",
                transitions: [
                    ["progress_application"].concat(stateInfo.exitStates),
                    ["return_to_rep", stateInfo.state]
                ].concat(stateInfo.additionalTransitions || []),
                flags: committeeStateFlags,
                flagsSetOnEnter: siFlagsSetOnEnter,
                flagsSetOnExit: siFlagsSetOnExit,
                flagsUnsetOnEnter: siFlagsUnsetOnEnter,
                flagsUnsetOnExit: siFlagsUnsetOnExit
            };
            states[stateInfo.state+"_dep_chair"] = {
                actionableBy: committeeEntityName+"DepChair",
                transitions: [
                    ["progress_application"].concat(stateInfo.exitStates),
                    ["return_to_rep", stateInfo.state]
                ],
                flags: committeeStateFlags,
                flagsSetOnEnter: siFlagsSetOnEnter,
                flagsSetOnExit: siFlagsSetOnExit,
                flagsUnsetOnEnter: siFlagsUnsetOnEnter,
                flagsUnsetOnExit: siFlagsUnsetOnExit
            };
            workflow.states(states);

            var TRANSITION_TO_ENTITY = {
                "send_to_chair": committeeEntityName+"Chair",
                "send_to_dep_chair": committeeEntityName+"DepChair"
            };

            workflow.actionPanelTransitionUI({flags:["directToTransitionsCommitteeSchedule"+stateInfo.state]}, function(M, builder) {
                if(M.workUnit.isActionableBy(O.currentUser)) {
                    _.each(M.transitions.list, function(t) {
                        builder.link(TRANSITION_BUTTON_PRIORITIES[t.name] || 150,
                            // Extra transitions appear after feature's own transitions
                            // Other things i.e. forms must appear between "forward to chair"
                            // and "forward to dep chair" options so "forward to chair" is more
                            // prominent (note schedule button added below)
                            "/do/workflow/transition/"+M.workUnit.id+"?transition="+t.name,
                            t.label, t.indicator);
                    });
                    return true;
                }
            });

            workflow.filterTransition({state:stateInfo.state}, function(M, name) {
                if(name in TRANSITION_TO_ENTITY) {
                    var entitityName = TRANSITION_TO_ENTITY[name];
                    if(!M.entities[entitityName+'_refMaybe']) {
                        return false;
                    }
                }
            });

            workflow.observeExit({flags:["scheduleWorkflowExit"]}, function(M, transition) {
                if(transition === "progress_application" && M.workUnit.data.currentCommitteeMeeting) {
                    // So doesn't show up as being scheduled for subsequent committee stages
                    M.workUnit.data.currentCommitteeMeeting = null;
                }
                // make task visible again in the case that we exit committee scheduling before the meeting date or
                // forwards to chair/dep chair occur
                M.workUnit.openedAt = new Date();
            });

            var text = _.clone(TEXT);
            text["status:"+stateInfo.state] = "Awaiting @"+committeeEntityName+"@ meeting";
            text["status:"+stateInfo.state+"_chair"] = "Awaiting @"+committeeEntityName+"@ Chair";
            text["status:"+stateInfo.state+"_dep_chair"] = "Awaiting @"+committeeEntityName+"@ Deputy Chair";
            text["status:"+stateInfo.state+"_rep_notes"] = "Awaiting @"+committeeEntityName+"@ rep";
            workflow.text(text);

            workflow.actionPanel({state:stateInfo.state}, function(M, builder) {
                if(M.workUnit.isActionableBy(O.currentUser)) {
                    var app = M.entities.object;
                    var dateSet = M.workUnit.data.currentCommitteeMeeting ? O.ref(M.workUnit.data.currentCommitteeMeeting) : undefined;
                    if(dateSet) {
                        builder.link(50, spec.path+"/reschedule-form-meeting/"+
                            M.workUnit.id, "Reschedule meeting", "secondary");
                        var date = dateSet.load().first(A.Date);
                        if(date) {
                            builder.element(1000, {
                                label: "Scheduled for "+date.toString()
                            });
                        }
                    } else {
                        builder.link(50, spec.path+"/schedule-for-meeting/"+
                            M.workUnit.id, "Schedule meeting", "primary");
                    }
                }
            });

            // Option for all committee reps to receive email notifications at committee scheduling state
            if(O.application.config["haplo_committee_scheduling:enable_committee_rep_takeover"]) {
                workflow.observeEnter({state:stateInfo.state}, function(M) {
                    var template = P.template("email/notify_committee_reps");
                    var title = M.entities.object.title;
                    var view = {
                        emailSubject: title,
                        title: title,
                        appUrl: M.entities.object.url(true),
                        appProgress: "Progress application",
                        body: M.getTextMaybe("status:"+stateInfo.state) || "Awaiting committee meeting"
                    };
                    var committee = M.entities[committeeEntityName];
                    var firstRep = committee.first(A.CommitteeRepresentative);
                    committee.every(A.CommitteeRepresentative, function(rep) {
                        // first rep on committee will already have recieved a notification
                        if(firstRep != rep) { 
                            var recipient = O.user(rep);
                            M.sendEmail({
                                template: P.template("email/notify_committee_reps"),
                                to: recipient,
                                view: view
                            });
                        }
                    });
                });
                workflow.actionPanel({state:stateInfo.state}, function(M, builder) {
                    var committee = M.entities[committeeEntityName];
                    if(!committee.has(O.currentUser.ref, A.CommitteeRepresentative)) { return; }
                    if(!M.workUnit.isActionableBy(O.currentUser)) {
                        builder.link(50, spec.path+"/takeover/"+M.workUnit.id,
                            "Takeover as committee representative", "primary");
                    }
                });
            }
        });

        if(O.application.config["haplo_committee_scheduling:enable_committee_rep_takeover"]) {
            plugin.respond("GET,POST", spec.path+"/takeover", [
                {pathElement:0, as:"workUnit", workType:workflow.fullName, allUsers:true}
            ], function(E, workUnit) {
                E.setResponsiblePlugin(P);
                var M = workflow.instance(workUnit);
                var app = M.entities.object;
                var stateInfo = _.find(spec.scheduleInfo, function(si) {
                    return si.state === M.state;
                });
                if(!stateInfo) { O.stop("Invalid state"); }
                var committee = M.entities[stateInfo.committeeEntityName];
                if(!committee) { O.stop("Cannot find committee"); }
                if(!committee.has(O.currentUser.ref, A.CommitteeRepresentative)) { O.stop("Not permitted"); }
                if(E.request.method === "POST") {
                    var repTakeovers = M.workUnit.data.repTakeovers || {};
                    repTakeovers[committee.ref.toString()] = O.currentUser.ref.toString();
                    M.workUnit.data.repTakeovers = repTakeovers;
                    M.workUnit.actionableBy = O.currentUser;
                    M.workUnit.save();
                    return E.response.redirect(app.url());
                }
                E.render({
                    pageTitle: "Take over "+app.title,
                    backLink: app.url(),
                    text: "As you are an additional committee representative, you can take over this application to be able to apply decisions on behalf of the committee and the primary representative.",
                    options: [
                        {
                            label: "Take over this application"
                        }
                    ]
                }, "std:ui:confirm");
            });
        }

        var makeScheduleHandler = function(endOfPath, humanReadableVerb) {
            plugin.respond("GET,POST", spec.path+"/"+endOfPath, [
                {pathElement:0, as:"workUnit", workType:workflow.fullName},
                {parameter:"meeting", as:"object", optional:true}
            ], function(E, workUnit, meeting) {
                E.setResponsiblePlugin(P);
                var M = workflow.instance(workUnit);
                var app = M.entities.object;
                var stateInfo = _.find(spec.scheduleInfo, function(si) {
                    return si.state === M.state;
                });
                if(!stateInfo) { O.stop("Invalid state"); }
                var committee = M.entities[stateInfo.committeeEntityName];
                if(!committee) { O.stop("Cannot find committee"); }
                if(E.request.method === "POST" && meeting) {
                    if(!(meeting.isKindOf(T.CommitteeMeeting))) {
                        O.stop("Bad meeting");
                    }
                    var changesToAppObject = false;
                    var a = app.mutableCopy();
                    var organiser = meeting.first(A.OrganisedBy);
                    a.remove(A.CommitteeMeeting, function(v, d, q) {
                        return (v.load().first(A.OrganisedBy) == organiser);
                    });
                    a.append(meeting.ref, A.CommitteeMeeting);
                    O.withoutPermissionEnforcement(function() { a.save(); }); 
                    M.workUnit.data.currentCommitteeMeeting = meeting.ref.toString();
                    var date = meeting.first(A.Date);
                    if(date && date.start) {
                        // hide task from rep until meeting start
                        M.workUnit.openedAt = date.start;
                    }
                    M.workUnit.save();
                    E.response.redirect(app.url());
                }

                var meetings = O.query().
                    link(T.CommitteeMeeting, A.Type).
                    link(committee.ref, A.OrganisedBy).
                    dateRange(new Date(), undefined, A.Date).
                    sortBy("date_asc").
                    execute();

                var onlineDecisionUrl;
                if(stateInfo.onlineDecision) {
                    onlineDecisionUrl = P.showOnlineDecisionCreationLink(workflow, app) ? 
                        spec.path+"/start-online-decision/"+workUnit.id : undefined;
                }

                E.render({
                    pageTitle: humanReadableVerb+" committee meeting",
                    backLink: app.url(),
                    humanReadableVerb: humanReadableVerb,
                    thisPagePath: E.request.path,
                    committeeName: committee.title,
                    committeeRef: committee.ref,
                    onlineDecisionName: NAME("Online decision"),
                    onlineDecisionUrl: onlineDecisionUrl,
                    haveMeetings: !!meetings.length,
                    meetings: _.map(meetings, function(meeting) {
                        var datetime = meeting.first(A.Date);
                        var location = meeting.first(A.Location);
                        return {
                            ref: meeting.ref,
                            location: location ? location.toString() : null,
                            datetime: datetime ? datetime.toString() : "unknown"
                        };
                    })
                }, "schedule-committee-meeting");
            });
        };

        makeScheduleHandler("schedule-for-meeting", "Schedule");
        makeScheduleHandler("reschedule-form-meeting", "Reschedule");

        // online decision functionality
        if(_.some(spec.scheduleInfo, function(stateInfo) { return stateInfo.onlineDecision; })) {
            P.makeOnlineDecisionHandlers(workflow, spec);
        }

        // Pre meeting review functionality
        P.committeePreMeetingReview(workflow, spec);

        plugin.implementService("haplo_committee_support:chairs_actions", function(apps, startRange, endRange, committeeRef) {
            var wus = O.work.query(workflow.fullName).isEitherOpenOrClosed();
            _.each(wus, function(wu) {
                var M = workflow.instance(wu);
                if(M) {
                    _.each(spec.scheduleInfo, function(stateInfo) {
                        if(M.entities[stateInfo.committeeEntityName+"_refMaybe"] == committeeRef) {
                            var timelineQuery = M.timelineSelect().where("datetime", "<", endRange).
                                where("action", "=", "progress_application").
                                or(function(sq) {
                                    sq.where("previousState", "=", stateInfo.state+"_chair").
                                    where("previousState", "=", stateInfo.state+"_dep_chair");
                                });
                            if(startRange) {
                                timelineQuery.where("datetime", ">", startRange);
                            }
                            if(timelineQuery.length) {
                                apps.push(M.workUnit.ref);
                            }
                        }
                    });
                }
            });
        });

    }
);
