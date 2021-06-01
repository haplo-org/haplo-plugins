/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2021            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


t.test(function() {

    let testInstructionsAndInput = function(instructions, input, fn) {
        let control = {
            "dataImportControlFileVersion": 0,
            "model": "test:four",
            "files": {
                "DEFAULT": {"read": "json"}
            },
            "instructions": [
                // Create new object
                { "action":"new", "destination":"annotatedItem" },
                { "action":"set-value", "destination":"annotatedItem", "name":"dc:attribute:title", "value":"Test annotated item" },
                { "action":"set-value", "destination":"annotatedItem", "name":"dc:attribute:type", "value":"test:type:data-import-framework-test-other-attributes" }
            ].concat(instructions)
        };
        let inputFile = O.file(O.binaryData(JSON.stringify(input)));
        let errors = [];
        let batch = O.service("haplo:data-import-framework:batch", control, {input:inputFile}, (e,r)=>errors.push(e));
        let objects = [];
        batch.eachRecord((record) => {
            let transformation = batch.transform(record);
            if(transformation.isComplete) {
                transformation.commit();
            }
            objects.push(transformation.getTarget('annotatedItem'));
        });
        fn(objects, errors);
    };

    // ----------------------------------------------------------------------

    // Attributes from the set type of different data types add correctly
    testInstructionsAndInput([
        { "source":"behaviour", "destination":"annotatedItem", "name":"std:attribute:configured-behaviour" }
    ], [
        { "behaviour":"test:list:something:xyz" }
    ], function(objects, errors) {
        t.assertEqual(1, objects.length);
        let behaviour0 = objects[0].first(ATTR["std:attribute:configured-behaviour"]);
        t.assert(O.T_IDENTIFIER_CONFIGURATION_NAME, O.typecode(behaviour0));
        t.assertEqual("test:list:something:xyz", behaviour0.toString());
    });

    testInstructionsAndInput([
        { "source":"notes", "destination":"annotatedItem", "name":"std:attribute:notes" }
    ], [
        { "notes":"This is some text\nParagraph Two" }
    ], function(objects, errors) {
        t.assertEqual(1, objects.length);
        let notes0 = objects[0].first(ATTR["std:attribute:notes"]);
        t.assert(O.T_TEXT_PARAGRAPH, O.typecode(notes0));
        t.assertEqual("This is some text\nParagraph Two", notes0.toString());
    });

    // ----------------------------------------------------------------------

    // attributes from different types in the annotation work correctly
    testInstructionsAndInput([
        { "source":"notes", "destination":"annotatedItem", "name":"test:attribute:data-import-framework-test-multiline" },
        { "source":"date", "destination":"annotatedItem", "name":"test:attribute:data-import-framework-test-date", "dateFormat": "yyyy-MM-dd" }
    ], [
        { "notes":"This is some text\nLine Two", "date":"2020-01-01" }
    ], function(objects, errors) {
        t.assertEqual(1, objects.length);
        let text0 = objects[0].first(ATTR["test:attribute:data-import-framework-test-multiline"]);
        let date0 = objects[0].first(ATTR["test:attribute:data-import-framework-test-date"]);
        t.assert(O.T_TEXT_MULTILINE, O.typecode(text0));
        t.assert(O.T_DATETIME, O.typecode(date0));
        t.assertEqual("This is some text\nLine Two", text0.toString());
        t.assert(_.isEqual(new Date("2020-01-01"), date0.start));
    });
    
    // ----------------------------------------------------------------------

    // errors if no type provided
    testInstructionsAndInput([
        { "action":"remove-values", "destination":"annotatedItem", "name":"dc:attribute:type" }
    ], [
        {}
    ], function(objects, errors) {
        t.assertEqual(1, objects.length);
        t.assert(_.isEqual(errors, [
            "annotatedTypes used but target has no type defined (record 0)"
        ]));
    });

    // ----------------------------------------------------------------------

    // Errors if incorrect name used
    testInstructionsAndInput([
        { "source":"name", "destination":"annotatedItem", "name":"test:attribute:data-import-framework-generic-string"}
    ], [
        { "name": "Testing the fake attribute" }
    ], function(objects, errors) {
        t.assert(_.isEqual(errors, [
            "Unknown name in field test:attribute:data-import-framework-generic-string for destination annotatedItem"
        ]));
    });

});
