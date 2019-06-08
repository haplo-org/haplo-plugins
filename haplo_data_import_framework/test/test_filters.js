/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2019            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


t.test(function() {

    var ref = O.ref('8001');

    let refFilter = O.service("haplo:data-import-framework:filter:haplo:string-to-ref");
    t.assertEqual("function", typeof(refFilter));
    let refConverted = refFilter('800y');
    t.assert(O.isRef(refConverted));
    t.assertEqual(32782, refConverted.objId);
    t.assert(refFilter(ref) === ref);   // exact object is returned
    t.assertEqual(undefined, refFilter(1234));
    t.assertEqual(undefined, refFilter('not a ref'));
    t.assertEqual(undefined, refFilter({}));

    // ----------------------------------------------------------------------

    // Make sure there's an object with a behaviour created for lookup
    let expectedBehaviourRef = O.behaviourRefMaybe("test:data-import-framework:behaviour-one");
    if(!expectedBehaviourRef) {
        let obj = O.object();
        obj.appendType(TYPE["std:type:book"]);
        obj.appendTitle("Test behaviour object");
        obj.append(O.text(O.T_IDENTIFIER_CONFIGURATION_NAME, "test:data-import-framework:behaviour-one"), ATTR["std:attribute:configured-behaviour"]);
        obj.save();
        expectedBehaviourRef = obj.ref;
    }

    let behaviourFilter = O.service("haplo:data-import-framework:filter:haplo:code-to-ref");
    t.assertEqual("function", typeof(behaviourFilter));
    let lookedUpRef = behaviourFilter('test:data-import-framework:behaviour-one');
    t.assert(O.isRef(lookedUpRef));
    t.assert(expectedBehaviourRef == lookedUpRef);
    t.assert(behaviourFilter(ref) === ref);   // exact object is returned
    t.assertEqual(undefined, behaviourFilter(1234));
    t.assertEqual(undefined, behaviourFilter('not a ref'));
    t.assertEqual(undefined, behaviourFilter({}));

    // ----------------------------------------------------------------------

    let urlFixFilter = O.service("haplo:data-import-framework:filter:haplo:fix-up-url");
    t.assertEqual("function", typeof(urlFixFilter));
    // Passing through without change
    t.assertEqual(undefined, urlFixFilter(undefined));
    t.assertEqual("https://haplo.org", urlFixFilter("https://haplo.org"));
    t.assertEqual("https://haplo.org/example", urlFixFilter("https://haplo.org/example"));
    t.assertEqual("http://example.org", urlFixFilter("http://example.org"));
    t.assertEqual("http://example.org/something.html", urlFixFilter("http://example.org/something.html"));
    t.assertEqual("ftp://example.org", urlFixFilter("ftp://example.org"));
    t.assertEqual("eg+x:example.org", urlFixFilter("eg+x:example.org"));
    t.assertEqual("//example.org", urlFixFilter("//example.org"));
    t.assertEqual("/example.org", urlFixFilter("/example.org"));
    t.assertEqual("completely:random-", urlFixFilter("completely:random-")); // not a URL, but has a :, so not touched
    // Fixing up
    t.assertEqual("https://example.org", urlFixFilter("example.org"));
    t.assertEqual("https://example.org/ping", urlFixFilter("example.org/ping"));

    // ----------------------------------------------------------------------

    let toLowerFilter = O.service("haplo:data-import-framework:filter:haplo:to-lower-case");
    t.assertEqual("abc]", toLowerFilter("ABC]"));
    t.assertEqual("def+", toLowerFilter("def+"));
    t.assertEqual(undefined, toLowerFilter(undefined));
    t.assertEqual(1, toLowerFilter(1));

    // ----------------------------------------------------------------------

    let toUpperFilter = O.service("haplo:data-import-framework:filter:haplo:to-upper-case");
    t.assertEqual("ABC)", toUpperFilter("ABC)"));
    t.assertEqual("DEF-", toUpperFilter("def-"));
    t.assertEqual(undefined, toUpperFilter(undefined));
    t.assertEqual(1, toUpperFilter(1));

});
