/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2019            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


t.test(function() {

    let input = [
        {
            VALUE: "X" // which gets mapped with mapInputValue to the test string
        }
    ];
    let inputFile = O.file(O.binaryData(JSON.stringify(input)));

    let control = {
        "dataImportControlFileVersion": 0,
        "model": "test:two",
        "files": {
            "DEFAULT": {"read": "json"}
        },
        "instructions": [
            {
                "action": "new",
                "destination": "book"
            },
            {
                "action": "new",
                "destination": "info"
            },
            {
                "source": "VALUE",
                "destination": "info",
                "name": "single",
                "mapInputValue": {
                    "X": "ABC-900,MNG-100,XYZ-500"
                    // Value transformed in the order specified below in "filters":
                    // order-1 transforms to XYZ-500*MNG-100*ABC-900
                    // order-2 then transforms to 900!100*ABC!500*MNG!XYZ

                    // Incorrect order would be:
                    // order-2 transforms = 500!100,XYZ!900,MNG!ABC
                    // order-1 then transforms to MNG!ABC*XYZ!900*500!100 (which is different to the correct one above)
                },
                "filters": [
                    "test:order-1",
                    "test:order-2"
                ]
            }
        ]
    };

    let errors = [];
    let batch = O.service("haplo:data-import-framework:batch", control, {input:inputFile}, (e,r)=>errors.push(e));

    let out;
    batch.eachRecord((record) => {
        let transformation = batch.transform(record);
        out = transformation.getTarget("info");
    });

    t.assertEqual("900!100*ABC!500*MNG!XYZ", out.single);

});
