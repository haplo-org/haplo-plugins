/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2019            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


var CanAdministrateIntegrations = O.action("haplo:integration:can-administrate");

// --------------------------------------------------------------------------

P.implementService("haplo:integration:admin-ui:add-options", function(options) {
    options.push({
        action: "/do/haplo-integration-messages/queues",
        label: "Integration message queues",
        notes: "View integration message queues, mark messages for resend.",
        indicator: "standard"
    });
});

// --------------------------------------------------------------------------

var getAllGroupsInfo = function() {
    let queues = [];
    O.serviceMaybe("haplo:integration-message:discover", function(info) {
        queues.push(info);
    });
    return queues;
};

var getCheckedGroupInfo = P.getCheckedGroupInfo = function(groupName) {
    let group = getAllGroupsInfo().find((q) => q.group === groupName);
    if(!group) { O.stop("Group not defined"); }
    return group;
};

// --------------------------------------------------------------------------

P.respond("GET", "/do/haplo-integration-messages/queues", [
], function(E) {
    CanAdministrateIntegrations.enforce();
    let queues = getAllGroupsInfo();
    E.render({
        options: queues.map((info) => {
            return {
                action: "/do/haplo-integration-messages/queue/"+encodeURIComponent(info.group),
                label: info.title,
                notes: info.description,
                indicator: "standard"
            };
        })
    });
});

P.respond("GET", "/do/haplo-integration-messages/queue", [
    {pathElement:0, as:"string"},
    {parameter:"last", as:"int", optional:true}
], function(E, groupName, lastDisplayId) {
    CanAdministrateIntegrations.enforce();
    let group = getCheckedGroupInfo(groupName);
    let messages = P.db.messages.select().where("groupName","=",groupName).order("id",true).limit(10);
    if(lastDisplayId) { messages.where("id","<",lastDisplayId); }
    let view = {
        group: group,
        showSendButton: group.method === "send",
        messages: messages,
        lastDisplayId: (messages.length > 0) ? (messages[messages.length - 1].id) : 0
    };
    if(group.method === "poll") {
        view.pollUrl = O.application.url+"/api/haplo-integration-messages/poll/"+groupName+"/fetch";
        view.markUrl = O.application.url+"/api/haplo-integration-messages/poll/"+groupName+"/mark";
    }
    E.render(view);
});

P.respond("GET,POST", "/do/haplo-integration-messages/queue-send", [
    {pathElement:0, as:"string"},
    {parameter:"sent", as:"int", optional:true}
], function(E, groupName, sent) {
    CanAdministrateIntegrations.enforce();
    let group = getCheckedGroupInfo(groupName);
    let view = {
        group: group,
        sent: !!sent
    };
    if(E.request.method === "POST") {
        O.service("haplo:integration-message:send", {
            group: groupName
        });
        E.response.redirect("/do/haplo-integration-messages/queue-send/"+groupName+"?sent=1");
    } else {
        let count = P.db.messages.select().where("groupName","=",groupName).where("sentDate","=",null).count();
        view.text = "Would you like to send all outstanding messages to the remote endpoint?\nMessages to send: "+count;
        view.options = [{
            label: "Queue for sending"
        }];
    }
    E.render(view);
});

P.respond("GET,POST", "/do/haplo-integration-messages/poll-create-api-key", [
    {pathElement:0, as:"string"}
], function(E, groupName) {
    CanAdministrateIntegrations.enforce();
    let group = getCheckedGroupInfo(groupName);
    if(E.request.method === "POST") {
        return E.render({
            group: group,
            key: O.serviceUser("haplo:service-user:integration-message-queue-poll:access").
                    createAPIKey(
                        "REST API: "+group.title,
                        "/api/haplo-integration-messages/poll/"+group.group+"/"
                    )
        });
    }
    E.render({
        group: group,
        text: "Create new API key for "+group.title+"?",
        options: [{label:"Create API key"}]
    });
});


P.respond("GET,POST", "/do/haplo-integration-messages/queue-add-message", [
    {pathElement:0, as:"string"},
], function(E, groupName) {
    CanAdministrateIntegrations.enforce();
    let group = getCheckedGroupInfo(groupName);
    let view = {
        group: group,
        message: E.request.parameters.message
    };
    if(E.request.method === "POST") {
        let json;
        try {
            json = JSON.parse(view.message);
        } catch(e) { /* ignore */ }
        if(json) {
            let id = O.service("haplo:integration-message:add", {
                _manualCreation: true,
                group: groupName,
                data: json
            });
            if(id) {
                return E.response.redirect("/do/haplo-integration-messages/message/"+encodeURIComponent(groupName)+"/"+id);
            }
        } else {
            view.error = true;
        }
    }
    E.render(view);
});

P.respond("GET", "/do/haplo-integration-messages/message", [
    {pathElement:0, as:"string"},
    {pathElement:1, as:"db", table:"messages"}
], function(E, groupName, message) {
    CanAdministrateIntegrations.enforce();
    let group = getCheckedGroupInfo(groupName);
    if(message.groupName !== groupName) { O.stop("Message in wrong group"); }
    let formatted = P.formatMessageForBody(groupName, [{
        id: message.id,
        creationDate: message.creationDate,
        data: message.data
    }]);
    E.render({
        group: group,
        message: message,
        formattedMimeType: formatted ? formatted.mimeType : undefined,
        formatted: formatted ? formatted.readAsString("utf-8") : undefined,
        json: JSON.stringify(message.data, undefined, 2)
    });
});

P.respond("GET,POST", "/do/haplo-integration-messages/message-unsend", [
    {pathElement:0, as:"string"},
    {pathElement:1, as:"db", table:"messages"}
], function(E, groupName, message) {
    CanAdministrateIntegrations.enforce();
    let group = getCheckedGroupInfo(groupName);
    if(message.groupName !== groupName) { O.stop("Message in wrong group"); }
    if(E.request.method === "POST") {
        message.sentDate = null;
        message.save();
        O.audit.write({
            auditEntryType: "haplo_integration_messages:mark_unsent",
            data: {
                group: groupName,
                messageId: message.id
            }
        });
        return E.response.redirect("/do/haplo-integration-messages/message/"+encodeURIComponent(groupName)+"/"+message.id);
    }
    E.render({
        group: group,
        message: message,
        text: "Mark this message as unsent?\nIt will be resent to the remote application in the same way as a new message.",
        options: [{
            label: "Mark as unsent"
        }]
    });
});
