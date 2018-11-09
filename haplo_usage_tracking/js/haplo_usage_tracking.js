/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2018            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


P.db.table('events', {
    datetime: { type:'datetime' },
    userAgent: { type:'text', nullable:true  },
    referrer: { type:'text', nullable:true },
    remoteProtocol: { type:'smallint' },
    remoteAddress: { type:'text' },
    classification: { type:'smallint' },     // 'spam'? 'doubleclick'? 'robot'?
    continent: { type: 'text', nullable:true },
    country: { type: 'text', nullable:true },
    institution: { type: 'text', nullable:true }, // Reverse DNS lookup for requester organisation information
    kind: { type:'smallint' },     // 'view', 'download'
    user: { type:'int' },
    publication: { type:'text', nullable:true },    // null => internal
    object: { type:'ref', nullable:true },
    file: { type:'text', nullable:true } // digest
});

// --------------------------------------------------------------------------
// Adding events

var KIND_ENUM = {
    'view': 0,
    'download': 1
};
var CLASSIFICATION_ENUM = {
    'default': 0
};
var PROTOCOL_ENUM = {
    'IPv4': 0
};

var addEvent = function(request, kind, publication, obj, file) {
    if(!(obj || file)) {
        // Maybe overkill? Some other kind of identifier (eg. URL)?
        throw new Error("No object or file available for usage tracking");
    }
    let object;
    if(obj) { object = O.isRef(obj) ? obj : obj.ref; }
    let location = O.service("haplo:info:geoip:lookup", request.remote.protocol, request.remote.address);
    let e = P.db.events.create({
        datetime: new Date(),
        userAgent: request.headers["User-Agent"] ? request.headers["User-Agent"][0] : null,
        referrer: request.headers["Referer"] ? request.headers["Referer"][0] : null,
        remoteProtocol: PROTOCOL_ENUM[request.remote.protocol],
        remoteAddress: request.remote.address,
        // TODO: Different event classifications
        classification: CLASSIFICATION_ENUM['default'],
        continent: location.continent || null,
        country: location.country || null,
        // TODO: Add reverse DNS lookup institution when platform interface is available
        institution: null,
        kind: KIND_ENUM[kind],
        user: O.currentUser.id,
        publication: publication ? publication.name : null,
        object: object || null,
        file: file ? file.digest : null
    }).save();
    try {
        O.serviceMaybe("haplo_usage_tracking:notify:event", e);
    } catch(e) {
        O.reportHealthEvent("Exception thrown when notifying plugins of usage event.");
    }
};
P.hook('hPreFileDownload', function(response, file, transform, permittingRef, isThumbnail, isWebPublisher, request) {
    if(isWebPublisher) { return; }  // Will be counted by publication download service below
    addEvent(request, 'download', undefined, permittingRef, file);
});
P.implementService("std:web-publisher:observe:request", function(publication, E, context) {
    if(context.object) {
        addEvent(E.request, 'view', publication, context.object);
    }
});
P.implementService("std:web-publisher:observe:file-download", function(publication, file, request, permittingRef) {
    addEvent(request, 'download', publication, permittingRef, file);
});

// --------------------------------------------------------------------------
// Querying events

P.implementService("haplo_usage_tracking:query_events", function(specification) {
    let select = P.db.events.select().
        order('datetime', true);
    // TODO: Build query from spec and return
});
