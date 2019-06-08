/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2019            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


t.test(function() {

    let batchWithInstructions = function(instructions, fn) {
        let control = {
            "dataImportControlFileVersion": 0,
            "model": "haplo:person",
            "files": {
                "DEFAULT": {"read": "json"}
            },
            "instructions": instructions
        };
        fn(O.service("haplo:data-import-framework:batch", control, {}, console.log));
    };

    // ----------------------------------------------------------------------

    // Not first instruction
    batchWithInstructions([
        { "action":"set-value", "destination":"profile", "name":"std:attribute:job-title", "value":"X" },
        { "source":"job", "destination":"profile", "name":"std:attribute:job-title" },
    ], (batch) => {
        let extract = batch.makeExtractFunctionFromSimpleInstructionFor("profile", "std:attribute:job-title");
        t.assert(typeof(extract) === "function");
        t.assertEqual("JT", extract({"a":"b", "job":"JT"}));
        t.assertEqual(undefined, extract({"x":"y"}));   // no value in record
        t.assertEqual("2", extract({"job":"2"}));       // conversion, not just extract value
    });

    // Can't find one, because it's inside another instruction
    batchWithInstructions([
        { "action":"set-value", "destination":"profile", "name":"std:attribute:job-title", "value":"X" },
        {
            "action":"if-has-value", "destination":"profile", "name":"dc:attribute:title",
            "then": [
                { "source":"job", "destination":"profile", "name":"std:attribute:job-title" },
            ]
        }
    ], (batch) => {
        let extract = batch.makeExtractFunctionFromSimpleInstructionFor("profile", "std:attribute:job-title");
        t.assertEqual(null, extract);
    });

    // Filters are applied
    batchWithInstructions([
        { "action":"set-value", "destination":"profile", "name":"std:attribute:job-title", "value":"X" },
        { "action":"field", "source":"REF", "destination":"load:by-ref", "name":"ref", "filters":["haplo:string-to-ref"] },
    ], (batch) => {
        let extract = batch.makeExtractFunctionFromSimpleInstructionFor("load:by-ref", "ref");
        t.assert(typeof(extract) === "function");
        let refIn = O.ref(125422);
        let refOut = extract({"a":"b", "REF":refIn.toString()});
        t.assert(O.isRef(refOut));
        t.assert(refOut == refIn);
    });

});
