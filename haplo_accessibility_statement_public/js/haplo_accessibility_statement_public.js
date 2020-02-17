/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */

P.respond("GET", "/do/public-accessibility-statement", [
], function(E) {
    E.render({
        statement: O.service("haplo:accessibility_statement:get_deferred_statement")
    }, "display-statement");
});

P.globalTemplateFunction("public-accessibility-statement:render-link", function(displayText) {
    this.render(P.template("accessibility-link").deferredRender({
        title: displayText
    }));
});