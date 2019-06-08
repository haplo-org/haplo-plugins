/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2019            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


var CanAdministrateDataImport = O.action("haplo:data-import-framework:can-administrate");

P.implementService("haplo:data-import-framework:admin-ui:add-options", function(options) {
    options.push({
        action: "/do/haplo-data-import-api/admin",
        label: "REST APIs",
        notes: "Define REST APIs for pushing data into this application.",
        indicator: "standard"
    });
});

P.implementService("haplo:data-import-framework:admin-ui:add-documentation-links", function(options) {
    options.push({
        action: "https://docs.haplo.org/import/rest-api",
        label: "REST APIs",
        notes: "Documentation for implementing REST APIs for pushing data into this application.",
        indicator: "standard"
    });
});

// --------------------------------------------------------------------------

P.globalFormsCustomValidationFunction("haplo:data-import-api:url-not-in-use",
    function(value, data, context, document, externalData) {
        if(P.db.api.select().where("url","=",value).count()) {
            return "URL is already in use.";
        }
    }
);

// --------------------------------------------------------------------------

P.respond("GET", "/do/haplo-data-import-api/admin", [
], function(E) {
    CanAdministrateDataImport.enforce();
    let apis = P.db.api.select().order("url");
    E.render({
        apis: apis
    });
});

// --------------------------------------------------------------------------

var ApiForm = P.form("rest-api", "form/rest-api.json");

P.respond("GET,POST", "/do/haplo-data-import-api/new-api", [
], function(E) {
    CanAdministrateDataImport.enforce();
    let document = {},
        form = ApiForm.handle(document, E.request);
    if(form.complete) {
        document.control = JSON.parse(document.controlJSON);
        let api = P.db.api.create(document);
        api.save();
        O.audit.write({
            auditEntryType: "haplo_data_import_api:create",
            data: {
                url: api.url,
                enabled: api.enabled
            }
        });
        return E.response.redirect("/do/haplo-data-import-api/api/"+api.id);
    }
    E.render({form:form});
});

// --------------------------------------------------------------------------

P.respond("GET", "/do/haplo-data-import-api/api", [
    {pathElement:0, as:"db", table:"api"}
], function(E, api) {
    CanAdministrateDataImport.enforce();
    E.render({
        api: api,
        urlBase: O.application.url,
        control: JSON.stringify(api.control, undefined, 4)
    });
});

// --------------------------------------------------------------------------

P.respond("GET,POST", "/do/haplo-data-import-api/edit-api", [
    {pathElement:0, as:"db", table:"api"}
], function(E, api) {
    CanAdministrateDataImport.enforce();
    api.controlJSON = JSON.stringify(api.control, undefined, 4);
    let form = ApiForm.instance(api);
    form.externalData({editing:true});
    form.update(E.request);
    if(form.complete) {
        api.control = JSON.parse(api.controlJSON);
        api.save();
        O.audit.write({
            auditEntryType: "haplo_data_import_api:update",
            data: {
                url: api.url,
                enabled: api.enabled
            }
        });
        return E.response.redirect("/do/haplo-data-import-api/api/"+api.id);
    }
    E.render({
        api: api,
        form: form
    });
});

// --------------------------------------------------------------------------

P.respond("GET,POST", "/do/haplo-data-import-api/create-api-key", [
    {pathElement:0, as:"db", table:"api"}
], function(E, api) {
    CanAdministrateDataImport.enforce();
    if(E.request.method === "POST") {
        return E.render({
            api: api,
            key: O.serviceUser("haplo:service-user:data-import-api:access").
                    createAPIKey(
                        "REST API: "+api.description,
                        "=/api/push-data/"+api.url // = prefix for exact matching
                    )
        });
    }
    E.render({
        api: api,
        text: "Create new API key for "+api.description+"?",
        options: [{label:"Create API key"}]
    });
});
