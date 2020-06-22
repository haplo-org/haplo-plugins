/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2020            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


const DOWNLOAD_URLS_VALID_FOR = 14400; // 4 hours

// --------------------------------------------------------------------------

P.apiAllowedAction(
    O.action("haplo:action:api-v0:file-api").
        title("Use API v0 File").
        allow("group", Group.FileAPI)
);

// --------------------------------------------------------------------------
// Response handlers
// --------------------------------------------------------------------------

P.respondToAPI("GET", "/api/v0-file/metadata", [
    {pathElement:0, as:"string"},
    {parameter:"fileSize", as:"int", optional:true}
], function(api, digest, fileSize) {
    // TODO: If not found, an exception will be thrown and the API wrapper will generate a generic error code with a decent message. Return a more specific error? (and in tags handler too)
    let file = O.file(digest, fileSize);
    api.respondWith("file", {
        digest: file.digest,
        fileSize: file.fileSize,
        mimeType: file.mimeType,
        filename: file.filename,
        createdAt: (new XDate(file.createdAt)).toISOString(),
        properties: file.properties,
        tags: file.tags
    });
    api.respondWith("download", {
        url: file.url({
            asFullURL:true,
            authenticationSignatureValidForSeconds:DOWNLOAD_URLS_VALID_FOR
        }),
        validUntil: (new XDate().addSeconds(DOWNLOAD_URLS_VALID_FOR-16)).toISOString()
    });
    api.success("haplo:api-v0:file:metadata");
});

P.respondToAPI("GET,POST", "/api/v0-file/tags", [
    {pathElement:0, as:"string"},
    {parameter:"fileSize", as:"int", optional:true}
], function(api, digest, fileSize) {
    let file = O.file(digest, fileSize);
    if(api.E.request.method === "POST") {
        file.changeTags(JSON.parse(api.E.request.body).tags||{});
    }
    api.respondWith("tags", file.tags);
    api.success("haplo:api-v0:file:tags");
});
