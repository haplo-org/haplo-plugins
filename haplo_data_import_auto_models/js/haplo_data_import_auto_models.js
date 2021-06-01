/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2021            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


var CanAdministrateDataImport = O.action("haplo:data-import-framework:can-administrate");

// Add UI to data models page
P.implementService("haplo:data-import-framework:admin-ui:model-information:extra-ui", function(extraUI) {
    extraUI.push(P.template("model-page").deferredRender());
});

// Admin selection of available models based on types in the schema
P.respond("GET,POST", "/do/haplo-data-import-auto-models/select", [
], function(E) {
    CanAdministrateDataImport.enforce();

    if(E.request.method === "POST") {
        let selectedTypes = [];
        _.each(E.request.parameters.type||[], (v,r) => {
            let typeInfo = SCHEMA.getTypeInfo(O.ref(r));
            if(typeInfo) {
                selectedTypes.push(typeInfo.code);
            }
        });
        P.data.selectedTypes = selectedTypes;
        O.service("__internal__:haplo:data-import-framework:invalidate-available-models");
        return E.response.redirect("/do/haplo-data-import/models");
    }

    let selectedTypes = P.data.selectedTypes || [];
    let rootTypes = [];
    for(let code in TYPE) {
        let typeRef = TYPE[code];
        let typeInfo = SCHEMA.getTypeInfo(typeRef);
        if(typeInfo && !typeInfo.parentType) {
            rootTypes.push({
                code: code,
                name: typeInfo.name,
                ref: typeRef,
                selected: -1 !== selectedTypes.indexOf(code)
            });
        }
    }
    rootTypes = _.sortBy(rootTypes, "name");
    E.render({
        rootTypes: rootTypes
    });
});

// Use an internal data import framework service to add models without using the service registry
P.implementService("__internal__:haplo:data-import-framework:discover-generated-data-models", function(model) {
    _.each(P.data.selectedTypes || [], function(code) {
        if(code in TYPE) {
            let typeInfo = SCHEMA.getTypeInfo(TYPE[code]);
            if(typeInfo) {
                model(
                    "TYPE:"+code,
                    "haplo:data-import-framework:auto-models:type",
                    {
                        name: "TYPE:"+code,
                        title: typeInfo.name,
                        description: "Objects of type "+typeInfo.name
                    }
                );
            }
        }
    });
});

// Service which sets up a simple model for any type implied by the model name
P.implementService("haplo:data-import-framework:auto-models:type", function(model) {
    let code = model.name.replace(/^TYPE\:/,'');
    if(!(code in TYPE)) { throw new Error("Unexpected type: "+code); }
    let typeInfo = SCHEMA.getTypeInfo(TYPE[code]);
    if(!typeInfo) { return; }
    model.addDestination({
        name: "object",
        title: typeInfo.name,
        displaySort: 1,
        kind: "object",
        objectType: TYPE[code]
    });
});
