/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2019            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


var CanUsePollAPI = O.action("haplo:integration-message-queue:can-use-poll-api").
    title("Can use Integration Message Queue Poll API").
    allow("group", Group.MessageQueuePollAPI);

P.respond("GET,POST", "/api/haplo-integration-messages/poll", [
    {pathElement:0, as:"string"},
    {pathElement:1, as:"string", validate:(e) => (e === "fetch" || e === "mark")}
], function(E, groupName, action) {
    CanUsePollAPI.enforce();
    let group = P.getCheckedGroupInfo(groupName);
    if(group.method !== "poll") { O.stop("Not a poll message queue"); }

    if(action === "mark") {
        // Mark messages as read
        let marked = 0;
        let ids = O.base64.decode(E.request.parameters.token || '').
            readAsString().
            split(',').
            map((i) => parseInt(i,10));
        ids.forEach((id) => {
            let q = P.db.messages.select().
                where("groupName","=",groupName).
                where("sentDate","=",null).
                where("id","=",id);
            if(q.length) {
                let m = q[0];
                m.sentDate = new Date();
                m.save();
                marked++;
            }
        });
        E.response.kind = 'text';
        E.response.body = 'Marked: '+marked;

    } else {
        // Send all outstanding messages
        let messagesToSend = P.db.messages.select().where("sentDate", "=", null).where("groupName", "=", groupName).order("id");
        let messages = _.map(messagesToSend, (m) => {
            return {
                id: m.id,
                creationDate: m.creationDate,
                data: m.data
            };
        });
        E.response.body = P.formatMessageForBody(groupName, messages);
    }

});
