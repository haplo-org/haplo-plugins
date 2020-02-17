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
