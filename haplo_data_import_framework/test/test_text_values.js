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
            "model": "haplo:person",
            "files": {
                "DEFAULT": {"read": "json"}
            },
            "instructions": [
                // Create profile and set a title
                { "action":"new", "destination":"profile" },
                { "action":"set-value", "destination":"value:person-name", "name":"last", "value":"Smith" },
                { "action":"field-structured", "structured":"value:person-name", "destination":"profile", "name":"dc:attribute:title" }
            ].concat(instructions)
        };
        let inputFile = O.file(O.binaryData(JSON.stringify(input)));
        let errors = [];
        let batch = O.service("haplo:data-import-framework:batch", control, {input:inputFile}, (e,r)=>errors.push(e));
        let profiles = [];
        batch.eachRecord((record) => {
            let transformation = batch.transform(record);
            profiles.push(transformation.getTarget('profile'));
        });
        fn(profiles, errors);
    };

    // ----------------------------------------------------------------------

    // email data type
    testInstructionsAndInput([
        { "source":"e", "destination":"profile", "name":"std:attribute:email" }
    ], [
        { "e":"test@example.com" },
        { "e":"@example.com" },
        { "e":"test at example.com" }
    ], function(profiles, errors) {
        t.assertEqual(3, profiles.length);
        // Valid email adddress exists and has correct type
        let email0 = profiles[0].first(ATTR["std:attribute:email"]);
        t.assert(O.T_IDENTIFIER_EMAIL_ADDRESS, O.typecode(email0));
        t.assertEqual("test@example.com", email0.toString());
        // Invalid addresses not on objects and errors emitted
        t.assert(!profiles[1].first(ATTR["std:attribute:email"]));
        t.assert(!profiles[2].first(ATTR["std:attribute:email"]));
        t.assert(_.isEqual([
            "Invalid email address for input field e: @example.com (record 1)",
            "Invalid email address for input field e: test at example.com (record 2)"
        ], errors));
    });

    // ----------------------------------------------------------------------

    // url data type
    testInstructionsAndInput([
        { "source":"u", "destination":"profile", "name":"std:attribute:url" }
    ], [
        { "u":"https://haplo.org" },
        { "u":"haplo.org" },
        { "u":"://haplo.org" }
    ], function(profiles, errors) {
        t.assertEqual(3, profiles.length);
        // Valid URL exists and has correct type
        let url0 = profiles[0].first(ATTR["std:attribute:url"]);
        t.assert(O.T_IDENTIFIER_URL, O.typecode(url0));
        t.assertEqual("https://haplo.org", url0.toString());
        // Invalid urls not on objects and errors emitted
        t.assert(!profiles[1].first(ATTR["std:attribute:url"]));
        t.assert(!profiles[2].first(ATTR["std:attribute:url"]));
        t.assert(_.isEqual([
            "Invalid URL for input field u: haplo.org (record 1)",
            "Invalid URL for input field u: ://haplo.org (record 2)"
        ], errors));
    });

    // ----------------------------------------------------------------------

    // telephone-number data type
    testInstructionsAndInput([
        { "source":"t", "destination":"profile", "name":"std:attribute:telephone", "country":"US" }
    ], [
        { "t":"+442012345678" },
        { "t":"823 124 125"},
        { "t":"+33 5 8765 6432"},
    ], function(profiles, errors) {
        t.assertEqual(3, profiles.length);

        let tel0 = profiles[0].first(ATTR["std:attribute:telephone"]);
        t.assert(O.T_IDENTIFIER_TELEPHONE_NUMBER, O.typecode(tel0));
        t.assertEqual("+44 20 1234 5678", tel0.toString("export"));

        t.assertEqual("+1 823124125", profiles[1].first(ATTR["std:attribute:telephone"]).toString("export"));
        t.assertEqual("+33 5 87 65 64 32", profiles[2].first(ATTR["std:attribute:telephone"]).toString("export"));
    });

});
