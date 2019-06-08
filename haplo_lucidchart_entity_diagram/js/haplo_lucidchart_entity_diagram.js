/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2019            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */



var CanExportSchema = O.action("haplo:lucidchart-entity-diagram:can-export").
    title("Can export schema to LucidChart");

P.hook('hGetReportsList', function(response) {
    if(O.currentUser.allowed(CanExportSchema)) {
        response.reports.push(["/do/haplo-lucidchart-entity-diagram/export", "Export schema to LucidChart"]);
    }
});

// --------------------------------------------------------------------------

P.respond("GET", "/do/haplo-lucidchart-entity-diagram/export", [
], function(E) {
    CanExportSchema.enforce();
    E.render({});
});

P.respond("POST", "/do/haplo-lucidchart-entity-diagram/export", [
], function(E) {
    CanExportSchema.enforce();
    let file = generateSchemaFile();
    let filename = O.application.hostname.replace(/[^a-z0-9]+/g,'-')+"-lucidchart-schema.tsv";
    E.response.body = file;
    E.response.kind = 'tsv';
    E.response.headers['Content-Disposition'] = 'attachment; filename="'+filename+'"';
});

// --------------------------------------------------------------------------

var fields = [
    "table",
    "column",
    "positionIndex",
    "type",
    "! not used",
    "constraint",
    "linkSchema",
    "linkTable",
    "linkColumn"
];

var typeCodeToName = {};
typeCodeToName[O.T_REF] = 'link';
typeCodeToName[O.T_DATETIME] = 'datetime';
typeCodeToName[O.T_BOOLEAN] = 'boolean';
typeCodeToName[O.T_INTEGER] = 'int';
typeCodeToName[O.T_NUMBER] = 'number';
typeCodeToName[O.T_IDENTIFIER_EMAIL_ADDRESS] = 'email';
typeCodeToName[O.T_IDENTIFIER_FILE] = 'file';
typeCodeToName[O.T_IDENTIFIER_ISBN] = 'ISBN';
typeCodeToName[O.T_IDENTIFIER_POSTAL_ADDRESS] = 'postal addr';
typeCodeToName[O.T_IDENTIFIER_POSTCODE] = 'postcode';
typeCodeToName[O.T_IDENTIFIER_TELEPHONE_NUMBER] = 'telephone';
typeCodeToName[O.T_IDENTIFIER_URL] = 'url';
typeCodeToName[O.T_IDENTIFIER_UUID] = 'UUID';

var nameOfLinkedRootType = function(typeRef) {
    let typeInfo = SCHEMA.getTypeInfo(typeRef);
    if(!typeInfo) { return 'UNKNOWN'; }
    if(typeInfo.rootType != typeRef) {
        typeInfo = SCHEMA.getTypeInfo(typeInfo.rootType);
    }
    return typeInfo ? typeInfo.name : 'UNKNOWN';
};

var generateSchemaFile = function() {
    let lines = [];
    for(var code in TYPE) {
        let typeInfo = SCHEMA.getTypeInfo(TYPE[code]);
        // Root types only
        if(typeInfo && !typeInfo.parentType) {
            lines.push({
                table: typeInfo.name,
                column: "ref",
                positionIndex: 1,
                type: "link",
                constraint: "PRIMARY KEY"
            });
            let index = 2;
            typeInfo.attributes.forEach((desc) => {
                let attrInfo = SCHEMA.getAttributeInfo(desc);
                if(attrInfo) {
                    let ai = {
                        table: typeInfo.name,
                        column: attrInfo.name,
                        positionIndex: index++,
                        type: typeCodeToName[attrInfo.typecode] || 'text'
                    };
                    if(attrInfo.typecode === O.T_REF) {
                        // Links to other objects
                        ai.constraint = 'FOREIGN KEY';
                        ai.linkSchema = 'public';
                        ai.linkColumn = 'ref';
                        let types = _.uniq(attrInfo.types.map(nameOfLinkedRootType));
                        if(types.length === 0) {
                            // Unknown type
                            ai.linkTable = 'UNKNOWN';
                            lines.push(ai);
                        } else if(types.length === 1) {
                            // Link to single type
                            ai.linkTable = types[0];
                            lines.push(ai);
                        } else {
                            // Link to multiple types: create one attribute per linked type
                            types.forEach((name) => {
                                let ai2 = _.extend({}, ai);
                                ai2.column = ai.column + ' (' + name + ')';
                                ai2.linkTable = name;
                                lines.push(ai2);
                            });
                        }

                    } else {
                        lines.push(ai);
                    }
                }
            });
        }
    }

    let output = lines.map((l) => {
        let a = ['postgresql', 'haplo', 'public'];
        fields.forEach((f) => {
            let v = l[f];
            a.push(v ? v : '\\N');
        });
        return a.join("\t");
    });
    return output.join("\n");
};

