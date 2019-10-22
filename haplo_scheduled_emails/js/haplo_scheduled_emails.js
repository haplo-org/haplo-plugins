/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2019            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */

var emailKinds = {};
var types;

var haveDiscoveredImplementations;
P.ensureDiscoveredImplementations = function() {
    if(haveDiscoveredImplementations) { return; }
    let collectedTypes = [];
    let collectedPanels = [];
    O.serviceMaybe("haplo:scheduled_emails:discover_implementations", {
        scheduledEmail(delegate) {
            emailKinds[delegate.kind] = delegate;
            collectedTypes.push(delegate.objectType);
            collectedPanels.push(delegate.panelName);
        }
    });
    types = _.uniq(collectedTypes);
    let panels = _.uniq(collectedPanels);
    _.each(panels, (panel) => {
        P.implementService("std:action_panel:"+panel, function(display, builder) {
            if(O.application.hostname !== O.application.config["haplo_scheduled_emails:enable_test_in_application"]) {
                return;
            }
            let panel = builder.panel(800);
                panel.link(100,
                    "/do/haplo-scheduled-emails/test-emails/"+display.object.ref.toString(),
                    "Test scheduled emails for object",
                    "terminal");
        });
    });

    haveDiscoveredImplementations = true;
};

P.onLoad = function() {
    P.ensureDiscoveredImplementations();
};

P.respond("GET,POST", "/do/haplo-scheduled-emails/test-emails", [
    {pathElement:0, as:"object", optional:true},
    {parameter:"date", as:"string", validate:/^\d\d\d\d-\d\d-\d\d$/, optional:true}
], function(E, object, date) {
    if(O.application.hostname !== O.application.config["haplo_scheduled_emails:enable_test_in_application"]) { 
        O.stop("Email tests are not enabled in this system");
    }
    P.ensureDiscoveredImplementations();
    let data = [];
    let objects;
    if(object) {
        objects = [object];
    } else {
        objects = [];
        _.each(types, (type) => {
            let results = O.query().link(type, A.Type).execute();
            _.each(results, (result) => {
                objects.push(result);
            });
        });
    }
    _.each(objects, (o) => {
        let objectData = {
            object: o,
            emails: []
        };
        let filteredEmailKinds = _.filter(emailKinds, (kind) => {
            return o.isKindOf(kind.objectType);
        });
        _.each(filteredEmailKinds, (fkind) => {
            let dates = fkind.getDateForObject(o);
            let displayDate, date;
            if(dates && dates.length > 0) {
                dates = _.uniq(dates, (a) => {
                    return a.toString("yyyyMMdd");
                });
                displayDate = _.reduce(dates, (memo, d) => {
                    if(memo) {
                        memo = memo+", ";
                    }
                    return memo+d.toString("dd MMM yyyy");
                }, "");
                date = dates[0].toString("yyyy-MM-dd");
            } else {
                displayDate = "Email will not be sent";
            }
            
            objectData.emails.push({
                displayDate: displayDate,
                date: date,
                displayName: fkind.displayName
            });
        });
        data.push(objectData);
    });
    if(E.request.method === "POST") {
        _.each(objects, (o) => {
            sendEmailsForObject(o, date);
        });
        E.render({
            displayDate: date ? new XDate(date).toString("dd MMM yyyy") : undefined,
            object:object
        }, "sent-test-emails");
    } else {
        E.render({
            object: object,
            data:data
        });
    }
});

P.respond("GET,POST", "/do/haplo-scheduled-emails/test-scheduling", [
], function(E) {
    if(!O.currentUser.isSuperUser) { O.stop("Not permitted."); }
    if(O.application.hostname !== O.application.config["haplo_scheduled_emails:enable_test_in_application"]) { 
        O.stop("Email tests are not enabled in this system");
    }
    if(E.request.method === "POST") {
        O.background.run("haplo_scheduled_emails:send_notifications", {});
    }
    E.render({
        pageTitle: "Test email scheduling",
        text: "Do you want to test all scheduled emails for today?",
        options: [{label: "Confirm"}]
    }, "std:ui:confirm");
});

var sendEmailsForObjectForDate = function(object, kind, today, dateToSend) {
    if(dateToSend.diffDays(today) === 0) {
        let entities = kind.entities(object);
        let spec = kind.getSpecForObject(object, dateToSend);
        O.service("std:workflow_emails:send_email", spec, entities);
    }
};

var sendEmailsForObject = function(object, date) {
    let today = date ? new XDate(date) : new XDate().clearTime();
    let filteredEmailKinds = _.filter(emailKinds, (kind) => {
        return object.isKindOf(kind.objectType);
    });
    _.each(filteredEmailKinds, (fkind) => {
        let datesToSend = fkind.getDateForObject(object);
        if(datesToSend && datesToSend.length > 0) {
            datesToSend = _.uniq(datesToSend, (a) => {
                return a.toString("yyyyMMdd");
            });
            _.each(datesToSend, (d) => {
                sendEmailsForObjectForDate(object, fkind, today, d);
            });
        }
    });
};

P.backgroundCallback("send_notifications", function(data) {
    P.ensureDiscoveredImplementations();
    let objects = [];
    _.each(types, (type) => {
        let results = O.query().link(type, A.Type).execute();
        _.each(results, (result) => {
            objects.push(result);
        });
    });
    _.each(objects, (object) => {
        sendEmailsForObject(object);
    });
});

P.hook("hScheduleDailyEarly", function() {
    O.background.run("haplo_scheduled_emails:send_notifications", {});
});