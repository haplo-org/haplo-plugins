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
            ONE: "one",
            profileTitle: "P0",
            bookTitle: "B0"
        },
        {
            TWO: "two",
            profileTitle: "P1",
            bookTitle: "B1"
        },
        {
            ONE: "one",
            TWO: "two",
            bookTitle: "B4"
        },
        {
            ONE: "one",
            TWO: "two",
            profileTitle: "P3",
        },
        {
            // Empty
        },
        {
            // Check checks for multiple targets
            doMissingTarget: true,
            // But otherwise everything is complete
            ONE: "one",
            TWO: "two",
            profileTitle: "P0",
            bookTitle: "B0"
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
            // Profile object
            {
                "action": "new",
                "destination": "profile"
            },
            {
                "source": "profileTitle",
                "destination": "profile",
                "name": "dc:attribute:title"
            },

            // Book object
            {
                "action": "new",
                "destination": "book"
            },
            {
                "source": "bookTitle",
                "destination": "book",
                "name": "dc:attribute:title"
            },

            // Check muliple objects for a single destination?
            {
                "source": "doMissingTarget",
                "action": "if-value-one-of",
                "values": [true],
                "then": [
                    {
                        "action": "new",
                        "destination": "info"
                    }
                ]
            },

            // Info object to test dictionary style definitions
            {
                "action": "new",
                "destination": "info"
            },
            {
                "source": "ONE",
                "destination": "info",
                "name": "one"
            },
            {
                "source": "TWO",
                "destination": "info",
                "name": "two"
            }
        ]
    };

    let errors = [];
    let batch = O.service("haplo:data-import-framework:batch", control, {input:inputFile}, (e,r)=>errors.push(e));

    batch.observe("object:save", (transformation, destinationName, object, isNewObject) => {
        t.assert(false);    // shouldn't create/modify anything
    });
    // commit() for info checks that the info is never committed

    batch.eachRecord((record) => {
        let transformation = batch.transform(record);
        if(transformation.isComplete) {
            transformation.commit();
        }
    });

    // Errors are as expected
    t.assert(_.isEqual(errors, [
        "Missing values in info: two (record 0)",
        "Missing values in info: one (record 1)",
        "dc:attribute:title is not set in object profile (record 2)",
        "To set defaults for dc:attribute:title, see example of if-has-value instruction at https://docs.haplo.org/import/control/instruction/if-has-value (record 2)",
        "dc:attribute:title is not set in object book (record 3)",
        "dc:attribute:title is not set in object profile (record 4)",
        "dc:attribute:title is not set in object book (record 4)",
        "Missing values in info: one, two (record 4)",
        "Missing values in info: one, two (record 5)"
    ]));

});
