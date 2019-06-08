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
                "source": "abort",
                "action": "if-value-one-of",
                "values": [true],
                "then": [
                    {
                        "action": "abort-record",
                        "message": "Aborted by instruction in control file"
                    }
                ]
            },
            {
                "source": "log",
                "action": "if-value-one-of",
                "values": [true],
                "then": [
                    {
                        "action": "log-error",
                        "message": "Error message logged by control file"
                    }
                ]
            }
        ]
    };

    // Create JSON input file
    let input = [
        {first:"Joe", last:"Bloggs", abort:true},
        {first:"Jane", last:"Smith", log:true}
    ];
    let inputFile = O.file(O.binaryData(JSON.stringify(input)));

    // Run the import
    let errors = [];
    let batch = O.service("haplo:data-import-framework:batch", control, {input:inputFile}, (e,r)=>errors.push(e));

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

    t.assert(_.isEqual(errors, [
        "Aborted by instruction in control file (record 0)",
        "Error message logged by control file (record 1)"
    ]));

    // Only the second record created an object
    t.assert(createdObjects.length === 1);
    let p0 = createdObjects[0];
    t.assert(p0.title === "Jane Smith");

});
