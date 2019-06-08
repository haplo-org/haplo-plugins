/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2019            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


// Structured values are composed of fields. They are collected in a special
// 'structured value' Destination, which allows all the transformation and
// mapping features to be used, then copied into a value with the
// "field-structured" Instruction.

// --------------------------------------------------------------------------

var constructors = P.valueTransformerConstructors;

// --------------------------------------------------------------------------

constructors["person-name"] = function(batch, specification, sourceDetailsForErrors) {
    return function(value) {
        if(typeof(value) !== 'object' || !value.last) { return undefined; }
        return O.text(O.T_TEXT_PERSON_NAME, value);
    };
};

P.implementService("haplo:data-import-framework:structured-data-type:add-destination:person-name", function(model) {
    model.addDestination({
        name: "value:person-name",
        title: "Person's name (structured value)",
        displaySort: 999999,
        pseudo: true,
        excludeFromGenerator: true,
        kind: "dictionary",
        dictionaryNames: {
            title: {
                description: "Mr, Mrs, Ms, etc",
                type: "text"
            },
            first: {
                description: "First name",
                type: "text"
            },
            middle: {
                description: "Middle name",
                type: "text"
            },
            last: {
                description: "Family name (surname)",
                type: "text",
                required: true
            },
            suffix: {
                description: "Suffix",
                type: "text"
            }
        }
    });
});

// --------------------------------------------------------------------------

constructors["postal-address"] = function(batch, specification, sourceDetailsForErrors) {
    return function(value) {
        if(typeof(value) !== 'object') { return undefined; }
        if(!(value.country && (typeof(value.country) === "string") && (value.country.length === 2))) {
            batch._reportError("Missing or invalid country code in postal address, must be two letter ISO code: "+JSON.stringify(value));
        } else {
            try {
                return O.text(O.T_IDENTIFIER_POSTAL_ADDRESS, value);
            } catch(e) {
                let m = e.message.
                    replace('org.jruby.exceptions.RaiseException: (RuntimeError) ', '').
                    replace('KIdentifierPostalAddress', 'Postal addresses');
                batch._reportError("Invalid postal address: "+JSON.stringify(value)+" ("+m+")");
            }
        }
    };
};

P.implementService("haplo:data-import-framework:structured-data-type:add-destination:postal-address", function(model) {
    model.addDestination({
        name: "value:postal-address",
        title: "Postal address (structured value)",
        displaySort: 999999,
        pseudo: true,
        excludeFromGenerator: true,
        kind: "dictionary",
        dictionaryNames: {
            street1: {
                description: "Street address (line 1)",
                type: "text"
            },
            street2: {
                description: "Street address (line 2)",
                type: "text"
            },
            city: {
                description: "City",
                type: "text"
            },
            county: {
                description: "County",
                type: "text"
            },
            postcode: {
                description: "Postcode",
                type: "text"
            },
            country: {
                description: "Country two letter ISO code (eg GB)",
                type: "text",
                required: true
            },
        }
    });
});
