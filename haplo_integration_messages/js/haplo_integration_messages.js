/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2019            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


P.db.table("messages", {
    groupName: {type:"text"},
    creationDate: {type:"datetime"},
    manualCreationBy: {type:"user", nullable:true},
    sentDate: {type:"datetime", nullable:true},
    data: {type:"json"}
});

P.implementService("haplo:integration-message:add", function(details) {
    if(details.group && details.data) {
        let msg = P.db.messages.create({
            groupName: details.group,
            creationDate: new Date(),
            data: details.data
        });
        if(details._manualCreation) {
            msg.manualCreationBy = O.currentUser;
        }
        msg.save();
        return msg.id;
    }
});

P.formatMessageForBody = function(groupName, messages) {
    let token = O.base64.encode(messages.map((m) => m.id).join(","));
    let formatted = O.serviceMaybe("haplo:integration-message:write-messages:"+groupName, messages, token);
    if(!formatted) {
        // Default formatting is JSON
        let messagesFormatted = messages.map((m) => {
            return _.extend({
                id: m.id,
                datetime: (new XDate(m.creationDate)).toString("yyyy-MM-dd'T'HH:mm:ss'Z'")
            }, m.data);
        });
        let body = {
            version: 0,
            token: token,
            messages: messagesFormatted
        };
        formatted = O.binaryData(JSON.stringify(body, undefined, 2), {mimeType:"application/json", filename:groupName+".json"});
    }
    return formatted;
};

P.implementService("haplo:integration-message:send", function(details) {
    let group = details.group;
    if(group) {
        let messagesToSend = P.db.messages.select().where("sentDate", "=", null).where("groupName", "=", group);
        let messages = _.map(messagesToSend, (m) => {
            return {
                id: m.id,
                creationDate: m.creationDate,
                data: m.data
            };
        });
        if(details.avoidSendEmpty && messagesToSend.length === 0) { return; }
        let httpClient = O.httpClient();
        O.serviceMaybe("haplo:integration-message:setup-http-request:"+group, httpClient, messages);
        let body = P.formatMessageForBody(group, messages);
        httpClient.body(body.mimeType, body.readAsString("utf-8"));
        if(O.application.config.haplo_integration_messages_enable_on_hostname === O.application.hostname) {
            httpClient.request(SendMessages, {
                group: details.group,
                ids: _.map(messagesToSend, (m) => m.id)
            });
        } else {
            console.log("Integration disabled because hostname doesn't match - has this application been cloned? Ensure haplo_integration_messages_enable_on_hostname in config data is set to this application hostname.");
        }
    }
});

var SendMessages = P.callback("send-integration-messages", function(data, client, response) {
    if(response.successful) {
        let ids = data.ids || [];
        _.each(ids, (id) => {
            let rows = P.db.messages.select().where("id", "=", id).limit(1);
            if(rows.length > 0) {
                let row = rows[0];
                row.sentDate = new Date();
                row.save();
            }
        });
    } else {
        O.service("haplo:integration:error", {
            source: "haplo_integration_messages/"+data.group,
            message: "Integration messages: failed to send to remote endpoint",
            details: "Message IDs: "+(data.ids||[]).join(',')+"\n"+response.errorMessage
        });
    }
});
