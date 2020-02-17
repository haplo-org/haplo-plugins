/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


/*HaploDoc
node: haplo_calendar_access
title: Haplo Calendar Access
--

Handles creation and access to calendar subscription URL/tokens.

Depends on "@haplo_icalendar_support@":/haplo-plugins/haplo_icalendar_support

h3(service). "haplo_calendar_access:get_url_for_user"

Gets the URL for a subscription, creating one if one does not exist

arguments:
* implementation (string): implementation to use, eg, which services to call
* user (securityPrincipal): which user this feed belongs to
* config (object): JSONable data structure that is used to enable/disable/configure \
the feed generation

h3(service). "haplo_calendar_access:generate_new_url_for_user"

Deletes/revokes any existing subscription URLs
Same arguments as @get_url_for_user@ above.

h3. Feed generation

Consuming plugin *MUST* implement the service:

   @"haplo_calendar_access:IMPLEMENTATION_NAME:build"@

which is called in the context of the user who owns the identifier used \
so permissions are restricted to what that user is able to access.

This service is passed the arguments:

* config (object) data structure used to configure the feed generation

and returns an object representing a @Calendar@ spec for @haplo_icalender_support:exporter@

eg: @{title: "Calendar", events:[...]}@

This plugin then handles conversion to ICS and responding.

NOTE: use @O.currentUser@ inside the @:build@ service call to get the user who's subscription this is

*/

P.db.table("calendars", {
    user: { type:"user", indexed:true },
    identifier: { type:"text", indexed:true },
    implementation: { type:"text", indexed:true },
    config: { type:"text", nullable:true },
    created: { type:"date" }
});

var generateNewIdentifier = function(implementation, user, config) {
    var identifier = O.security.random.identifier();
    P.db.calendars.create({
        user: user,
        identifier: identifier,
        implementation: implementation,
        config: config ? JSON.stringify(config) : null,
        created: new Date()
    }).save();
    return identifier;
};

P.implementService("haplo_calendar_access:get_url_for_user", function(implementation, user, config) {
    var identifier;
    var rows = P.db.calendars.select().where("user","=",user).where("implementation","=",implementation);
    if(rows.length) {
        identifier = rows[0].identifier;
    } else {
        identifier = generateNewIdentifier(implementation, user, config);
    }
    return O.application.url+"/do/cal/id/"+identifier;
});

P.implementService("haplo_calendar_access:generate_new_url_for_user", function(implementation, user, config) {
    var rows = P.db.calendars.select().where("user","=",user).where("implementation","=",implementation);
    if(rows.length) {
        rows[0].deleteObject();
    }
    var identifier = generateNewIdentifier(implementation, user, config);
    return O.application.url+"/do/cal/id/"+identifier;
});

P.respond("GET", "/do/cal/id", [
    {pathElement:0, as:"string"}
], function(E, identifier) {
    var row, rows = P.db.calendars.select().where("identifier","=",identifier);
    if(!rows.length) { return (E.response.code = HTTP.NOT_FOUND); } else { row = rows[0]; }
    if(!row.user || !row.user.isActive) { return (E.response.code = HTTP.UNAUTHORIZED); }
    O.impersonating(row.user, function() {
        if(!O.serviceImplemented("haplo_calendar_access:"+row.implementation+":build")) {
            O.stop("Calendar implementation incorrectly defined: "+row.implementation);
        }
        var calspec = O.service("haplo_calendar_access:"+row.implementation+":build", row.config);
        var calendar = O.service("haplo_icalendar_support:exporter", calspec);
        calendar.respondWithDownload(E);
    });
});
