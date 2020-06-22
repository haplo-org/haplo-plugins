/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2020            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


var valuesForField = function(field, M) {
    let values = [];
    if(field.attribute) {
        if(!field.entity) {
            throw new Error("Cannot fetch attribute value without entity specified for attribute "+field.attribute);
        }
        let object = M.entities[field.entity + "_maybe"];
        if(!object) { return; }
        object.every(ATTR[field.attribute], (v,d,q) => {
            if(field.type !== 'ref' && O.isRef(v)) {
                v = v.load().title;
            } else {
                v = v.toString();
            }
            values.push({
                v: v,
                d: field.attribute,
                q: q ? SCHEMA.getQualifierInfo(q).code : undefined
            });
        });
    } else if(field.entity) {
        if(M.entities[field.entity + "_refMaybe"]) {
            values.push(field.type === 'ref' ? M.entities[field.entity + "_ref"] : M.entities[field.entity].title);
        }
    } else if(field.service) {
        if(field.service.indexOf("haplo:form-read-only-data:") !== 0) {
            // security: don't want forms to be able to call any old service which could be doing anything within the system
            throw new Error(field.service+" is not a valid service name. Services must be prefixed with 'haplo:form-read-only-data:'.");
        }
        let v = O.service(field.service, M);
        if(!v && v !== 0) { return; }
        if(_.isArray(v)) {
            values = _.map(v, vv => vv.toString());
        } else {
            values.push(v.toString());
        }
    } else {
        throw new Error("Incorrectly defined field: "+JSON.stringify(field)+
            " In order to display read only data, must specify entity or service to fetch data from.");
    }
    return values;
};

// a11y requires that an id links the label and the value
// so this creates an id that guarantees the data is associated to the right label
// even if that label isn't the one closest to it
var a11yId = function(field) {
    let idSuffixParts = [(field.entity || field.service)];
    if(field.attribute) {
        idSuffixParts.push(field.attribute);
    }
    if(field.label) {
        idSuffixParts.push(field.label);
    }
    if(field.type) {
        idSuffixParts.push(field.type);
    }
    let idSuffix = idSuffixParts.join("_").toLowerCase();
    idSuffix = idSuffix.replace(/[^a-z]/g, "_");
    return "haplo_form_read_only_data_"+idSuffix;
};

/*HaploDoc
node: /haplo-plugins/haplo_form_read_only_data/field-types
title: Field types
sort: 15
--

To render and store data of different types, specify the type in the field object in the form.

| **Type** | **Description** |
| ref | Display the data as a linked object. If the data is a ref, and this isn't set, then the object title will be stored and displayed. |
| date | Display the data using the standard date rendering. |

*/

P.globalTemplateFunction("haplo:form-read-only-data:display", function(view, context, externalData) {
    let fields = view.fields;
    let valuesLookup = context ? context.$readOnlyDataValues : undefined;
    let M = externalData["std_document_store:key"];
    if(!M) { return; } // don't break when displaying blank forms in guides

    // note: i18n - needs to get text and look up labels in the plugin which implements the workflow
    let plugin = O.service("std:workflow:definition_for_name", M.workUnit.workType).plugin;
    let i = plugin.locale().text("form");

    this.render(P.template("_display").deferredRender({
        fields: _.map(fields, (field) => {
            let hasStoredValues = field.path && valuesLookup && valuesLookup[field.path];
            let values = hasStoredValues ? valuesLookup[field.path] : valuesForField(field, M);
            let id = a11yId(field);
            let displayValues = _.map(values, v => {
                let value = v.v ? v.v : v;
                if(field.type === 'ref') {
                    value = O.ref(value);
                } else if(field.type === 'date') {
                    value = new Date(value);
                }
                return {
                    label: v.q ? i[SCHEMA.getQualifierInfo(QUAL[v.q]).name] : undefined,
                    value: value, // TODO: pass through i18n when support has been provided for text objects
                    type: field.type,
                    unsafeForId: id
                };
            });
            let fieldLabel = field.label;
            if(!fieldLabel && field.attribute) {
                fieldLabel = SCHEMA.getAttributeInfo(ATTR[field.attribute]).name;
            }
            return {
                label: fieldLabel ? i[fieldLabel] : undefined,
                unsafeForId: id,
                values: displayValues,
                asTable: _.some(displayValues, v => !!v.label)
            };
        })
    }));
});

var fieldPathToValues = function(fields, M) {
    let pathToValues = {};
    _.each(fields, (field) => {
        if(!field.path) {
            // can't save values without a path, but might not want to save this particular one anyway so no error
            return;
        }
        pathToValues[field.path] = valuesForField(field, M);
    });
    return pathToValues;
};

/*HaploDoc
node: /haplo-plugins/haplo_form_read_only_data/history
title: Historical reference
sort: 20
--

h3(service). "haplo:form-read-only-data:set-document-data"

When the saved document is viewed, by default the read only data values will display the most recent values. \
Use this service if you would like to store the read only data in the document for historical reference. \
Each field that you would like to store data for will need to have a @path@ defined as well, \
which needs to be unique within it's context.

The service call takes @M@, @instance@, @document@, @FormDefinitions@, \
the latter is either provided as a single form definition or an array of form definitions.

The service returns @document@, with the read only data values that can be saved in it at a pseudo-private path in the document.

If the 'show changes' feature is applied to the form, changes to read only data that has been stored will be highlighted, \
and data that has not been saved in the form will not show changes over different versions.

NB: data is stored as a string. To store and render data of different types properly, see 'Field types'.

Example use:

<pre>language=javascript
    updateDocumentBeforeEdit(key, instance, document) {
        O.service("haplo:form-read-only-data:set-document-data", key, instance, document, [FooForm, BarForm]);
    },
</pre>

*/

P.implementService("haplo:form-read-only-data:set-document-data", function(M, instance, document, FormDefinitions) {
    let saveReadOnlyValuesInContext = function(element, context) {
        context = context || {};
        let hasDataToStore = element.view && element.view.fields && (element.type === "render-template") &&
            (element.plugin === "haplo_form_read_only_data") && (element.template === "display");
        if(hasDataToStore) {
            context.$readOnlyDataValues = context.$readOnlyDataValues || {};
            _.extend(context.$readOnlyDataValues, fieldPathToValues(element.view.fields, M));
        } else if(element.elements) {
            _.each(element.elements, e => {
                saveReadOnlyValuesInContext(e, element.path ? context[element.path] : context);
            });
        }
    };
    FormDefinitions = _.isArray(FormDefinitions) ? FormDefinitions : [FormDefinitions]; // can pass one or more forms
    _.each(FormDefinitions, FormDefinition => {
        saveReadOnlyValuesInContext(FormDefinition.specification, document);
    });
    return document;
});
