/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2020            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */

t.test(function() {

    // --------------------------------------------------------------------------
    // Setup
    // --------------------------------------------------------------------------

    let dateFormat = "yyyy-MM-dd'T'HH:mm:ssZ";

    let testObject1 = O.object();
    testObject1.appendType(TYPE["std:type:person"]);
    testObject1.appendTitle("Test User");
    O.withoutPermissionEnforcement(() => {
        testObject1.save();
    });
    let testRef1 = testObject1.ref.toString();
    let testObjectCreatedDateString = new XDate(testObject1.creationDate).toString(dateFormat);
    let testObjectLastModifiedDateString = new XDate(testObject1.lastModificationDate).toString(dateFormat);
    let testPersonLabelRef = LABEL["test:label:test-person-label"].toString();

    let emptyRef = O.object().preallocateRef().toString();

    let serviceUser = O.serviceUser("haplo:service-user:api-v0:object");

    // --------------------------------------------------------------------------
    // Tests
    // --------------------------------------------------------------------------

    let unauthorisedResponse = t.request("GET", "/api/v0-object/ref/"+testRef1, {}, {});
    t.assertJSONBody(unauthorisedResponse, {
        "success": false,
        "kind": "haplo:api-v0:generic:not-permitted",
        "error": {
            "message": "User is not permitted to use this API"
        }
    });

    t.login(serviceUser);
    let noRefResponse = t.request("GET", "/api/v0-object/ref", {}, {});
    t.assertEqual(noRefResponse.body, "Bad request (failed validation)");

    let noObjectResponse = t.request("GET", "/api/v0-object/ref/"+emptyRef, {sources:"NONE"}, {});
    t.assertJSONBody(noObjectResponse, {
        "success": false,
        "kind": "haplo:api-v0:object:no-such-object",
        "error": {
            "message": "Object "+emptyRef+" does not exist"
        }
    });

    let noSourceResponse = t.request("GET", "/api/v0-object/ref/"+testRef1, {}, {});
    t.assertJSONBody(noSourceResponse, {
        "success": false,
        "kind": "haplo:api-v0:object:sources-not-specified",
        "error": {
            "message": "Sources must be specified as parameter. Use ?sources=NONE for basic object serialisation, ?sources=ALL for everything (discouraged), or ?sources=source1,source2,... to specify exact sources required."
        }
    });

    let getObjectResponseWithNoSources = t.request("GET", "/api/v0-object/ref/"+testRef1, {sources:"NONE"}, {});
    t.assertJSONBody(getObjectResponseWithNoSources, {
        "success": true,
        "kind": "haplo:api-v0:object:serialised",
        "object": {
            "kind":"haplo:object:0",
            "sources":[],
            "ref":testRef1,
            "url": "https://"+O.application.hostname+"/"+testRef1+"/test-user",
            "recordVersion":1,
            "title":"Test User",
            "labels":[
                {
                    "ref":"1x7z",
                    "title":"Common",
                    "code":"std:label:common"
                },
                {
                    "ref":testPersonLabelRef,
                    "title":"Test Person Label",
                    "code":"test:label:test-person-label"
                }
            ],
            "deleted":false,
            "creationDate":testObjectCreatedDateString,
            "lastModificationDate":testObjectLastModifiedDateString,
            "type": {
                "code":"std:type:person",
                "name":"Person",
                "rootCode":"std:type:person",
                "annotations":[]
            },
            "attributes":{
                "dc:attribute:type": [
                    {
                        "type":"link",
                        "ref":"20x0",
                        "code":"std:type:person",
                        "title":"Person"
                    }
                ],
                "dc:attribute:title":[
                    {
                        "type":"text",
                        "value":"Test User"
                    }
                ]
            }
        }
    });

    let getObjectResponseWithBrokenDependency = t.request("GET", "/api/v0-object/ref/"+testRef1, {sources:"std:workflow"}, {});
    t.assertJSONBody(getObjectResponseWithBrokenDependency, {
        "success": false,
        "kind": "haplo:api-v0:generic:exception",
        "error": {
            "message": "Source std:workflow depends on std:workunit which has not been used."
        }
    });

    let getObjectResponseWithSpecifiedSources = t.request("GET", "/api/v0-object/ref/"+testRef1, {sources:"std:workflow,std:workunit"}, {});
    t.assertJSONBody(getObjectResponseWithSpecifiedSources, {
        "success": true,
        "kind": "haplo:api-v0:object:serialised",
        "object": {
            "kind":"haplo:object:0",
            "sources":["std:workunit","std:workflow"],
            "ref":testRef1,
            "url": "https://"+O.application.hostname+"/"+testRef1+"/test-user",
            "recordVersion":1,
            "title":"Test User",
            "labels":[
                {
                    "ref":"1x7z",
                    "title":"Common",
                    "code":"std:label:common"
                },
                {
                    "ref":testPersonLabelRef,
                    "title":"Test Person Label",
                    "code":"test:label:test-person-label"
                }
            ],
            "deleted":false,
            "creationDate":testObjectCreatedDateString,
            "lastModificationDate":testObjectLastModifiedDateString,
            "type": {
                "code":"std:type:person",
                "name":"Person",
                "rootCode":"std:type:person",
                "annotations":[]
            },
            "attributes":{
                "dc:attribute:type": [
                    {
                        "type":"link",
                        "ref":"20x0",
                        "code":"std:type:person",
                        "title":"Person"
                    }
                ],
                "dc:attribute:title":[
                    {
                        "type":"text",
                        "value":"Test User"
                    }
                ]
            },
            "workflows": []
        }
    });

    // Test all sources
    let getObjectResponseWithAllSources = t.request("GET", "/api/v0-object/ref/"+testRef1, {sources:"ALL"}, {});
    let serialiser = O.service("std:serialisation:serialiser").useAllSources();
    t.assertJSONBody(getObjectResponseWithAllSources, {
        "success": true,
        "kind": "haplo:api-v0:object:serialised",
        "object": O.withoutPermissionEnforcement(() => serialiser.encode(testObject1))
    });
    t.assert(JSON.parse(t.last.body).object.sources.length > 0);

    // --------------------------------------------------------------------------
    // Teardown
    // --------------------------------------------------------------------------

});