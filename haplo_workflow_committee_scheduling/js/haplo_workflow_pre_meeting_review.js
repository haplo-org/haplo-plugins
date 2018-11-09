/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */

P.db.table("preMeetingReviews", {
    application: {type:"ref", indexed:true},
    committee: {type:"ref", indexed:true},
    document: {type:"json"},
    datetime: {type:"datetime"}
});

P.implementService("haplo_workflow_committee_scheduling:get_reviewers_for_apps",
    function(apps, committeeRef) {
        var reviewers = O.refdict();
        _.each(apps, function(app) {
            var query = P.db.preMeetingReviews.select().where("application","=",app.ref).
                where("committee","=",committeeRef);
            if(query.length > 0) {
                var entry = query[0];
                var document = entry.document;
                reviewers.set(app.ref, _.map(document.members, function(refStr) {
                    return O.ref(refStr);
                }));
            }
        });
        return reviewers;
    }
);

var PRE_MEETING_REVIEW_FORM = P.replaceableForm("preMeetingReview",
    "form/pre_meeting_review_form.json");
var REJECT_REVIEW_FORM = P.replaceableForm("rejectPreMeetingReview",
    "form/reject_pre_meeting_review_form.json");

P.committeePreMeetingReview = function(workflow, spec) {
    var plugin = workflow.plugin;

    workflow.text({
        "timeline-entry:haplo_committee_sent_for_review": "sent application for review",
        "timeline-entry:haplo_committee_removed_reviewers": "removed reviewers for application",
        "timeline-entry:haplo_committee_updated_reviewers": "updated reviewers for application"
    });

    plugin.respond("GET,POST", spec.path+"/pre-meeting-review", [
        {pathElement:0, as:"workUnit", workType:workflow.fullName}
    ], function(E, workUnit) {
        E.setResponsiblePlugin(P);
        var M = workflow.instance(workUnit);
        var stateInfo = _.find(spec.scheduleInfo, function(si) {
            return si.state === M.state;
        });
        if(!stateInfo) { O.stop("Invalid state"); }
        var app = M.entities.object;
        if(!M.workUnit.data.currentCommitteeMeeting) {
            return E.render({
                pageTitle: "Pre-meeting review",
                backLink: app.url(),
                html: "<p> Please first schedule this application for "+
                    "discussion at a meeting <a href=\""+spec.path+
                    "/schedule-for-meeting/"+M.workUnit.id+
                    "\"> here</a>.</p>"
            }, "std:ui:notice");
        }
        var committee = M.entities[stateInfo.committeeEntityName];
        if(!committee.first(A.CommitteeMember)) {
            return P.noCommitteeMembersFoundNotice(M, E);
        }
        var dbQuery = P.db.preMeetingReviews.select().where("application","=",app.ref).
            where("committee","=",committee.ref);
        var entry = dbQuery.length > 0 ? dbQuery[0] : P.db.preMeetingReviews.create({
            application: app.ref,
            committee: committee.ref,
            document: {}
        });
        var document = _.clone(entry.document);
        var form = PRE_MEETING_REVIEW_FORM.instance(document);
        form.choices("committeeMembers", _.map(committee.every(A.CommitteeMember), function(ref) {
            return [ref.toString(), ref.load().title];
        }));
        form.update(E.request);
        var meeting = O.ref(M.workUnit.data.currentCommitteeMeeting).load();
        var date = meeting.first(A.Date);
        if(form.complete) {
            var added = _.difference(document.members, entry.document.members);
            var removed = _.difference(entry.document.members, document.members);
            if(!entry.document.members && document.members) {
                M.addTimelineEntry("haplo_committee_sent_for_review", document.members);
            } else if(!document.members) {
                M.addTimelineEntry("haplo_committee_removed_reviewers");
            } else if(added.length || removed.length) {
                M.addTimelineEntry("haplo_committee_updated_reviewers");
            }
            entry.document = document;
            entry.datetime = new Date();
            entry.save();
            M.sendEmail({
                template: P.template("email/review_application"),
                to: _.map(added, function(refStr) {
                    return O.ref(refStr);
                }),
                view: {
                    committee: committee,
                    date: date.start,
                    notes: document.notes
                }
            });
            return E.response.redirect(app.url());
        }
        E.render({
            form: form,
            app: app,
            date: date
        });
    });

    plugin.respond("GET,POST", spec.path+"/reject-review", [
        {pathElement:0, as:"object"},
        {parameter:"sent", as:"int", optional:true}
    ], function(E, app, sent) {
        E.setResponsiblePlugin(P);
        sent = !!sent;
        if(sent) {
            return E.render({
                pageTitle: "Reject review request",
                backLink: app.url(),
                message: "Notification has been sent to the committee representative",
                dismissLink: app.url(),
                dismissText: "OK"
            }, "std:ui:notice");
        }
        var M = workflow.instanceForRef(app.ref);
        var stateInfo = _.find(spec.scheduleInfo, function(si) {
            return si.state === M.state;
        });
        if(!stateInfo) { O.stop("Invalid state"); }
        var committee = M.entities[stateInfo.committeeEntityName];
        var query = P.db.preMeetingReviews.select().
            where("application","=",app.ref).
            where("committee","=",committee.ref);
        if(!query.length) { O.stop("Not permitted"); }
        var entry = query[0];
        var document = _.clone(entry.document);
        var currentUserIsReviewer = _.find(document.members, function(refStr) {
            return O.currentUser.ref && O.currentUser.ref.toString() === refStr;
        });
        if(!currentUserIsReviewer) { O.stop("Not permitted"); }
        var reasoning = {};
        var form = REJECT_REVIEW_FORM.handle(reasoning, E.request);
        if(form.complete) {
            document.members = _.without(document.members, O.currentUser.ref.toString());
            entry.document = document;
            entry.save();
            M.sendEmail({
                template: P.template("email/reject_review_request"),
                to: stateInfo.committeeEntityName+"Rep",
                view: {
                    M: M,
                    reviewer: O.currentUser.ref.load(),
                    reasoning: reasoning
                }
            });
            return E.response.redirect("?sent=1");
        }
        E.render({
            M: M,
            form: form
        });
    });

    _.each(spec.scheduleInfo, function(stateInfo) {

        workflow.actionPanel({state:stateInfo.state}, function(M, builder) {
            if(M.workUnit.isActionableBy(O.currentUser)) {
                builder.panel(P.COMMITTEE_ACTION_PANEL_PRIORITY).link(70, spec.path+"/pre-meeting-review/"+M.workUnit.id,
                    "Request review", "primary");
            }

            var app = M.entities.object;
            var committee = M.entities[stateInfo.committeeEntityName];
            var query = P.db.preMeetingReviews.select().
                where("application","=",app.ref).
                where("committee","=",committee.ref);
            if(query.length > 0) {
                var entry = query[0];
                var document = _.clone(entry.document);
                var currentUserIsReviewer = false;
                if(document.members) {
                    builder.element(1100, {
                        label: "Sent for review "+
                            (new XDate(entry.datetime).toString("dd MMM yyyy"))+
                            " to"+
                            _.reduce(document.members, function(text, refStr, index) {
                                if(O.currentUser.ref && O.currentUser.ref.toString() === refStr) {
                                    currentUserIsReviewer = true;
                                }
                                if(index > 0 && index === document.members.length - 1) {
                                    text = text + " and";
                                } else if(index > 0) {
                                    text = text+",";
                                }
                                text = text+" "+(O.ref(refStr).load().title);
                                return text;
                            }, "")
                    });
                }
                if(currentUserIsReviewer) {
                    builder.link(1200, spec.path+"/reject-review/"+app.ref,
                        "Reject review request", "terminal");
                }
            }
        });

    });

};
