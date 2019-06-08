/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2019            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


var CanUseAPI = O.action("haplo:data-import-batch:can-use-api").
    title("Can use REST APIs for data push").
    allow("group", Group.RESTAPIImport);

// --------------------------------------------------------------------------

P.db.table("api", {
    "url": {type:"text", indexed:true, uniqueIndex:true},
    "description": {type:"text"},
    "control": {type:"json"},
    "enabled": {type:"boolean"},
    "response": {type:"text"}
});

// --------------------------------------------------------------------------

// Let plugins define APIs which are automatically created on install, which the user can then edit later
P.onInstall = function() {
    if(O.serviceImplemented("haplo:data-import-api:discover-defaults")) {
        let defined = {};
        _.each(P.db.api.select(), (api) => defined[api.url] = true);
        O.service("haplo:data-import-api:discover-defaults", function(plugin, name) {
            if(!(name in defined)) {
                var defn = JSON.parse(plugin.loadFile("rest-api-"+name+".json").readAsString("utf-8"));
                if(defn.url !== name) {
                    throw new Error("Name in API definition doesn't match "+name);
                }
                P.db.api.create(defn).save();
                O.audit.write({
                    auditEntryType: "haplo_data_import_api:plugin_create",
                    data: {
                        plugin: plugin.pluginName,
                        url: defn.url,
                        enabled: defn.enabled
                    }
                });
            }
        });
    }
};

// --------------------------------------------------------------------------

P.respond("GET", "/api/push-data", [
    {pathElement:0, as:"string"}
], function(E) {
    E.response.kind = 'json';
    E.response.body = JSON.stringify({
        result: "error",
        applied: 0,
        failures: 0,
        errorCount: 1,
        errors: ["Only POST requests supported for push data REST APIs."]
    }, undefined, 4);
    E.response.statusCode = HTTP.BAD_REQUEST;
});

P.respond("POST", "/api/push-data", [
    {pathElement:0, as:"string"}
], function(E, url) {
    let apiQ = P.db.api.select().where("url","=",url);

    let result = 'success',
        errors = [],
        appliedCount = 0,
        failureCount = 0,
        errorCount = 0,
        responseFormat = 'JSON';

    if(apiQ.length === 0) {
        errors.push("API not defined: "+url);
        result = 'error';
        errorCount = 1;

    } else if(!O.currentUser.allowed(CanUseAPI)) {
        result = 'not authorised';
        errorCount = 1;

    } else {
        let api = apiQ[0];
        responseFormat = api.response;

        if(!api.enabled) {
            errors.push("API is disabled: "+url);
            result = 'error';
            errorCount = 1;

        } else {
            let errorCallback = (message, record) => {
                errors.push(message);
            };

            let files = {
                body: O.binaryData(E.request.body)
            };

            try {
                // Permit all object store changes
                O.withoutPermissionEnforcement(function() {
                    let batch = O.service("haplo:data-import-framework:batch", api.control, files, errorCallback);
                    batch.eachRecord((record) => {
                        let transformation = batch.transform(record);
                        if(transformation.isComplete) {
                            transformation.commit();
                            appliedCount++;
                        } else {
                            failureCount++;
                            result = 'failure';
                        }
                    });
                    errorCount = batch.errorCount;
                });

            } catch(e) {
                errors.push("Exception when processing: "+e.message);
                result = 'error';
                console.log("EXCEPTION: Error during data import REST API: "+e.message+". File: "+e.fileName+", line: "+e.lineNumber);
            }
        }
    }

    let response = {
        result: result,
        applied: appliedCount,
        failures: failureCount,
        errorCount: errorCount,
        errors: errors
    };

    if(responseFormat === 'JSON') {
        E.response.kind = 'json';
        E.response.body = JSON.stringify(response, undefined, 4);

    } else {
        let xml = O.xml.document();
        let cursor = xml.cursor().
            cursorWithControlCharacterPolicy("remove").
            element("response");
        _.each(response, (value, key) => {
            if(key === "errors") {
                cursor.element("errors");
                value.forEach((e) => {
                    cursor.element("error").text(""+e).up();
                });
                cursor.up();
            } else {
                cursor.attribute(key, ""+value);
            }
        });
        E.response.body = xml;
    }

    if(result !== 'success') {
        E.response.statusCode = (result === "not authorised") ? HTTP.UNAUTHORIZED : HTTP.BAD_REQUEST;
    }
});

