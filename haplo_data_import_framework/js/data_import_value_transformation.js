/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2019            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


// The Name object creates a function which transforms a value from the input data into
// the data type expected by the Destination, using a specification which is part of the
// Instruction definition in the Control file.

const MAX_OBJECT_TITLE_LOOKUP = 4096;

var constructors = P.valueTransformerConstructors = {};

// --------------------------------------------------------------------------

var Name = P.Name = function(name, properties) {
    this.name = name;
    this.properties = properties;
    this.isMultivalue = !!properties.multivalue;
};

Name.prototype = {

    constructValueTransformerFor(batch, specification, sourceDetailsForErrors) {
        let valueType = this.properties.type || "text",
            constructor = constructors[valueType];
        if(constructor) {
            let valueTransformer = constructor(batch, specification, sourceDetailsForErrors);

            if("filters" in specification) {
                // Wrap in reverse order, so the filters are applied in order specified in control file
                for(let f = specification.filters.length - 1; f >= 0; --f) {
                    valueTransformer = wrapValueTransformerWithFilter(batch, valueTransformer, specification.filters[f]);
                }
            }

            // Mapping input values happens before any filters, so needs to be wrapped last
            if("mapInputValue" in specification) {
                valueTransformer = wrapValueTransformerWithInputValueMapping(valueTransformer, specification);
            }

            return valueTransformer;
        } else {
            batch._reportError("Unknown data type in model: "+valueType);
            return;
        }
    }

};

// --------------------------------------------------------------------------

var wrapValueTransformerWithFilter = function(batch, valueTransformer, filter) {
    let i = P.getAvailableFilters()[filter];
    if(!i) { throw new Error("no filter defined for name: "+filter); }
    let fn;
    // Only ever create one instance of a filter per batch, so when filters
    // maintain state, it works as expected.
    if(filter in batch._filterFunctions) {
        fn = batch._filterFunctions[filter];
    } else {
        fn = batch._filterFunctions[filter] = O.service(i.service);
    }
    if(!fn) { throw new Error("bad implementation of filter "+filter); }
    return function(value) {
        return valueTransformer(fn(value));
    };
};

var wrapValueTransformerWithInputValueMapping = function(valueTransformer, specification) {
    let mapInputValue = specification.mapInputValue,
        haveMapInputValueDefault = ("mapInputValueDefault" in specification),
        mapInputValueDefault = specification.mapInputValueDefault;
    return function(value) {
        value = (value in mapInputValue) ?
            mapInputValue[value] :
            (haveMapInputValueDefault ? mapInputValueDefault : value);
        return valueTransformer(value);
    };
};

// --------------------------------------------------------------------------

constructors["text"] = function(batch, specification, sourceDetailsForErrors) {
    return function(value) {
        switch(typeof(value)) {
            case "string":
                return value;
            case "number":
            case "boolean": 
                return ""+value;
        }
    };
};

// --------------------------------------------------------------------------

constructors["date"] = function(batch, specification, sourceDetailsForErrors) {
    if(typeof(specification.dateFormat) !== "string") {
        batch._reportError("Date format not specified for "+sourceDetailsForErrors);
        return;
    }
    let parser = O.dateParser(specification.dateFormat);
    return function(value) {
        if(typeof(value) !== "string") { return; }
        let date = parser(value);
        if(date === null) {
            batch._reportError("Invalid date value for "+sourceDetailsForErrors+": "+value);
        }
        return date;
    };
};

// --------------------------------------------------------------------------

constructors["ref"] = function(batch, specification, sourceDetailsForErrors) {
    let valueTransformer;
    if("refMapping" in specification) {
        valueTransformer = constructorRefWithMapping(batch, specification, sourceDetailsForErrors);
    }
    if(!valueTransformer) {
        // Default ref value transformer just rejects non-Ref values
        valueTransformer = function(value, transformer) {
            if(O.isRef(value)) {
                return value;
            }
            // TODO: Report an error?
        };
    }
    return valueTransformer;
};

