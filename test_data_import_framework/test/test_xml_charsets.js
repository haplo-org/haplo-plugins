/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2019            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


t.test(function() {

    var readerToRows = function(reader) {
        var rows = [];
        reader((row) => rows.push(row));
        return rows;
    };

    // ----------------------------------------------------------------------

    var windows1252 = O.service("haplo:data-import-framework:reader:xml-text-of-children", P.loadFile("test/windows-1252.xml"), {});
    t.assert(_.isEqual(
        readerToRows(windows1252),
        [{"id":"X1", "value":"example chars with different encoding than unicode: ƒŸ‡"}]
    ));

    // ----------------------------------------------------------------------

    var utf8 = O.service("haplo:data-import-framework:reader:xml-text-of-children", P.loadFile("test/utf-8.xml"), {});
    t.assert(_.isEqual(
        readerToRows(utf8),
        [{"id":"X1", "value":"exciting unicode characters: ★☃ƒŸ‡♵"}]
    ));

    // ----------------------------------------------------------------------

    var utf8nodecl = O.service("haplo:data-import-framework:reader:xml-text-of-children", P.loadFile("test/utf-8-no-declaration.xml"), {});
    t.assert(_.isEqual(
        readerToRows(utf8nodecl),
        [{"id":"X1", "value":"Ÿ‡♵★☃ƒ"}]
    ));

});
