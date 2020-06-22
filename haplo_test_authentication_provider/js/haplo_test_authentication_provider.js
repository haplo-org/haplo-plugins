/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2019            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


// NOTE: plugin.json has a very high loadPriority so other plugin installs can be detected.
// Can't wait until later because the exception would be easy to miss.
// Only disable this check with config data if you know exactly what you're doing.
if(O.application.plugins.length > 3) {
    if(!O.application.config["haplo_test_authentication_provider:disable_blank_app_check"]) {
        throw new Error("haplo_test_authentication_provider must only be installed in a blank application because it interacts badly with other login plugins.");
    }
}

P.db.table("results", {
    datetime: {type:"datetime"},
    identifier: {type:"text"},
    info: {type:"text"}
});

P.respond("GET", "/do/test-authentication-provider/start", [
], function(E) {
    return E.response.redirect(
        O.remote.authentication.urlToStartOAuth(
            O.security.random.identifier(),
            O.application.config["haplo:test-authentication-provider:keychain-credential-name"]
        )
    );
});

P.respond("GET", "/do/test-authentication-provider/done", [
    {pathElement:0, as:"string"}
], function(E, identifier) {
    let resultq = P.db.results.select().where("identifier","=",identifier);
    if(!resultq.length) { O.stop("Unknown authentication"); }
    let result = resultq[0];
    E.render({
        result: result,
        info: JSON.stringify(JSON.parse(result.info), undefined, 4)
    });
});

P.hook("hOAuthSuccess", function(response, verifiedUser) {
    console.log("verifiedUser", verifiedUser);
    let authInfo = JSON.parse(verifiedUser);
    let result = P.db.results.create({
        datetime: new Date(),
        identifier: authInfo.data,
        info: verifiedUser || '{}'
    });
    result.save();
    response.redirectPath = "/do/test-authentication-provider/done/"+result.identifier;
});

// --------------------------------------------------------------------------

P.hook('hGetReportsList', function(response) {
    if(O.currentUser.isMemberOf(Group.Administrators)) {
        response.reports.push(["/do/test-authentication-provider/info", "Test authentication"]);
    }
});

P.respond("GET", "/do/test-authentication-provider/info", [
], function(E) {
    if(!O.currentUser.isMemberOf(Group.Administrators)) { O.stop("Not authorised"); }
    E.render({
        appurl: O.application.url,
        results: _.map(P.db.results.select().order("datetime",true), (row) => {
            return {
                row: row,
                info: JSON.stringify(JSON.parse(row.info), undefined, 4)
            };
        })
    });
});