// ref with refMapping property
var constructorRefWithMapping = function(batch, specification, sourceDetailsForErrors) {
    let mappings = batch.control.mapping || {},
        mapping = mappings[specification.refMapping];
    if(!mapping) {
        batch._reportError("Unknown mapping: "+specification.refMapping);
        return;
    }
    let mappingValues = mapping.values;

    // MAPPING VIA BEHAVIOURS
    if(mapping.using === "behaviour") {
        let lookup = {};
        return function(value) {
            if(undefined === value) { return; }
            let tv = lookup[value];
            if(undefined !== tv) { return tv; }
            let behaviour = mappingValues[value];
            if(undefined === behaviour) {
                batch._reportError("Value in input data cannot be mapped for "+sourceDetailsForErrors+": "+value);
                return;
            }
            tv = lookup[value] = O.behaviourRef(behaviour); // exceptions if behaviour unknown
            return tv;
        };

    // MAPPING VIA OBJECT TITLES
    } else if(mapping.using === "title") {
        if(!("types" in mapping)) {
            batch._reportError("Mapping "+specification.refMapping+" does not specify types");
            return;
        } else {
            let types = [];
            _.each(mapping.types, (code) => {
                if(!(code in TYPE)) {
                    batch._reportError("Mapping "+specification.refMapping+" refers to unknown type "+code);
                } else {
                    types.push(TYPE[code]);
                }
            });
            if(types.length === 0) {
                batch._reportError("No types for mapping "+specification.refMapping);
            } else {
                let q = O.query().link(types, ATTR.Type).limit(MAX_OBJECT_TITLE_LOOKUP+1).execute();
                if(q.length > MAX_OBJECT_TITLE_LOOKUP) {
                    batch._reportError("Mapping "+specification.refMapping+" uses title mapping, but too many objects in store to use this method.");
                } else {
                    let lookup = {};
                    _.each(q, (obj) => {
                        obj.everyTitle((v) => lookup[v.toString()] = obj.ref);
                    });
                    // Mapping function which goes via mappingValues
                    return function(value) {
                        if(undefined === value) { return; }
                        let mv = mappingValues[value];
                        if(undefined === mv) { return; }
                        let tv = lookup[mv];
                        if(undefined === tv) {
                            batch._reportError("Value in input data cannot be mapped for "+sourceDetailsForErrors+": "+value);
                            return;
                        }
                        return tv;
                    };
                }
            }
        }
    }
};

// --------------------------------------------------------------------------

constructors["object-type"] = function(batch, specification, sourceDetailsForErrors) {
    return function(value) {
        return (value in TYPE) ? TYPE[value] : undefined;
    };
};


// --------------------------------------------------------------------------

constructors["json"] = function(batch, specification, sourceDetailsForErrors) {
    return function(value) {
        return _.isObject(value) ? value : undefined;
    };
};

// --------------------------------------------------------------------------

constructors["email-address"] = function(batch, specification, sourceDetailsForErrors) {
    return function(value) {
        if(typeof(value) === "string") {
            if(value.indexOf('@') > 0) {    // @ exists and is not first char
                return O.text(O.T_IDENTIFIER_EMAIL_ADDRESS, value);
            } else {
                batch._reportError("Invalid email address for "+sourceDetailsForErrors+": "+value);
            }
        }
    };
};

// --------------------------------------------------------------------------

const VALID_URL = /^[a-zA-Z\+\.\-]+\:/; // just check it starts with scheme:

constructors["url"] = function(batch, specification, sourceDetailsForErrors) {
    return function(value) {
        if(typeof(value) === "string") {
            if(VALID_URL.test(value)) {
                return O.text(O.T_IDENTIFIER_URL, value);
            } else {
                batch._reportError("Invalid URL for "+sourceDetailsForErrors+": "+value);
            }
        }
    };
};

// --------------------------------------------------------------------------

constructors["telephone-number"] = function(batch, specification, sourceDetailsForErrors) {
    let country = specification.country || 'GB';
    return function(value) {
        if(typeof(value) === "string") {
            return O.text(O.T_IDENTIFIER_TELEPHONE_NUMBER, {
                guess_number: value,
                guess_country: country
            });
        }
    };
};

// --------------------------------------------------------------------------

var makeSimpleTextValueType = function(dataType, textTypecode) {
    constructors[dataType] = function(batch, specification, sourceDetailsForErrors) {
        return function(value) {
            return value ? O.text(textTypecode, value) : undefined;
        };
    };
};
// Remember to add reverse to TYPECODE_TO_DATA_TYPE for object Destination
makeSimpleTextValueType("text-paragraph",       O.T_TEXT_PARAGRAPH);
makeSimpleTextValueType("text-multiline",       O.T_TEXT_MULTILINE);
makeSimpleTextValueType("configuration-name",   O.T_IDENTIFIER_CONFIGURATION_NAME);

