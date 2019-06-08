/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2019            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


// More value tests in test_data_import_framework/test/test_text_values2.js

t.test(function() {

    let testInstructionsAndInput = function(instructions, input, fn) {
        let control = {
            "dataImportControlFileVersion": 0,
            "model": "test:three",
            "files": {
                "DEFAULT": {"read": "json"}
            },
            "instructions": [
                // Create new object
                { "action":"new", "destination":"test" },
                { "action":"set-value", "destination":"test", "name":"dc:attribute:title", "value":"Test" }
            ].concat(instructions)
        };
        let inputFile = O.file(O.binaryData(JSON.stringify(input)));
        let errors = [];
        let batch = O.service("haplo:data-import-framework:batch", control, {input:inputFile}, (e,r)=>errors.push(e));
        let objects = [];
        batch.eachRecord((record) => {
            let transformation = batch.transform(record);
            objects.push(transformation.getTarget('test'));
        });
        fn(objects, errors);
    };

    // ----------------------------------------------------------------------

    // configured-behaviour data type
    testInstructionsAndInput([
        { "source":"behaviour", "destination":"test", "name":"std:attribute:configured-behaviour" }
    ], [
        { "behaviour":"test:list:something:xyz" }
    ], function(objects, errors) {
        t.assertEqual(1, objects.length);
        let behaviour0 = objects[0].first(ATTR["std:attribute:configured-behaviour"]);
        t.assert(O.T_IDENTIFIER_CONFIGURATION_NAME, O.typecode(behaviour0));
        t.assertEqual("test:list:something:xyz", behaviour0.toString());
    });

    // ----------------------------------------------------------------------

    // text-paragraph data type
    testInstructionsAndInput([
        { "source":"notes", "destination":"test", "name":"std:attribute:notes" }
    ], [
        { "notes":"This is some text\nParagraph Two" }
    ], function(objects, errors) {
        t.assertEqual(1, objects.length);
        let notes0 = objects[0].first(ATTR["std:attribute:notes"]);
        t.assert(O.T_TEXT_PARAGRAPH, O.typecode(notes0));
        t.assertEqual("This is some text\nParagraph Two", notes0.toString());
    });

    // ----------------------------------------------------------------------

    // text-multiline data type
    testInstructionsAndInput([
        { "source":"notes", "destination":"test", "name":"test:attribute:data-import-framework-test-multiline" }
    ], [
        { "notes":"This is some text\nLine Two" }
    ], function(objects, errors) {
        t.assertEqual(1, objects.length);
        let text0 = objects[0].first(ATTR["test:attribute:data-import-framework-test-multiline"]);
        t.assert(O.T_TEXT_MULTILINE, O.typecode(text0));
        t.assertEqual("This is some text\nLine Two", text0.toString());
    });

});
