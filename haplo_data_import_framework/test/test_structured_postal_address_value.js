/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2019            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


t.test(function() {

    // Input file
    var inputFile = O.file(O.binaryData(JSON.stringify([
        // {"s1":"", "s2":"", "ci":"", "co":"", "p":"", "code":"" }
        {"s1":"1 High Street", "ci":"New Town", "p":"NT1 1TN", "code":"GB" },   // some fields
        {"s1":"Street 1", "s2":"Street Two", "ci":"New City", "co":"New County", "p":"PO1 1OO", "code":"GB" }, // all fields
        {},
        {"s1":"1 High Street", "ci":"New Town", "p":"NT1 1TN", "code":"England" },  // bad country (long)
        {"s1":"1 High Street", "ci":"New Town", "p":"NT1 1TN", "code":"XX" }        // bad country (code doesn't exist)
    ])));

    // Control file
    var control = {
        "dataImportControlFileVersion": 0,
        "model": "haplo:person",
        "files": {
            "DEFAULT": {"read": "json"}
        },
        "instructions": [
            {
                "action": "new",
                "destination": "profile"
            },
            // Add a name to pass validation
            {
                "action": "set-value",
                "destination": "value:person-name",
                "name": "last",
                "value": "Smith"
            },
            {
                "action": "field-structured",
                "structured": "value:person-name",
                "destination": "profile",
                "name": "dc:attribute:title"
            },
            // Move name to the structured value destination ...
            { "source": "s1",   "destination": "value:postal-address",  "name": "street1"   },
            { "source": "s2",   "destination": "value:postal-address",  "name": "street2"   },
            { "source": "ci",   "destination": "value:postal-address",  "name": "city"      },
            { "source": "co",   "destination": "value:postal-address",  "name": "county"    },
            { "source": "p",    "destination": "value:postal-address",  "name": "postcode"  },
            { "source": "code", "destination": "value:postal-address",  "name": "country"   },
            // ... then apply it to the object
            {
                "action": "field-structured",
                "structured": "value:postal-address",
                "destination": "profile",
                "name": "std:attribute:address"
            }
        ]
    };

    // Run a transformation
    var errors = [];
    var batch = O.service("haplo:data-import-framework:batch", control, {input:inputFile}, (m) => errors.push(m));
    var people = [];
    batch.eachRecord((record) => {
        let transformation = batch.transform(record);
        people.push(transformation.getTarget("profile"));
        transformation.commit();
    });

    t.assert(_.isEqual(errors, [
        "Missing or invalid country code in postal address, must be two letter ISO code: {} (record 2)",
        "Missing or invalid country code in postal address, must be two letter ISO code: {\"street1\":\"1 High Street\",\"city\":\"New Town\",\"postcode\":\"NT1 1TN\",\"country\":\"England\"} (record 3)",
        "Invalid postal address: {\"street1\":\"1 High Street\",\"city\":\"New Town\",\"postcode\":\"NT1 1TN\",\"country\":\"XX\"} (Postal addresses must use a recognised country) (record 4)"
    ]));

    t.assertEqual(5, people.length);

    var person0 = people[0];
    var address0 = person0.first(ATTR["std:attribute:address"]);
    t.assertEqual(O.T_IDENTIFIER_POSTAL_ADDRESS, O.typecode(address0));
    t.assert(_.isEqual(address0.toFields(), {"typecode":O.T_IDENTIFIER_POSTAL_ADDRESS, "street1":"1 High Street", "city":"New Town", "postcode":"NT1 1TN", "country":"GB" }));

    var person1 = people[1];
    var address1 = person1.first(ATTR["std:attribute:address"]);
    t.assert(_.isEqual(address1.toFields(), {"typecode":O.T_IDENTIFIER_POSTAL_ADDRESS, "street1":"Street 1", "street2":"Street Two", "city":"New City", "county":"New County", "postcode":"PO1 1OO", "country":"GB" }));

    // Don't care about the rest of the objects

});
