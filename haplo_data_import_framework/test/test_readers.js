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

    // JSON
    var jsonFile = O.file(O.binaryData('[{"X":{"Y":1}},{"PING":"XYZ","PONG":234}]'));
    var jsonReader = O.service("haplo:data-import-framework:reader:json", jsonFile, {});
    t.assert(_.isEqual(
        readerToRows(jsonReader),
        [{X:{Y:1}}, {PING:"XYZ",PONG:234}]
    ));

    var jsonFile2 = O.file(O.binaryData('{"abc":453,"def":"hello"}'));
    var jsonReader2 = O.service("haplo:data-import-framework:reader:json", jsonFile2, {singleRecord:true});
    t.assert(_.isEqual(
        readerToRows(jsonReader2),
        [{abc:453,def:"hello"}]
    ));

    // ----------------------------------------------------------------------

    // XML with values as child nodes
    var emptyXMLFile = O.file(O.binaryData('<root></root>'));
    var emptyXMLFileReader = O.service("haplo:data-import-framework:reader:xml-text-of-children", emptyXMLFile, {});
    t.assert(_.isEqual(
        readerToRows(emptyXMLFileReader),
        []
    ));
    var xmlFile = O.file(O.binaryData('<root> <v/> <v> <x>PING</x> <y>PONG</y> </v> <v> <hello>world</hello> </v> </root>'));
    var xmlFileReader = O.service("haplo:data-import-framework:reader:xml-text-of-children", xmlFile, {});
    t.assert(_.isEqual(
        readerToRows(xmlFileReader),
        [{}, {x:"PING",y:"PONG"}, {hello:"world"}]
    ));

    var xmlFileSingleRecord = O.file(O.binaryData('<root> <x>PING2</x> <y>PONG2</y> </root>'));
    var xmlFileReaderSingleRecord = O.service("haplo:data-import-framework:reader:xml-text-of-children", xmlFileSingleRecord, {singleRecord:true});
    t.assert(_.isEqual(
        readerToRows(xmlFileReaderSingleRecord),
        [{x:"PING2",y:"PONG2"}]
    ));

    // XML with values as attributes nodes
    var emptyXMLFileReader2 = O.service("haplo:data-import-framework:reader:xml-attributes", emptyXMLFile, {});
    t.assert(_.isEqual(
        readerToRows(emptyXMLFileReader2),
        []
    ));
    var xmlFile2 = O.file(O.binaryData('<root> <v/> <something a="b" def="abc"/> <else hello="world"></else> </root>'));
    var xmlFileReader2 = O.service("haplo:data-import-framework:reader:xml-attributes", xmlFile2, {});
    t.assert(_.isEqual(
        readerToRows(xmlFileReader2),
         [{}, {a:"b",def:"abc"}, {hello:"world"}]
    ));

    var xmlFileSingleRecord2 = O.file(O.binaryData('<root a="b2" def="abc2"/>'));
    var xmlFileReaderSingleRecord2 = O.service("haplo:data-import-framework:reader:xml-attributes", xmlFileSingleRecord2, {singleRecord:true});
    t.assert(_.isEqual(
        readerToRows(xmlFileReaderSingleRecord2),
         [{a:"b2",def:"abc2"}]
    ));

    // ----------------------------------------------------------------------

    // TSV
    var tsvFile = O.file(O.binaryData("ID\tVALUE\tX\n1234\tPING\n654\tPONG\tY", {mimeType:"text/tab-separated-values"}));
    var tsvReader = O.service("haplo:data-import-framework:reader:tsv-with-name-row", tsvFile, {
        charset: "utf-8"
    });
    t.assert(_.isEqual(
        readerToRows(tsvReader),
        [{ID:"1234",VALUE:"PING"},{ID:"654",VALUE:"PONG",X:"Y"}]
    ));

    // TSV with custom separator
    var tsvWithCommaFile = O.file(O.binaryData("ID, VALUE\n1234, PING2\n654, PONG3", {mimeType:"text/csv"}));
    var tsvWithCommaReader = O.service("haplo:data-import-framework:reader:tsv-with-name-row", tsvWithCommaFile, {
        charset: "utf-8",
        separator: ", "
    });
    t.assert(_.isEqual(
        readerToRows(tsvWithCommaReader),
        [{ID:"1234",VALUE:"PING2"},{ID:"654",VALUE:"PONG3"}]
    ));

});
