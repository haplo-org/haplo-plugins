/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2019            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


const MAX_GENERATE_MAPPING_OBJECTS = 256;

// --------------------------------------------------------------------------

var CanAdministrateDataImport = O.action("haplo:data-import-framework:can-administrate").
    title("Can administrate data import").
    allow("group", Group.BatchDataAdmin).
    allow("group", Group.Administrators);

P.hook('hGetReportsList', function(response) {
    if(O.currentUser.allowed(CanAdministrateDataImport)) {
        response.reports.push(["/do/haplo-data-import/admin", "Data import"]);
    }
});

P.globalTemplateFunction("haplo:data-import-framework:documentation", function(path, text) {
    this.render(P.template("misc/documentation-link").deferredRender({
        href: path.startsWith("http") ? path : "https://docs.haplo.org"+path,
        text: text
    }));
});

// --------------------------------------------------------------------------

P.respond("GET", "/do/haplo-data-import/admin", [
], function(E) {
    CanAdministrateDataImport.enforce();
    let options = [
        {
            action: "/do/haplo-data-import/models",
            label: "Models",
            notes: "Explore import data models and generate object mappings.",
            indicator: "standard"
        },
        {
            action: "/do/haplo-data-import/filters",
            label: "Value filters",
            notes: "List available value filters for use in control files.",
            indicator: "standard"
        }
    ];
    O.serviceMaybe("haplo:data-import-framework:admin-ui:add-options", options);
    options.push({
        action: "/do/haplo-data-import/documentation",
        label: "Documentation",
        notes: "Links to documentation for the specific functionality installed in this application.",
        indicator: "standard"
    });
    E.renderIntoSidebar({}, "admin-sidebar");
    E.render({
        options: options
    });
});

// --------------------------------------------------------------------------

P.respond("GET", "/do/haplo-data-import/documentation", [
], function(E) {
    CanAdministrateDataImport.enforce();
    let options = [
        {
            action: "https://docs.haplo.org/import",
            label: "Data import framework",
            notes: "Documentation for the generic data import framework.",
            indicator: "standard"
        }
    ];
    O.serviceMaybe("haplo:data-import-framework:admin-ui:add-documentation-links", options);
    E.render({
        options: options
    });
});

// --------------------------------------------------------------------------

P.respond("GET", "/do/haplo-data-import/models", [
], function(E) {
    CanAdministrateDataImport.enforce();
    let options = [];
    _.each(P.getAvailableModels(), (info,modelName) => {
        options.push({
            action: "/do/haplo-data-import/model?model="+encodeURIComponent(modelName),
            label: modelName+" ("+info.properties.title+")",
            notes: info.properties.description,
            indicator: "standard"
        });
    });
    E.render({
        options: options
    });
});

P.respond("GET", "/do/haplo-data-import/model", [
    {parameter:"model", as:"string"}
], function(E, modelName) {
    CanAdministrateDataImport.enforce();
    let model = O.service("haplo:data-import-framework:model", modelName);
    // Collect deferred renders for additional information section
    let additionalInformation = [];
    O.serviceMaybe("haplo:data-import-framework:admin-ui:model-information:additional:"+modelName,
        additionalInformation);
    E.render({
        model: model,
        destinations: _.sortBy(model.destinations, '_displaySortValue'),
        additionalInformation: additionalInformation
    });
});

P.respond("GET,POST", "/do/haplo-data-import/generate-control-file", [
    {parameter:"model", as:"string"},
], function(E, modelName) {
    CanAdministrateDataImport.enforce();
    let model = O.service("haplo:data-import-framework:model", modelName),
        destinations = _.filter(_.sortBy(model.destinations, '_displaySortValue'), (d) => !d.delegate.excludeFromGenerator),
        isUserSync = (modelName === "haplo:user-sync"),
        control;
    if(E.request.method === "POST") {
        let include = {};
        let multivalue = {};
        _.each(E.request.parameters, (value,key) => {
            let [action, destAndName] = key.split('`');
            if(destAndName) {
                ((action === 'in') ? include : multivalue)[destAndName] = true;
            }
        });

        let instructions = [],
            mapping = {},
            destinationMadeAvailable = {};

        // Pragmatically add sensible load instructions for haplo:person + user sync
        if(modelName === "haplo:person") {
            instructions.push({
                "source": "TODO-USERNAME",
                "destination": "load:by-ref",
                "name": "ref",
                "filters": ["haplo:username-to-ref"]
            });
            instructions.push({
                "action": "load",
                "destination": "profile",
                "using": "load:by-ref"
            });
            destinationMadeAvailable['profile'] = true;
        }

        _.each(destinations, (destination) => {
            _.each(destination._namesList, (name) => {
                let destAndName = destination.destinationName + "^" + name.name;
                if(include[destAndName]) {
                    if(!destinationMadeAvailable[destination.destinationName]) {
                        if(!(isUserSync || destination._depends)) {
                            // Non-user sync models need things to be newed or loaded
                            instructions.push({
                                "action": "new",
                                "destination": destination.destinationName
                            });
                        }
                        destinationMadeAvailable[destination.destinationName] = true;
                    }
                    let source = ("TODO-"+_.last(name.name.split(':')).toUpperCase()).replace(/[^A-Z0-9]+/,'-');
                    let inst = {
                        "source": source,
                        "destination": destination.destinationName,
                        "name": name.name
                    };
                    switch(name.properties.type) {
                        case "ref":
                            let [typeInfo, tooManyObjects, usingCodes, mappingName, instMapping] = generateMapping(name);
                            if(instMapping) {
                                inst.refMapping = mappingName;
                                mapping[mappingName] = instMapping;
                            } else {
                                inst.refMapping = "TODO-DEFINE-MAPPING";
                            }
                            break;
                        case "object-type":
                            inst.mapInputValue = {"TODO-N1":"TODO-type:code"};
                            inst.mapInputValueDefault = "TODO-default-type:code";
                            break;
                        case "telephone-number":
                            inst.country = "GB";
                            break;
                        case "datetime":
                            inst.dateFormat = "yyyy-MM-dd";
                            break;
                        case "url":
                            inst.filters = ["haplo:fix-up-url"];
                            break;
                        case "person-name":
                            inst = instructionsForStructured(inst, instructions, "person-name", ["title", "first", "middle", "last", "suffix"]);
                            break;
                        case "postal-address":
                            inst = instructionsForStructured(inst, instructions, "postal-address", ["street1", "street2", "city", "county", "postcode", "country"]);
                            break;
                    }
                    if(name.properties.multivalue && multivalue[destAndName]) {
                        inst.multivalue = true;
                        instructions.push({
                            "action": "remove-values",
                            "destination": destination.destinationName,
                            "name": name.name
                        });
                    }
                    instructions.push(inst);
                }
            });
        });

        control = {
            "dataImportControlFileVersion": 0,
            "model": modelName,
            "files": {},
            "instructions": instructions
        };
        control.files[isUserSync ? 'TODO' : 'DEFAULT'] = { "read":"json" };
        if(!_.isEmpty(mapping)) { control.mapping = mapping; }
    }
    E.render({
        model: model,
        destinations: destinations,
        isUserSync: isUserSync,
        control: control ? JSON.stringify(control, undefined, 4) : undefined
    });
});

