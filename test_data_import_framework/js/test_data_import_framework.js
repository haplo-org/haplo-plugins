/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2019            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


// Declare a REST API

P.implementService("haplo:data-import-api:discover-defaults", function(api) {
    api(P, "test-auto-create");
});


// Implement a simple model for books and authors

P.implementService("haplo:data-import-framework:setup-model:test:one", function(model) {

    model.addDestination({
        name: "profile",
        title: "Person profile record",
        displaySort: 1,
        kind: "object",
        objectType: TYPE["std:type:person"]
    });

    model.addDestination({
        name: "book",
        title: "Book written by an author",
        depends: "profile",
        displaySort: 100,
        kind: "object",
        objectType: TYPE["std:type:book"],
        objectDependsWithAttribute: ATTR["dc:attribute:author"]
    });

    model.addDestination({
        name: "info",
        title: "Some random information",
        kind: "dictionary",
        optional: true,
        tryMakeTargetAvailableForDependency: function() {
            return {};  // can't load, just create new entries
        },
        commit: function() {
            // test_missing_values.js relies on this
            throw new Error("Shouldn't be committed by any test");
        },
        dictionaryNames: {
            one: {
                description: "One",
                type: "text",
                required: true
            },
            two: {
                description: "Two",
                type: "text",
                multivalue: true,
                required: true
            },
            three: {
                description: "Three",
                type: "text"
            }
        }
    });

});



// Model with a book and a info destination

P.implementService("haplo:data-import-framework:setup-model:test:two", function(model) {

    model.addDestination({
        name: "book",
        title: "Book written by an author",
        displaySort: 100,
        kind: "object",
        objectType: TYPE["std:type:book"]
    });

    model.addDestination({
        name: "info",
        title: "Some random information",
        kind: "dictionary",
        optional: true,
        tryMakeTargetAvailableForDependency: function() {
            return {};  // can't load, just create new entries
        },
        commit: function() {
        },
        dictionaryNames: {
            single: {
                description: "Single value",
                type: "text"
            },
            multi: {
                description: "Multi-value",
                type: "text",
                multivalue: true
            },
            nameSingle: {
                description: "Person name",
                type: "person-name"
            },
            nameMulti: {
                description: "Person name",
                type: "person-name",
                multivalue: true
            }
        }
    });

});


// Model with a test attributes object for testing data types

P.implementService("haplo:data-import-framework:setup-model:test:three", function(model) {

    model.addDestination({
        name: "test",
        title: "Test attributes object",
        displaySort: 100,
        kind: "object",
        objectType: T.TestAttributes
    });

});

// ==========================================================================


P.implementService("haplo:data-import-framework:filter:test:order-1", function() {
    return function(value) {
        return value.split(",").reverse().join("*");
    };
});

P.implementService("haplo:data-import-framework:filter:test:order-2", function() {
    return function(value) {
        return value.split("-").reverse().join("!");
    };
});
