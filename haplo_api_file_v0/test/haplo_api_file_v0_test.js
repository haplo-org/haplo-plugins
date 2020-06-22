/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2020            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


t.test(function() {

    let file = O.file(O.binaryData("TEST", {filename:"test.txt", mimeType:"text/plain"}));
    t.assertEqual("94ee059335e587e501cc4bf90613e0814f00a7b08bc7c648fd865a2af6a22cc2", file.digest);
    file.changeTags({
        "test1": "v1",
        "test2": "two",
        "three": null   // make sure it's deleted for repeated tests
    });

    t.login(O.serviceUser("haplo:service-user:api-v0:file"));

    // Request with just digest
    t.request("GET", "/api/v0-file/metadata/94ee059335e587e501cc4bf90613e0814f00a7b08bc7c648fd865a2af6a22cc2");
    let body = JSON.parse(t.last.body);
    t.assertEqual(true, body.success);
    t.assertEqual("haplo:api-v0:file:metadata", body.kind);
    let fileMetadata = body.file;
    let createdDate = new Date(fileMetadata.createdAt);
    t.assert(createdDate.getFullYear() >= 2020);
    fileMetadata.createdAt = 'TEST';
    t.assert(_.isEqual(fileMetadata, {
        "digest": "94ee059335e587e501cc4bf90613e0814f00a7b08bc7c648fd865a2af6a22cc2",
        "fileSize":4,
        "mimeType": "text/plain",
        "filename": "test.txt",
        "createdAt": "TEST",
        "properties":{},
        "tags":{"test1": "v1","test2": "two"}
    }));
    t.assert("url" in body.download);
    t.assert("validUntil" in body.download);

    // Request with wrong file size
    t.request("GET", "/api/v0-file/metadata/94ee059335e587e501cc4bf90613e0814f00a7b08bc7c648fd865a2af6a22cc2", {fileSize:6});
    t.assertJSONBody(t.last, {
        "success": false,
        "kind": "haplo:api-v0:generic:exception",
        "error": {
            "message": "Cannot find or create a file from the value passed to O.file()"
        }
    });
    
    // Request with right file size
    t.request("GET", "/api/v0-file/metadata/94ee059335e587e501cc4bf90613e0814f00a7b08bc7c648fd865a2af6a22cc2", {fileSize:4});
    body = JSON.parse(t.last.body);
    t.assertEqual(true, body.success);
    t.assertEqual("haplo:api-v0:file:metadata", body.kind);
    t.assertEqual("94ee059335e587e501cc4bf90613e0814f00a7b08bc7c648fd865a2af6a22cc2", body.file.digest);

    // Get tags
    t.request("GET", "/api/v0-file/tags/94ee059335e587e501cc4bf90613e0814f00a7b08bc7c648fd865a2af6a22cc2", {fileSize:4});
    t.assertJSONBody(t.last, {
        "success": true,
        "kind": "haplo:api-v0:file:tags",
        "tags": {
            "test1": "v1",
            "test2": "two"
        }
    });

    // Change tags
    t.request("POST", "/api/v0-file/tags/94ee059335e587e501cc4bf90613e0814f00a7b08bc7c648fd865a2af6a22cc2", {}, {
        kind: "json",
        body: {
            tags: {
                "test1": null,
                "test2": "FOUR",
                "three": "x"
            }
        }
    });
    t.assertJSONBody(t.last, {
        "success": true,
        "kind": "haplo:api-v0:file:tags",
        "tags": {
            // "test1" deleted
            "test2": "FOUR",
            "three": "x"
        }
    });

    // Check tags in metadata too
    t.request("GET", "/api/v0-file/metadata/94ee059335e587e501cc4bf90613e0814f00a7b08bc7c648fd865a2af6a22cc2");
    t.assert(_.isEqual(JSON.parse(t.last.body).file.tags, {
        "test2": "FOUR",
        "three": "x"
    }));

});