var instructionsForStructured = function(inst, instructions, type, fields) {
    fields.forEach((f) => {
        instructions.push({
            "source": inst.source+"-"+f.toUpperCase(),
            "destination": "value:"+type,
            "name": f
        });
    });
    return {
        "action": "field-structured",
        "structured": "value:"+type,
        "destination": inst.destination,
        "name": inst.name
    };
};

P.respond("GET", "/do/haplo-data-import/generate-ref-mapping", [
    {parameter:"model", as:"string"},
    {parameter:"destination", as:"string"},
    {parameter:"name", as:"string"}
], function(E, modelName, destinationName, nameName) {
    CanAdministrateDataImport.enforce();
    let model = O.service("haplo:data-import-framework:model", modelName);
    let destination = model.destination(destinationName);
    let name = destination.name(nameName);
    if(name.properties.type !== "ref") { O.stop("Not a ref name"); }
    if(!name.properties.refTypes) { O.stop("No types"); }

    let [typeInfo, tooManyObjects, usingCodes, mappingName, mapping] = generateMapping(name);

    let control = {
        instructions: [
            {
                source: "TODO-INPUT",
                destination: destinationName,
                name: nameName,
                refMapping: mappingName
            }
        ],
        mapping: {
        }
    };

    if(mapping) {
        control.mapping[mappingName] = mapping;
    }

    E.render({
        model: model,
        destination: destination,
        name: name,
        typeInfo: typeInfo,
        tooManyObjects: tooManyObjects,
        usingCodes: usingCodes,
        control: JSON.stringify(control, undefined, 4)
    });
});

var generateMapping = function(name) {

    let typeInfo = name.properties.refTypes.map((t) => SCHEMA.getTypeInfo(t) );

    let mappingName = typeInfo.map((i) => i.name).join('-').toLowerCase().replace(/[^a-z0-9]/g,'-');

    let objects = O.query().
        link(name.properties.refTypes, ATTR.Type).
        limit(MAX_GENERATE_MAPPING_OBJECTS+1).
        sortByTitle().
        execute();
    let tooManyObjects = objects.length > MAX_GENERATE_MAPPING_OBJECTS;
    let usingCodes = false,
        mapping;
    if(!tooManyObjects) {
        // Is there a configured behaviour on any of the objects?
        for(let i = 0; i < objects.length; ++i) {
            if(objects[i].first(ATTR["std:attribute:configured-behaviour"])) {
                usingCodes = true;
                break;
            }
        }
        // Encourage use of behaviours
        if(objects.length === 0) { usingCodes = true; }

        let values = {};
        mapping = {
            types: typeInfo.map((i) => i.code),
            using: usingCodes ? "behaviour" : "title",
            values: values
        };
        let idx = 0;
        _.each(objects, (obj) => {
            let o = obj.first(usingCodes ? ATTR["std:attribute:configured-behaviour"] : ATTR.Title);
            if(o) {
                values["TODO-V"+idx] = o.toString();
                idx++;
            }
        });
    }

    return [typeInfo, tooManyObjects, usingCodes, mappingName, mapping];
};


// --------------------------------------------------------------------------

P.respond("GET", "/do/haplo-data-import/filters", [
], function(E) {
    CanAdministrateDataImport.enforce();
    let filters = P.getAvailableFilters();
    E.render({
        filters: _.keys(filters).sort().map((f) => {
            return {
                name: f,
                info: filters[f]
            };
        })
    });
});

