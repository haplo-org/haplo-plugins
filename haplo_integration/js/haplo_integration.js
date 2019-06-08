/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2019            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


var CanAdministrateIntegrations = O.action("haplo:integration:can-administrate").
    title("Can administrate integrations").
    allow("group", GROUP["std:group:administrators"]);

// --------------------------------------------------------------------------

P.db.table("error", {
    datetime: {type:"datetime"},
    source: {type:"text"},
    message: {type:"text"},
    details: {type:"text"},
    acknowledged: {type:"datetime", nullable:true, indexed:true},
    acknowledgedBy: {type:"user", nullable:true}
});

P.implementService("haplo:integration:error", function(error) {
    let row = P.db.error.create({
        datetime: new Date(),
        source: error.source || 'unknown',
        message: error.message || 'error',
        details: error.details || null
    });
    row.save();
});

// --------------------------------------------------------------------------

P.hook('hGetReportsList', function(response) {
    if(O.currentUser.allowed(CanAdministrateIntegrations)) {
        response.reports.push(["/do/haplo-integration/admin", "Integrations"]);
    }
});

P.respond("GET", "/do/haplo-integration/admin", [
], function(E) {
    CanAdministrateIntegrations.enforce();
    let errorOption = {
        action: "/do/haplo-integration/errors",
        label: "Errors from integrations",
        notes: "View errors from integrations and acknowledge to remove from the current error count.",
        indicator: "standard"
    };
    let unacknowledgedErrorCount = P.db.error.select().where("acknowledged","=",null).count();
    if(unacknowledgedErrorCount) {
        errorOption.label += ": "+unacknowledgedErrorCount;
        errorOption.indicator = "terminal";
    }
    let options = [errorOption];
    O.serviceMaybe("haplo:integration:admin-ui:add-options", options);
    E.render({
        options: options
    });
});

P.respond("GET", "/do/haplo-integration/errors", [
    {parameter:"last", as:"int", optional:true}
], function(E, lastDisplayId) {
    CanAdministrateIntegrations.enforce();
    let currentErrors = P.db.error.select().where("acknowledged","=",null).order("id",true);
    let oldErrors = P.db.error.select().where("acknowledged","<>",null).order("id",true).limit(10);
    if(lastDisplayId) { oldErrors.where("id","<",lastDisplayId); }
    E.render({
        currentErrors: currentErrors,
        oldErrors: oldErrors,
        lastDisplayId: (oldErrors.length > 0) ? (oldErrors[oldErrors.length - 1].id) : 0
    });
});

P.respond("GET", "/do/haplo-integration/error", [
    {pathElement:0, as:"db", table:"error"}
], function(E, error) {
    CanAdministrateIntegrations.enforce();
    E.render({
        error: error
    });
});

P.respond("POST", "/do/haplo-integration/error-acknowledge", [
    {pathElement:0, as:"db", table:"error"}
], function(E, error) {
    CanAdministrateIntegrations.enforce();
    if(!error.acknowledged) {
        error.acknowledged = new Date();
        error.acknowledgedBy = O.currentUser;
        error.save();
    }
    E.response.redirect("/do/haplo-integration/error/"+error.id);
});
