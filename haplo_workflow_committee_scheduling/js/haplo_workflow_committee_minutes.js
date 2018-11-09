/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2018            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


if(O.application.config["haplo_committee_scheduling:disable_minutes"]) { return; }

var CanSeeMinutes = O.action("haplo_committee_scheduling:can_see_minutes").
    title("Can see all committee minutes");

// any attendee or member of the organisedBy committees can see minutes for the committee
var canSeeMinutes = function(meeting, user) {
    let canSeeMinutes = user.allowed(CanSeeMinutes);
    if(!canSeeMinutes) {
        canSeeMinutes = meeting.has(user.ref, A.Attendee);
    }
    if(!canSeeMinutes) {
        const committees = meeting.every(A.OrganisedBy);
        canSeeMinutes = _.some(committees, (c) => {
            c = c.load();
            const attrs = [A.Chair, A.DeputyChair, A.CommitteeRepresentative, A.CommitteeMember];
            return _.some(attrs, (attr) => c.has(user.ref, attr));
        });
    }
    return canSeeMinutes;
};

P.respond("GET,POST", "/do/haplo-workflow-committee-scheduling/minutes", [
    {pathElement:0, as:"object"},
], function(E, meeting) {
    // TODO: be able to attach meeting files
    if(!canSeeMinutes(meeting, O.currentUser)) { O.stop("Only attendees can see the actions taken."); }
    const meetingDate = meeting.first(A.Date);
    if(!meetingDate) { O.stop("This meeting does not have a date, so minutes cannot be generated."); }
    E.setResponsiblePlugin(P);
    let agendaItems = O.query().link(meeting.ref).execute();
    agendaItems = _.sortBy(agendaItems, (item) => item.title);
    let agenda = [];
    const meetingNotStarted = new Date() < meetingDate.start;
    _.each(agendaItems, (item) => {
        let itemInfo = { item: item };
        const wuq = O.work.query().ref(item.ref).isEitherOpenOrClosed();
        let workflow, M;
        _.some(wuq, (wu) => {
            // don't know workflow name up front - have to find it by using the workType info accessible from workunits
            workflow = O.service("std:workflow:definition_for_name", wu.workType);
            if(workflow) {
                M = O.service("std:workflow:for_ref", wu.workType, item.ref);
                return true;
            }
        });
        if(M) {
            const spec = { meeting: meeting, actions: [] };
            M.workflowServiceMaybe("haplo_committee_scheduling:actions_for_meeting", spec);

            let seenIds = [];
            let actions = _.chain(spec.actions).
                sortBy(a => a.datetime).
                filter(a => {
                    if(!_.contains(seenIds, a.id)) {
                        seenIds.push(a.id);
                        return true;
                    }
                }).
                map(a => M.timelineEntryDeferredRender(a)).
                value();
            itemInfo.actions = actions;
            agenda.push(itemInfo);
        }
    });
    let view = {
        meeting: meeting,
        agenda: agenda,
        meetingNotStarted: meetingNotStarted
    };
    // TODO: download
    // if(E.request.method === "POST") {
    //     const minutesHtml = "<div class=\"minutesbody\">"+P.template("minutes/minutes-download").render(view)+"</div>";
    //     const pipeline = O.fileTransformPipeline();
    //     pipeline.transform("std:generate:formatted_text", {
    //         mimeType: "application/pdf",
    //         html: minutesHtml,
    //         css: P.loadFile("static/minutes.css").readAsString()
    //     });
    //     const redirectURL =
    //         pipeline.urlForOutputWaitThenDownload("output", meeting.title + " actions taken");
    //     pipeline.execute();
    //     E.response.redirect(redirectURL);
    // }
    E.render(view, "minutes/minutes");
});

P.implementService("std:action_panel:committee_meeting", function(display, builder) {
    const meeting = display.object;
    const agendaItems = O.query().link(meeting.ref).execute();
    if(agendaItems.length && canSeeMinutes(meeting, O.currentUser)) {
        const panel = builder.panel(200);
        panel.link("default", "/do/haplo-workflow-committee-scheduling/minutes/"+meeting.ref, "Actions taken");
    }
});