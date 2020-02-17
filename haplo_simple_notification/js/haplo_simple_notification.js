/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */

P.respond("GET,POST", "/do/haplo-simple-notification", [
    {pathElement:0, as:"workUnit", workType:"haplo_simple_notification:message"}
], function(E, workUnit) {
    if(E.request.method === "POST") {
        var serviceName = "haplo:simple_notification:closed:"+workUnit.tags.kind;
        var redirectPath;
        if(O.serviceImplemented(serviceName)) {
            redirectPath = O.service(serviceName, workUnit);
        }
        workUnit.deleteObject();
        return E.response.redirect(redirectPath || "/do/tasks");
    }
    var details = getDetails(workUnit);
    var responses = P.db.replies.select().where("workUnitId", "=", workUnit.id).
        order("datetime");
    var i = P.locale().text("template");
    E.render({
        pageTitle: details.title,
        responses: responses,
        text: details.text,
        object: workUnit.ref,
        options: [
            {
                label: details.buttonLabel || i["Mark as complete"]
            },
            {
                label: i["Reply"],
                action: "/do/haplo-simple-notification/send-reply/"+workUnit.id
            }
        ]
    }, "notification");
});

P.db.table("replies", {
    sender:     { type:"user" },
    recipient:  { type:"user" },
    workUnitId: { type:"int", indexed:true },
    content:    { type:"text" },
    datetime:   { type:"datetime" }
});

P.respond("GET,POST", "/do/haplo-simple-notification/send-reply", [
    {pathElement:0, as:"workUnit", workType:"haplo_simple_notification:message"},
    {parameter:"emailText", as:"string", optional:true}
], function(E, workUnit, emailText) {
    // TODO needs to be more flexible than just whoever created the workUnit
    var toUser = workUnit.createdBy;
    var details = getDetails(workUnit);
    if(E.request.method === "POST") {
        if(emailText === null) {
            return E.response.redirect("/do/haplo-simple-notification/send-reply/"+workUnit.id);
        }
        var view = {
            toUser: toUser,
            emailText: emailText,
            details: details
        };
        if(O.currentUser) {
            view.senderName = O.currentUser.name;
            view.senderEmail = O.currentUser.email;
        }
        var body = P.template("email/reply").render(view);
        O.email.template("haplo:simple-notification:template").deliver(toUser.email,
            toUser.name, details.title, body);
        P.db.replies.create({
            sender: O.currentUser,
            recipient: toUser,
            workUnitId: workUnit.id,
            content: emailText,
            datetime: new Date()
        }).save();
        if(workUnit.data._originatingWorkflowRef && workUnit.data._originatingWorkflowType) {
            var ref = O.ref(workUnit.data._originatingWorkflowRef);
            var M = O.service("std:workflow:for_ref",
                workUnit.data._originatingWorkflowType, ref);
            // TODO replace with service once available
            M.addTimelineEntry("NOTE", {text:emailText});
        }
        return E.response.redirect("/do/haplo-simple-notification/"+workUnit.id);
    }
    E.render({
        workUnit: workUnit,
        details: details,
        toUser: toUser
    });
});

P.implementService("haplo:simple_notification:create", function(spec) {
    if(typeof(spec.kind) !== "string") {
        throw new Error("Notification kind must be a string.");
    }
    var data = spec.data || {};
    if(spec.workflow) {
        var M = spec.workflow;
        data._originatingWorkflowRef = M.workUnit.ref.toString();
        data._originatingWorkflowType = M.workUnit.workType;
    }
    if(spec.deduplicate) {
        let exists = O.work.query("haplo_simple_notification:message").
            actionableBy(spec.recipient).
            tag('kind', spec.kind).
            ref(spec.ref).
            isOpen();
        if(exists.length) { return; }
    }
    return O.work.create({
        workType: "haplo_simple_notification:message",
        actionableBy: spec.recipient,
        data: data,
        ref: spec.ref,
        tags: {
            kind: spec.kind
        }
    }).save();
});

var getDetails = function(workUnit) {
    var serviceName = "haplo:simple_notification:details:"+workUnit.tags.kind;
    return O.service(serviceName, workUnit);
};

P.workUnit({
    workType:"message",
    description:"Notification message",
    notify: function(workUnit) {
        var details = getDetails(workUnit);
        return {
            template: details.template || "std:email-template:workflow-notification",
            title: details.title,
            notesHTML: details.text,
            button: details.buttonLabel || "Mark as complete",
            action: details.link || "/do/haplo-simple-notification/"+workUnit.id
        };
    },
    render: function(W) {
        if(!W.workUnit.closed && W.workUnit.isActionableBy(O.currentUser)) {
            var details = getDetails(W.workUnit);
            W.render({
                fullInfo: details.link || "/do/haplo-simple-notification/"+W.workUnit.id,
                title: details.title,
                taskNote: details.taskNote
            }, "view_notification");
        }
    }
});

// ------ Queries -------

P.implementService("haplo:simple_notification:query", function(kind, ref) {
    var query = O.work.query("haplo_simple_notification:message").tag("kind", kind);
    if(ref) {
        return query.ref(ref);
    }
    return query;
});
