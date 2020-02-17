/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


var CanConfigureHelpFeedback = O.action("haplo:help-feedback-form:configure").
    title("Can configure the Help feedback form").
    allow("group", Group.Administrators);

// --------------------------------------------------------------------------

var DEFAULT_CONFIG = {topics:[]};
var getConfig = function() { return P.data.config || DEFAULT_CONFIG; };

var ConfigForm =   P.form("configure", "form/configure.json");
var FeedbackForm = P.form("feedback",  "form/feedback.json");

// --------------------------------------------------------------------------

P.hook("hHelpPage", function(response) {
    response.redirectPath = "/do/haplo-help-feedback-form/feedback";
});

P.respond("GET,POST", "/do/haplo-help-feedback-form/feedback", [
], function(E) {
    var config = getConfig();
    var form;
    if(config.topics && config.topics.length) {
        var document = {};
        var topicNames = _.map(config.topics, function(t) { return t.topic; });
        if(topicNames.length === 1) { document.topic = topicNames[0]; }
        form = FeedbackForm.instance(document);
        form.choices("topics", topicNames);
        form.update(E.request);
        if(form.complete) {
            var i = P.locale().text("template");
            O.email.template("haplo:email-template:help-feedback-delivery").deliver(
                _.find(config.topics, function(t) { return t.topic === document.topic; }).email,
                i["Feedback"],
                O.interpolateString(i["Feedback from {name}"], {name: O.currentUser.name}),
                P.template("message").render({
                    user: O.currentUser,
                    document: document
                })
            );
            return E.response.redirect("/do/haplo-help-feedback-form/sent");
        }
    }
    E.render({
        config: config,
        formError: E.request.method === "POST",
        form: form,
        needsConfig: !form && !config.help
    });
});

// --------------------------------------------------------------------------

P.respond("GET,POST", "/do/haplo-help-feedback-form/sent", [
], function(E) {
    E.render({user:O.currentUser});
});

// --------------------------------------------------------------------------

P.hook('hGetReportsList', function(response) {
    if(O.currentUser.allowed(CanConfigureHelpFeedback)) { 
        response.reports.push(["/do/haplo-help-feedback-form/configure", "Configure help & feedback"]);
    }
});

P.respond("GET,POST", "/do/haplo-help-feedback-form/configure", [
], function(E) {
    CanConfigureHelpFeedback.enforce();
    var document = getConfig();
    var form = ConfigForm.handle(document, E.request);
    if(form.complete) {
        P.data.config = document;
    }
    E.render({
        form: form,
        formError: (E.request.method === "POST") && !form.complete
    });
});
