/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2019            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


t.test(function() {

    // Input file
    var inputFile = O.file(O.binaryData(JSON.stringify([
        {"t":"Mr", "F":"Joe", "m":"Middle", "l":"Bloggs", "s":"III"},
        {"l":"Surname", "isBook":true, "job":"Tester"}  // doesn't specify all name fields
    ])));

    // Control file
    var control = {
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
            // Put a different type on the object?
            {
                "source": "isBook",
                "action": "if-value-one-of",
                "values": [true],
                "then": [
                    {
                        "action": "set-value",
                        "destination": "profile",
                        "name": "dc:attribute:type",
                        "value": "std:type:book"    // need something in the default schema, and there aren't any person subtypes
                    }
                ]
            },
            // Move name to the structured value destination ...
            { "source": "t",    "destination": "value:person-name",     "name": "title"  },
            { "source": "F",    "destination": "value:person-name",     "name": "first"  },
            { "source": "m",    "destination": "value:person-name",     "name": "middle" },
            { "source": "l",    "destination": "value:person-name",     "name": "last"   },
            { "source": "s",    "destination": "value:person-name",     "name": "suffix" },
            // ... then apply it to the object
            {
                "action": "field-structured",
                "structured": "value:person-name",
                "destination": "profile",
                "name": "dc:attribute:title"
            },
            // Apply an attribute with a qualifier
            {
                "source": "job",
                "destination": "profile",
                "name": "std:attribute:job-title",
                "qualifier": "dc:qualifier:alternative"
            }
        ]
    };

    // Run a transformation
    var batch = O.service("haplo:data-import-framework:batch", control, {input:inputFile}, console.log);
    var people = [];
    batch.eachRecord((record) => {
        let transformation = batch.transform(record);
        people.push(transformation.getTarget("profile"));
        t.assert(transformation.isComplete);
        transformation.commit();
    });

    t.assert(2 === people.length);

    var person0 = people[0];
    // Check type was not changed
    t.assert(person0.firstType() == TYPE["std:type:person"]);
    t.assert(person0.every(ATTR.Type).length === 1);
    // Check name is the proper structured value
    t.assert(person0.title === "Mr Joe Middle Bloggs III");
    t.assert(O.typecode(person0.firstTitle()) === O.T_TEXT_PERSON_NAME);

    var person1 = people[1];
    // Check type was changed
    t.assert(person1.firstType() == TYPE["std:type:book"]);
    t.assert(person1.every(ATTR.Type).length === 1);
    // Check name is the proper structured value
    t.assert(person1.title === "Surname");
    t.assert(O.typecode(person1.firstTitle()) === O.T_TEXT_PERSON_NAME);
    // Check qualified attribute
    t.assert(person1.has("Tester", ATTR["std:attribute:job-title"], QUAL["dc:qualifier:alternative"]));


});
