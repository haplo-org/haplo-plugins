/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2019            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


t.test(function() {

    // Control file for import
    let control = {
        "dataImportControlFileVersion": 0,
        "model": "haplo:person",
        "files": {
            "DEFAULT": {"read": "json"}
        },
        "instructions": [
            {
                "action": "new",
                "destination": "profile"
            },
            { "source": "first", "destination": "value:person-name", "name": "first" },
            { "source": "last",  "destination": "value:person-name", "name": "last"  },
            {
                "action": "field-structured",
                "structured": "value:person-name",
                "destination": "profile",
                "name": "dc:attribute:title"
            },
            {
                "source": "url",
                "destination": "profile",
                "name": "std:attribute:url"
            },
            // Create another profile object
            {
                "action": "new",
                "destination": "profile"
            },
            {
                "source": "url",
                "destination": "profile",
                "name": "std:attribute:url"
            },
            // Ensure profile has a title
            {
                "action": "if-has-value",
                "destination": "profile",
                "name": "dc:attribute:title",
                "else": [
                    {
                        "action": "set-value",
                        "destination": "value:person-name",
                        "name": "last",
                        "value": "Unnamed profile"
                    },
                    {
                        "action": "field-structured",
                        "structured": "value:person-name",
                        "destination": "profile",
                        "name": "dc:attribute:title"
                    }
                ]
            }
        ]
    };

    // Create JSON input file
    let input = [
        {first:"Joe", last:"Bloggs", url:"https://example.com/person/joe"},
        {first:"Jane", last:"Smith", url:"https://example.com/person/jane"}
    ];
    let inputFile = O.file(O.binaryData(JSON.stringify(input)));

    // Run the import
    let errors = [];
    let batch = O.service("haplo:data-import-framework:batch", control, {input:inputFile}, (e,r)=>errors.push([e,r]));

    let createdObjects = [];
    batch.observe("object:save", (transformation, destinationName, object, isNewObject) => {
        t.assertEqual("profile", destinationName);
        t.assertEqual(true, isNewObject);
        createdObjects.push(object);
    });

    batch.eachRecord((record) => {
        let transformation = batch.transform(record);
        if(transformation.isComplete) {
            transformation.commit();
        }
    });

    t.assertEqual(0, errors.length);

    // Check objects
    t.assert(createdObjects.length === 4);
    let p0 = createdObjects[0];
    t.assert(p0.title === "Joe Bloggs");
    t.assertEqual(1, p0.every(ATTR.Title).length);
    t.assert(p0.first(ATTR["std:attribute:url"]).toString() === "https://example.com/person/joe");
    let p1 = createdObjects[1];
    t.assert(p1.title === "Unnamed profile");
    t.assertEqual(1, p1.every(ATTR.Title).length);
    t.assert(p1.first(ATTR["std:attribute:url"]).toString() === "https://example.com/person/joe");

    let p2 = createdObjects[2];
    t.assert(p2.title === "Jane Smith");
    t.assertEqual(1, p2.every(ATTR.Title).length);
    t.assert(p2.first(ATTR["std:attribute:url"]).toString() === "https://example.com/person/jane");
    let p3 = createdObjects[3];
    t.assert(p3.title === "Unnamed profile");
    t.assertEqual(1, p3.every(ATTR.Title).length);
    t.assert(p3.first(ATTR["std:attribute:url"]).toString() === "https://example.com/person/jane");

});
