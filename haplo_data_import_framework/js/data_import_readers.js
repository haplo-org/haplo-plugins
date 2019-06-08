/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2019            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


// Readers are functions which take an iterator function as their single argument.

// --------------------------------------------------------------------------

// JSON file, as an array of objects
P.implementService("haplo:data-import-framework:reader:json", function(file, spec) {
    let parsed = JSON.parse(file.readAsString("utf-8"));
    if(spec.singleRecord) {
        return function(iterator) {
            iterator(parsed);
        };
    } else {
        return function(iterator) {
            _.each(parsed, iterator);
        };
    }
});

// --------------------------------------------------------------------------

var xmlReaderImpl = function(file, spec, decoder) {
    // XML parsing mustn't use readAsString() so the charset can be determined from the file
    let xml = O.xml.parse(file),
        cursor = xml.cursor().firstChild();
    if(spec.singleRecord) {
        return function(iterator) {
            iterator(decoder(cursor));
        };
    } else if(cursor.firstChildElementMaybe()) {
        return function(iterator) {
            do {
                iterator(decoder(cursor));
            } while(cursor.nextSiblingElementMaybe());
        };
    }
    // Nothing in document, return null reader
    return function() {};
};

// XML file, with values from child nodes
P.implementService("haplo:data-import-framework:reader:xml-text-of-children", function(file, spec) {
    return xmlReaderImpl(file, spec, (cursor) => {
        if(cursor.firstChildElementMaybe()) {
            let row = {};
            do {
                row[cursor.getLocalName()] = cursor.getText();
            } while(cursor.nextSiblingElementMaybe());
            cursor.up();
            return row;
        }
        return {};
    });
});

// XML file, with values from attributes
P.implementService("haplo:data-import-framework:reader:xml-attributes", function(file, spec) {
    return xmlReaderImpl(file, spec, (cursor) => {
        let row = {};
        cursor.forEachAttribute((name,value) => {
            row[name] = value;
        });
        return row;
    });
});

// --------------------------------------------------------------------------

// TSV file, where the first line contains the names of the columns
// Optional properties in spec:
//    separator (defaults to a tab character)
//    charset (defaults to 'utf-8')
P.implementService("haplo:data-import-framework:reader:tsv-with-name-row", function(file, spec) {
    let separator = spec.separator || "\t",
        charset = spec.charset || "utf-8";

    return function(iterator) {
        let lines = file.readAsString(charset).split(/[\r\n]+/);
        let headers = lines[0].split(separator);
        for(let i = 1; i < lines.length; ++i) {
            let f = lines[i].split(separator);
            if(f.length) {
                let record = {};
                for(let h = 0; h < headers.length; ++h) {
                    var v = f[h];
                    if(v) {
                        record[headers[h]] = v;
                    }
                }
                iterator(record);
            }
        }
    };
});
