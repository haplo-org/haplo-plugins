/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2019            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


t.test(function() {

    let person = O.object();
    person.appendType(TYPE["std:type:person"]);
    person.appendTitle("Test person");
    person.save();

    let input = [
        {
            personRef: person.ref.toString(),
            jobTitle: "Researcher",
            notes: "Notes 1",
            assertBook: true
        },
        {
            personRef: O.ref(person.ref.objId+100).toString(),  // load will fail
            jobTitle: "Student",
            notes: "Notes 2"
        }
    ];
    let inputFile = O.file(O.binaryData(JSON.stringify(input)));

    let control = {
        "dataImportControlFileVersion": 0,
        "model": "test:one",
        "files": {
            "DEFAULT": {"read": "json"}
        },
        "instructions": [
            {
                "source": "personRef",
                "destination": "load:by-ref",
                "name": "ref",
                "filters": ["haplo:string-to-ref"]
            },
            {
                "action": "load",
                "destination": "profile",
                "using": "load:by-ref"
            },
            // assert-destination is conditional so abort can be checked from the load and the assert
            {
                "source": "assertBook",
                "action": "if-value-one-of",
                "values": [true],
                "then": [
                    {
                        "action": "assert-destination",
                        "destination": "book",
                        "exists": false
                    }
                ]
            },
            // Add job title to person
            {
                "source": "jobTitle",
                "destination": "profile",
                "name": "std:attribute:job-title"
            },
            // Add notes to book
            {
                "source": "notes",
                "destination": "book",
                "name": "std:attribute:notes"
            }
        ]
    };

    let errors = [];
    let batch = O.service("haplo:data-import-framework:batch", control, {input:inputFile}, (e,r)=>errors.push(e));

    batch.observe("object:save", (transformation, destinationName, object, isNewObject) => {
        t.assert(false);    // shouldn't create/modify anything
    });

    batch.eachRecord((record) => {
        let transformation = batch.transform(record);
        if(transformation.isComplete) {
            transformation.commit();
        }
    });

    // Person wasn't modified
    t.assertEqual(1, person.ref.load().version);

    // Errors are as expected
    t.assert(_.isEqual(errors, [
        "assert-destination failed: book (record 0)",
        "Couldn't load destination: profile (record 1)",
        "Destination \"profile\" needs be made ready with a \"new\" or \"load\" instruction (record 1)"
    ]));

});
