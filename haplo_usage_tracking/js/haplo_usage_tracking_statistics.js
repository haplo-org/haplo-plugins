/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2019            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */

var TableDelegates = P.TableDelegates = {};

P.provideFeature("haplo:usage_tracking_statistics", function(plugin) {
    plugin.registerTable = function(delegate) {
        TableDelegates[delegate.name] = delegate;

        P.db.table(delegate.name, _.extend({
            outputRef: { type:"ref" },
            year: { type:"int" },
            month: { type:"int" }, //Uses javascript dates' 0 indexing of months
            day: { type:"int" },
            country: { type:"text", nullable:true},
            views: { type:"int"},
            downloads: { type:"int"}
        }, delegate.columns));
    };
});

var updateQueryWithDate = function(query, date){
    return query.where("year", "=", date.getFullYear()).
                    where("month", "=", date.getMonth()).
                    where("day", "=", date.getDate());
};

var updateQueryWithKey = function(query, key) {
    _.each(key, (v, k) => {
        query.where(k, "=", v);
    });
};

var updateRow = function(row, kind) {
    //event.kind: 0 is view, 1 is download
    if(kind == 1) {
        row.downloads += 1;
    } else {
        row.views += 1;
    }
    row.save(); 
};

var updateTotals = function(event, object, delegate) {
    let date = new XDate(event.datetime);
    _.each(delegate.findRowsToUpdate(object), (key) => {
        let query = P.db[delegate.name].select().where("outputRef", "=", event.object).where("country", "=", event.country).limit(1);
        updateQueryWithDate(query, date);
        updateQueryWithKey(query, key);
        let row;
        if(query.length) {
            row = query[0];
        } else {
            let rowToBeCreated = _.extend({
                outputRef: event.object,
                year: date.getFullYear(),
                month: date.getMonth(),
                day: date.getDate(),
                country: event.country,
                views: 0,
                downloads: 0
            }, key);
            row = P.db[delegate.name].create(rowToBeCreated);
        }
        updateRow(row, event.kind);
    });
};

var updateDatabaseWithEvent = P.updateDatabaseWithEvent = function(event) {
    if(!event.object || event.classification === 1 || event.classification === 2) { return; }
    let object = O.withoutPermissionEnforcement(() => { return event.object.load(); });
    _.each(TableDelegates, (delegate) => {
        if("filter" in delegate && delegate.filter(object)) {
            updateTotals(event, object, delegate);
        }
    });
};

P.implementService("haplo_usage_tracking:notify:event", updateDatabaseWithEvent);

P.implementService("haplo:usage_tracking:query_database", function(querySpec) {
    let query = P.db[querySpec.table].select();
    updateQueryWithKey(query, querySpec.key);
    return query;
});

//TODO: Code below is for migration - remove once run
P.respond("GET,POST", "/do/haplo-usage-tracking/migrate-usage-stats-to-summary-tables", [
], function(E) {
    if(!O.currentUser.isMemberOf(GROUP["std:group:administrators"])) { O.stop("Not permitted."); }
    if(E.request.method === "POST") {
        O.background.run("haplo_usage_tracking:populate_summary_tables", {});
        P.data.status = "running";
        E.response.redirect("/do/haplo-usage-tracking/migration-status");
    }
    E.render({
        pageTitle: "Migrate usage tracking database to new summary tables?",
        text: "Would you like to perform the migration",
        options: [{label:"Confirm"}]
    }, "std:ui:confirm");
});

P.respond("GET", "/do/haplo-usage-tracking/migration-status",[
], function(E) {
    if(!O.currentUser.isMemberOf(GROUP["std:group:administrators"])) { O.stop("Not permitted."); }
    let message;
    switch(P.data.status) {
        case "running":
            message = "Migration is currently running";
            break;
        case "done":
            message = "Migration has been completed successfully with "+P.data.eventCount+" events migrated to statistics tables, "+P.data.botCount+" robot events not counted, and "+P.data.duplicateCount+" duplicates not counted";
            break;
        case "failed":
            message = "Migration failed with the error message: "+P.data.error.message+", file: "+P.data.error.fileName+", line: "+P.data.error.lineNumber;
            break;
        default:
            message = "No migration has yet been run. To run the migration, go to: /do/haplo-usage-tracking/migrate-usage-stats-to-summary-tables";
    }
    E.render({
        pageTitle: "Usage tracking statistics migration status",
        backLink: "/",
        message: message
    }, "std:ui:notice");
});


P.backgroundCallback("populate_summary_tables", function(data) {
    try {
        let earliestEvent = P.db.events.select().order('datetime').limit(1);
        let latestEvent = P.db.events.select().order('datetime', true).limit(1);
        if(earliestEvent.length && latestEvent.length) {
            let earliestDate = new XDate(earliestEvent[0].datetime).clearTime();
            let latestDate = new XDate(latestEvent[0].datetime);
            let endOfPeriod =  earliestDate.clone().addDays(1);
            let eventCount = 0;
            let botCount = 0;
            let duplicateCount = 0;
            let safety = 400;
            while(endOfPeriod.diffDays(latestDate) > 0 && safety-- > 0) {
                let events = P.db.events.select().where('datetime', '>', earliestDate).where('datetime', '<', endOfPeriod);
                _.each(events, (ev) => {
                    let isRobot = P.userAgentIsRobot(ev.userAgent);
                    let isDuplicate = P.requestIsDuplicate(ev.userAgent, ev.object, ev.kind, ev.datetime);
                    if(!isRobot && !isDuplicate) {
                        eventCount++;
                        P.updateDatabaseWithEvent(ev);
                    } else {
                        ev.classification = isRobot ? P.CLASSIFICATION_ENUM['robot'] : P.CLASSIFICATION_ENUM['duplicate'];
                        ev.save();
                        if(ev.classification === 1) {
                            botCount++;
                        } else {
                            duplicateCount++;
                        }
                    }
                });
                endOfPeriod.addDays(1);
                earliestDate.addDays(1);
            }
            P.data.botCount = botCount;
            P.data.eventCount = eventCount;
            P.data.duplicateCount = duplicateCount;
            P.data.status = "done";
        }
    } catch(e) {
        P.data.status = "failed";
        P.data.error = e;
    }
});
