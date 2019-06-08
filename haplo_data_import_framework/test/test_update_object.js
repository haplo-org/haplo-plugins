/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2019            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


t.test(function() {

    // Make two person object and input data
    let people = [], input = [];
    ["one", "two"].forEach((name) => {
        let object = O.object();
        object.appendType(TYPE["std:type:person"]);
        object.appendTitle(O.text(O.T_TEXT_PERSON_NAME, {
            first: "Person",
            last: name
        }));
        object.save();
        people.push({object:object, name:name});
        // Generate some data to import
        input.push({
            REF: object.ref.toString(),
            url: "https://example.org/person/"+name
        });
    });

    // Control file for import
    let control = {
        "dataImportControlFileVersion": 0,
        "model": "haplo:person",
        "files": {
            "DEFAULT": {"read": "json"}
        },
        "instructions": [
            {
                "source": "REF",
                "destination": "load:by-ref",
                "name": "ref",
                "filters": ["haplo:string-to-ref"]
            },
            {
                "action": "load",
                "destination": "profile",
                "using": "load:by-ref"
            },
            {
                "source": "url",
                "destination": "profile",
                "name": "std:attribute:url"
            }
        ]
    };

    // Create JSON input file
    let inputFile = O.file(O.binaryData(JSON.stringify(input)));

    // Run the import
    let batch = O.service("haplo:data-import-framework:batch", control, {input:inputFile}, console.log);
    batch.eachRecord((record) => {
        let transformation = batch.transform(record);
        if(transformation.isComplete) {
            transformation.commit();
        }
    });

    // Check people objects have had their URLs added
    people.forEach((i) => {
        let updated = i.object.ref.load();
        t.assert(updated.version === i.object.version + 1);
        t.assert(updated.first(ATTR['std:attribute:url']).toString() === "https://example.org/person/"+i.name);
    });

});
