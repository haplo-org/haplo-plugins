/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


var canCreateMeeting = function(user, committee) {
    var labels = [committee.ref, T.CommitteeMeeting];
    var ri = committee.first(A.ResearchInstitute);
    if(ri) { labels.push(ri); }
    var meetingLabels = O.labelList(labels);
    return user.canCreate(meetingLabels);
};

P.implementService("std:action_panel:committee", function(display, builder) {
    if(canCreateMeeting(O.currentUser, display.object)) {
        builder.link("default", "/do/haplo-committee-support/new-committee-meeting/"+display.object.ref, "Schedule new meeting", "normal");
    }

    var upcomingMeetings = O.query().
        link(T.CommitteeMeeting, A.Type).
        link(display.object.ref, A.OrganisedBy).
        // A.Date specified so it doesn't check other date attributes e.g. deadline for agenda items
        dateRange(new Date(), null, A.Date).
        sortByDateAscending().
        execute();

    if(upcomingMeetings.length) {
        var panel = builder.panel(1);
        panel.element(0, {title:"Upcoming meetings"});
        _.each(upcomingMeetings, function(meeting) {
            var date = meeting.first(A.Date);
            if(date && date.start) {
                panel.link("default", meeting.url(), new XDate(date.start).toString("dd MMM yyyy"));
            }
        });
    }

    var pastMeetings = O.query().
        link(T.CommitteeMeeting, A.Type).
        link(display.object.ref, A.OrganisedBy).
        // A.Date specified so it doesn't check other date attributes e.g. deadline for agenda items
        dateRange(new XDate().addYears(-1).toDate(), new Date(), A.Date).
        limit(11).
        sortByDate().
        execute();

    if(pastMeetings.length) {
        var pastPanel = builder.panel(3000);
        pastPanel.element(0, {title:"Past meetings"});
        _.each(pastMeetings, function(m, i) {
            var date = m.first(A.Date);
            if(date && date.start && i < 10) {
                pastPanel.link("default", m.url(), new XDate(date.start).toString("dd MMM yyyy"));
            }
        });
        if(pastMeetings.length > 10) {
            pastPanel.link("default", display.object.url()+"/linked/"+T.Meeting+"?sort=date", "View all...");            
        }
    }
});

