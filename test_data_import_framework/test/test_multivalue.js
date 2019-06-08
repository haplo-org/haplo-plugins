/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2019            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


t.test(function() {

    let input = [
        {
            "v0": "VALUE0",
            "v1": "VALUE1",
            "v2": "TWO",
            "v3": "THREE",
            "v4": "four 4",
            "v5": "5 five"
        }
    ];
    let inputFile = O.file(O.binaryData(JSON.stringify(input)));

    let testInstructions = function(instructions, fn) {
        let control = {
            "dataImportControlFileVersion": 0,
            "model": "test:two",
            "files": {
                "DEFAULT": {"read": "json"}
            },
            "instructions": instructions
        };
        let errors = [];
        let batch = O.service("haplo:data-import-framework:batch", control, {input:inputFile}, (e,r)=>errors.push(e));
        let count = 0, book, info;
        batch.eachRecord((record) => {
            count++;
            let transformation = batch.transform(record);
            book = transformation.getTarget('book');
            info = transformation.getTarget('info');
        });
        t.assertEqual(0, errors.length);
        t.assertEqual(1, count);
        fn(book, info);
    };

    // ----------------------------------------------------------------------

    // set-value, single value
    testInstructions([
        { "action":"new", "destination":"book" },
        { "action":"set-value", "destination":"book", "name":"dc:attribute:title",  "value": "abc" },
        { "action":"set-value", "destination":"book", "name":"dc:attribute:title",  "value": "DEF" },
        { "action":"new", "destination":"info" },
        { "action":"set-value", "destination":"info", "name":"single",              "value": "xyz" },
        { "action":"set-value", "destination":"info", "name":"single",              "value": "123" },
        { "action":"set-value", "destination":"info", "name":"multi",               "value": "mno" },
        { "action":"set-value", "destination":"info", "name":"multi",               "value": "qwe" }
    ], function(book, info) {
        t.assert(1, book.everyTitle().length);
        t.assert("DEF", book.title);
        t.assert(_.isEqual(info, {single:"123",multi:["qwe"]}));
    });

    // set-value, multi value
    testInstructions([
        { "action":"new", "destination":"book" },
        { "action":"set-value", "destination":"book", "name":"dc:attribute:title",  "value": "abc", "multivalue":true },
        { "action":"set-value", "destination":"book", "name":"dc:attribute:title",  "value": "DEF", "multivalue":true },
        { "action":"new", "destination":"info" },
        { "action":"set-value", "destination":"info", "name":"single",              "value": "xyz", "multivalue":true },
        { "action":"set-value", "destination":"info", "name":"single",              "value": "123", "multivalue":true },
        { "action":"set-value", "destination":"info", "name":"multi",               "value": "mno", "multivalue":true },
        { "action":"set-value", "destination":"info", "name":"multi",               "value": "qwe", "multivalue":true }
    ], function(book, info) {
        t.assert(2, book.everyTitle().length);
        t.assert("abc", book.title);
        t.assert(_.isEqual(book.everyTitle().map((v) => v.s()), ["abc", "DEF"]));
        t.assert(_.isEqual(info, {single:"123",multi:["mno", "qwe"]}));
    });

    // ----------------------------------------------------------------------

    // field, single value
    testInstructions([
        { "action":"new", "destination":"book" },
        { "source": "v0", "destination":"book", "name":"dc:attribute:title" },
        { "source": "v1", "destination":"book", "name":"dc:attribute:title" },
        { "action":"new", "destination":"info" },
        { "source": "v2", "destination":"info", "name": "single" },
        { "source": "v3", "destination":"info", "name": "single" },
        { "source": "v4", "destination":"info", "name": "multi" },
        { "source": "v5", "destination":"info", "name": "multi" }
    ], function(book, info) {
        t.assert(1, book.everyTitle().length);
        t.assert("VALUE1", book.title);
        t.assert(_.isEqual(info, {single:"THREE",multi:["5 five"]}));
    });

    // field, multi value
    testInstructions([
        { "action":"new", "destination":"book" },
        { "source": "v0", "destination":"book", "name":"dc:attribute:title", "multivalue":true },
        { "source": "v1", "destination":"book", "name":"dc:attribute:title", "multivalue":true },
        { "action":"new", "destination":"info" },
        { "source": "v2", "destination":"info", "name": "single", "multivalue":true },
        { "source": "v3", "destination":"info", "name": "single", "multivalue":true },
        { "source": "v4", "destination":"info", "name": "multi",  "multivalue":true },
        { "source": "v5", "destination":"info", "name": "multi",  "multivalue":true }
    ], function(book, info) {
        t.assert(2, book.everyTitle().length);
        t.assert("VALUE0", book.title);
        t.assert(_.isEqual(book.everyTitle().map((v) => v.s()), ["VALUE0", "VALUE1"]));
        t.assert(_.isEqual(info, {single:"THREE",multi:["four 4", "5 five"]}));
    });

    // ----------------------------------------------------------------------

    var loadStructuredField = function(source, destination, name, extraProps) {
        // use an if-value-one-of so that multiple instructions can be returned as a single array element
        return {
            "source": "NOT_IN_INPUT",
            "action": "if-value-one-of",
            "values": [true],
            "else": [
                {
                    "source": source,
                    "destination": "value:person-name",
                    "name": "last"
                },
                _.extend({
                    "action": "field-structured",
                    "structured": "value:person-name",
                    "destination": destination,
                    "name": name
                }, extraProps||{})
            ]
        };
    };

    // structured-field, single value
    testInstructions([
        { "action":"new", "destination":"book" },
        { "action":"set-value", "destination":"book", "name":"dc:attribute:title",  "value": "abc" }, // prevent error, but not checked
        { "action":"new", "destination":"info" },
        loadStructuredField("v2", "info", "nameSingle"),
        loadStructuredField("v3", "info", "nameSingle"),
        loadStructuredField("v4", "info", "nameMulti"),
        loadStructuredField("v5", "info", "nameMulti")
    ], function(book, info) {
        t.assertEqual(O.T_TEXT_PERSON_NAME, O.typecode(info.nameSingle));
        t.assertEqual("THREE", info.nameSingle.toString());
        t.assertEqual(1, info.nameMulti.length);
        t.assertEqual(O.T_TEXT_PERSON_NAME, O.typecode(info.nameMulti[0]));
        t.assertEqual("5 five", info.nameMulti[0].toString());
    });

    // structured-field, multi value
    testInstructions([
        { "action":"new", "destination":"book" },
        { "action":"set-value", "destination":"book", "name":"dc:attribute:title",  "value": "abc" }, // prevent error, but not checked
        { "action":"new", "destination":"info" },
        loadStructuredField("v2", "info", "nameSingle", {multivalue:true}),
        loadStructuredField("v3", "info", "nameSingle", {multivalue:true}),
        loadStructuredField("v4", "info", "nameMulti", {multivalue:true}),
        loadStructuredField("v5", "info", "nameMulti", {multivalue:true})
    ], function(book, info) {
        t.assertEqual(O.T_TEXT_PERSON_NAME, O.typecode(info.nameSingle));
        t.assertEqual("THREE", info.nameSingle.toString());
        t.assertEqual(2, info.nameMulti.length);
        t.assertEqual(O.T_TEXT_PERSON_NAME, O.typecode(info.nameMulti[0]));
        t.assertEqual("four 4", info.nameMulti[0].toString());
        t.assertEqual(O.T_TEXT_PERSON_NAME, O.typecode(info.nameMulti[1]));
        t.assertEqual("5 five", info.nameMulti[1].toString());
    });

});
