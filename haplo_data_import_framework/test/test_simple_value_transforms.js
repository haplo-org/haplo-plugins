/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2019            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


t.test(function() {
    var make = haplo_data_import_framework.valueTransformerConstructors;

    var textTransform = make["text"](undefined, {}, "test");
    t.assert(textTransform("xyz") === "xyz");
    t.assert(textTransform(42) === "42");

    var dateTransform = make["datetime"](undefined, {dateFormat:"yyyy-MM-dd"}, "test");
    t.assert(dateTransform("2018-02-10") instanceof Date);
    t.assert(dateTransform("2018-02-10").toString() === "Sat Feb 10 2018 00:00:00 GMT-0000 (UTC)");
    t.assert(dateTransform(undefined) === undefined);

    var objectTypeTransform = make["object-type"](undefined, {}, "test");
    t.assert(objectTypeTransform("std:type:book") === TYPE["std:type:book"]);
    t.assert(objectTypeTransform("doesn't exist") === undefined);

    var paragraphTextTransform = make["text-paragraph"](undefined, {}, "test");
    var paragraphText = paragraphTextTransform("ABC\nDEF");
    t.assert(O.typecode(paragraphText) === O.T_TEXT_PARAGRAPH);
    t.assert(paragraphText.toString() === "ABC\nDEF");

    var multilineTextTransform = make["text-multiline"](undefined, {}, "test");
    var multilineText = multilineTextTransform("XYZ\nPQR");
    t.assert(O.typecode(multilineText) === O.T_TEXT_MULTILINE);
    t.assert(multilineText.toString() === "XYZ\nPQR");

    var configNameTransform = make["configuration-name"](undefined, {}, "test");
    var configName = configNameTransform("test:name:something");
    t.assert(O.typecode(configName) === O.T_IDENTIFIER_CONFIGURATION_NAME);
    t.assert(configName.toString() === "test:name:something");

    var emailTransform = make["email-address"](undefined, {}, "test");
    var email = emailTransform("a@example.org");
    t.assert(O.typecode(email) === O.T_IDENTIFIER_EMAIL_ADDRESS);
    t.assert(email.toString() === "a@example.org");

    var urlTransform = make["url"](undefined, {}, "test");
    var url = urlTransform("https://example.org");
    t.assert(O.typecode(url) === O.T_IDENTIFIER_URL);
    t.assert(url.toString() === "https://example.org");

});
