/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2020            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


P.apiAllowedAction(
    O.action("haplo:action:api-v0:object-api").
        title("Use API v0 Object").
        allow("group", Group.ObjectAPI)
);

// --------------------------------------------------------------------------

const PAGE_SIZE_REFS = 256;
const PAGE_SIZE_OBJECTS = 24;

// --------------------------------------------------------------------------

P.respondToAPI("GET", "/api/v0-object/ref", [
    {pathElement:0, as:"ref"}
], function(api, ref) {
    O.withoutPermissionEnforcement(() => {
        withObject(api, ref, (object) => {
            withSerialiser(api, (serialiser) => {
                api.respondWith("object", serialiser.encode(object));
                api.success("haplo:api-v0:object:serialised");
            });
        });
    });
});

P.respondToAPI("GET", "/api/v0-object/linked", [
    {pathElement:0, as:"ref"},
    {parameter:"type", as:"string", optional:true},
    {parameter:"attribute", as:"string", optional:true},
    {parameter:"qualifier", as:"string", optional:true}
], function(api, ref, type, attribute, qualifier) {
    O.withoutPermissionEnforcement(() => {
        let desc, qual;
        if(attribute) {
            if(attribute in ATTR) { desc = ATTR[attribute]; }
            else { return api.error("haplo:api-v0:object:bad-query", "Unknown attribute: "+attribute); }
        }
        if(qualifier) {
            if(qualifier in QUAL) { qual = QUAL[qualifier]; }
            else { return api.error("haplo:api-v0:object:bad-query", "Unknown qualifier: "+qualifier); }
        }
        let query = O.query().link(ref, desc, qual);
        if(type) {
            if(type in TYPE) { query.link(TYPE[type], ATTR.Type); }
            else { return api.error("haplo:api-v0:object:bad-query", "Unknown type: "+type); }
        }
        respondWithQuery(api, query);
    });
});

// --------------------------------------------------------------------------

var withObject = function(api, ref, fn) {
    let object = ref.load();
    if(!object) {
        return api.error("haplo:api-v0:object:no-such-object", "Object "+ref+" does not exist");
    }
    fn(object);
};

var configuredSerialiser = function(api) {
    if(!(api.E.request.parameters.sources)) {
        api.error("haplo:api-v0:object:sources-not-specified", "Sources must be specified as parameter. Use ?sources=NONE for basic object serialisation, ?sources=ALL for everything (discouraged), or ?sources=source1,source2,... to specify exact sources required.");
        return;
    }
    return O.service("std:serialisation:serialiser").
        configureFromParameters(api.E.request.parameters);
};

var withSerialiser = function(api, fn) {
    let serialiser = configuredSerialiser(api);
    if(!serialiser) { return; }
    fn(serialiser);
};

// parameters:
// results=objects/refs (default refs)
// start=<index> (start index)
var respondWithQuery = function(api, query) {
    let parameters = api.E.request.parameters;
    let results = query.setSparseResults(true).execute();

    // Generate results in requested format
    let property, valueForIndex, serialiser,
        pageSize = PAGE_SIZE_REFS;
    if("results" in parameters) {
        if(parameters.results === "objects") {
            let serialiser = configuredSerialiser(api);
            if(!serialiser) { return; } // it will have called api.error()
            property = "objects";
            valueForIndex = (index) => serialiser.encode(results[index]);
            pageSize = PAGE_SIZE_OBJECTS;
        } else {
            if(parameters.results !== "refs") {
                return api.error("haplo:api-v0:object:bad-query", "Unknown results option: "+parameters.results);
            }
        }
    }
    if(!property) {
        property = "refs";
        // Use efficient API to get ref at index, without actually loading the object
        valueForIndex = (index) => results.refAtIndex(index).toString();
    }

    // Determine paging (after looking at results type, as this sets page size)
    let start = 0;
    let end = results.length;
    if("start" in parameters) {
        start = parseInt(parameters.start, 10);
        if(isNaN(start)) {
            return api.error("haplo:api-v0:object:bad-query", "start is not a number");
        }
        if(start >= end) {
            return api.error("haplo:api-v0:object:bad-query", "Requested start after end of results, count="+results.length);
        }
    }
    if(end > start + pageSize) {
        end = start + pageSize;
    }

    // Request the object store load the page efficiently if the object is serialised
    if(property === "objects") {
        results.ensureRangeLoaded(start, end);
    }

    // Generate requested items
    let items = [];
    for(let i = start; i < end; ++i) {
        items.push(valueForIndex(i));
    }

    api.respondWith("results", {
        count: results.length,
        start: start,
        end: end,
        more: end < results.length
    });
    api.respondWith(property, items);
    api.success("haplo:api-v0:object:store-query-results");
};