P.respond("GET,POST", "/do/haplo-committee-support/new-committee-meeting", [
    {pathElement:0, as:"object"},
    {parameter:"back", as:"string", optional:true}
], function(E, committee, back) {
    if(!canCreateMeeting(O.currentUser, committee)) { O.stop("Not permitted"); }
    if(back && !(/^\//.test(back))) { O.stop("Invalid back path"); }
    var meeting = O.object();
    meeting.appendType(T.CommitteeMeeting);
    meeting.append(committee.ref, A.OrganisedBy);
    var appendAttendee = function(v,d,q) {
        if(!meeting.has(v, A.Attendee)) {
            meeting.append(v, A.Attendee);
        }
    };
    committee.every(A.Chair, appendAttendee);
    committee.every(A.DeputyChair, appendAttendee);
    committee.every(A.CommitteeMember, appendAttendee);
    var i = P.locale().text("template");
    meeting.appendTitle(committee.title + " meeting");
    var finishedUrl = back || committee.url();
    E.render({
        pageTitle: committee.title + ": "+i["Schedule new meeting"],
        backLink: finishedUrl,
        templateObject: meeting,
        successRedirect: P.template("success-redirect-url").render({finishedUrl:finishedUrl})
    }, "std:new_object_editor");
});

P.respond("GET,POST", "/do/haplo-committee-support/confirm-new-committee-meeting", [
    {parameter:"ref", as:"object"},
    {parameter:"back", as:"string"},
    {parameter:"choice", as:"string", optional:true}
], function(E, meeting, back, choice) {
    let committee = meeting.first(A.OrganisedBy);
    if(!committee) { O.stop("Committee not found"); }
    if(!canCreateMeeting(O.currentUser, committee.load())) { O.stop("Not permitted"); }
    if(back && !(/^\//.test(back))) { O.stop("Invalid back path"); }

    if(E.request.method === "POST") {
        if(choice === "edit") { return E.response.redirect("/do/edit/"+meeting.ref+"?back="+back); }
        else if(choice === "continue") { return E.response.redirect(back); }
        else { O.stop("Not a valid choice."); }
    } else {
        let parameters = { ref: meeting.ref, back: back };
        var i = P.locale().text("template");
        let spec = {
            pageTitle: i["Confirm: new"]+" "+meeting.title,
            options: [
                {parameters:_.extend({}, parameters, {"choice":"edit"}), label: i["Edit meeting"]},
                {parameters:_.extend({}, parameters, {"choice":"continue"}), label: i["Continue"]}
            ]
        };
        if(!meeting.first(A.Date)) {
            spec.text = i["You have not entered a meeting date. Would you like to continue?"];
            E.render(spec, "std:ui:confirm");
        } else if(meeting.first(A.Date).start < new Date()) {
            spec.text = i["You have entered a meeting date in the past, so you will not be able to schedule items to be discussed at this meeting. Would you like to continue?"];
            E.render(spec, "std:ui:confirm");
        } else {
            return E.response.redirect(back);
        }
    }
});

// TODO remove when platform function available
P.globalTemplateFunction("haplo_committee_support:render_object_list", function(objList) {
    return _.reduce(objList, function(text, obj, index) {
        if(index > 0 && index === objList.length - 1) {
            text = text+" and";
        } else if(index > 0) {
            text = text+",";
        }
        text = text+" "+(obj.title);
        return text;
    }, "");
});

var sendAgendaNotification = function(meeting) {
    var date = meeting.first(A.Date);
    var location = meeting.first(A.Location);
    var view = {
        fullInfoURL: meeting.url(true),
        date: date ? date.start : undefined,
        location: location ? location.toString() : undefined
    };
    var apps = O.query().link(meeting.ref, A.CommitteeMeeting).execute();
    var committeeRef = meeting.first(A.OrganisedBy);
    var reviewers = committeeRef ?  O.serviceMaybe(
        "haplo_workflow_committee_scheduling:get_reviewers_for_apps",
        apps, committeeRef) : undefined;
    var appDetails = _.map(apps, function(app) {
        var typeInfo = SCHEMA.getTypeInfo(app.firstType());
        var applicant = app.first(A.Researcher);
        return {
            typeName: typeInfo.name,
            applicantSurname: applicant ?
                applicant.load().firstTitle().toFields().last : undefined,
            url: app.url(true),
            reviewers: _.map(reviewers.get(app.ref), function(ref) { return ref.load(); })
        };
    });
    view.appDetails = _.sortBy(_.sortBy(appDetails, "applicantSurname"), "typeName");
    var attendees = meeting.every(A.Attendee);
    if(committeeRef) {
        var committee = committeeRef.load();
        view.committee = committee;
        if(!attendees.length) {
            // If there are no attendees, notify rep
            attendees = committee.every(A.CommitteeRepresentative);
            view.noAttendees = true;
        }
    }
    _.each(attendees, function(recipientRef) {
        var toUser = O.user(recipientRef);
        if(toUser) {
            view.toUser = toUser;
            O.email.template("haplo:email-template:committee-notification").deliver(
                toUser.email, toUser.name, "Reminder - "+meeting.title,
                P.template("email/meeting_reminder").render(view));
        }
    });
};

if(!O.application.config["haplo_committee_support:disable_notifications_when_items_added"]) {
    P.hook("hPostObjectChange", function(response, object, operation, previous) {
        object.every(A.CommitteeMeeting, function(meetingRef) {
            if(previous && previous.has(meetingRef, A.CommitteeMeeting)) { return; }
            var meeting = meetingRef.load();
            var date = meeting.first(A.Date);
            if(!date || !date.start) { return; }
            if(new XDate().clearTime().addDays(7).diffDays(date.start) < 0) {
                sendAgendaNotification(meeting);
            }
        });
    });
}

P.hook("hScheduleDailyEarly", function() {
    var committeeMeetings = O.refdict(function() { return []; });
    _.each(O.query().link(T.CommitteeMeeting, A.Type).execute(), function(meeting) {
        var committeeRef = meeting.first(A.OrganisedBy);
        if(committeeRef) { committeeMeetings.get(committeeRef).push(meeting); }
    });
    _.each(O.query().link(T.Committee, A.Type).execute(), function(committee) {
        // TODO check committee for agenda circulated in weeks
        var weeks = 1;
        var cmpDate = (new XDate()).addWeeks(weeks).clearTime();
        var meetings = committeeMeetings.get(committee.ref);
        _.each(meetings, function(meeting) {
            var date = meeting.first(A.Date);
            if(date) {
                var dateObj = new XDate(date.start).clearTime();
                if(dateObj.diffDays(cmpDate) === 0) {
                    sendAgendaNotification(meeting);
                }
            }
        });
    });
});

P.respond("GET", "/do/haplo-committee-support/test-scheduled", [
], function(E) {
    if(O.currentUser.isMemberOf(Group.Administrators)) {
        P.hScheduleDailyEarly({},0,0,0,0,0);
        E.response.body = "CALLED";
        E.response.kind = "text";
    }
});

P.implementService("std:action_panel:committee_meeting", function(display, builder) {
    var apps = O.query().link(display.object.ref).execute();
    apps = _.sortBy(apps, function(app) {
        // Using title so new and legacy change requests are ordered correctly
        return app.title;
    });
    if(apps.length) {
        var panel = builder.panel(100);
        panel.element(0, {title:NAME("Agenda")});
        _.each(apps, function(app) {
            panel.link("default", app.url(), app.title);
        });
    }
});

P.respond("GET", "/do/haplo-committee-support/committees", [
], function(E) {
    var committees = O.query().
        link(T.Committee, A.Type).
        sortByTitle().
        execute();
    E.render({
        committees: committees
    });
});

P.respond("GET", "/do/haplo-committee-support/upcoming-meetings", [
], function(E) {
    var committeeMeetings = O.query().
        link(T.CommitteeMeeting, A.Type).
        dateRange(new Date()).
        sortByDateAscending().
        execute();
    E.render({
        committeeMeetings: committeeMeetings
    });
});

P.hook("hNavigationPosition", function(response, name) {
    if(name === "haplo:committee-information" && !O.application.config["haplo_committee_support:hide_committee_navigation"] ) {
        var navigation = response.navigation;
        navigation.separator();
        navigation.link("/do/haplo-committee-support/committees", "Committees").
            link("/do/haplo-committee-support/upcoming-meetings", "Upcoming meetings");
    }
});
