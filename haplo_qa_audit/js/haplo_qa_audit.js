/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2019            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


var CanViewQAAudit = O.action("haplo:qa-audit:can-view-audit").
    allow("group", SCHEMA.GROUP["std:group:administrators"]);

// --------------------------------------------------------------------------

// Find the root of the JS runtime scope, which allows lookup of plugins by name.
var root = (function() { return this; })();

// --------------------------------------------------------------------------

var Audit = function() {};

Audit.prototype.run = function() {
    this.information = {};
    this.issues = [];
    this.issuesSuppressed = [];
    // Load issue suppression & QA information from plugin __qa__.json files.
    var suppress = this.suppressedCodes = {};
    var qaInformation = {};
    _.each(O.application.plugins, function(pluginName) {
        var plugin = root[pluginName];
        if(plugin) {
            if(plugin.hasFile("__qa__.json")) {
                var json = JSON.parse(plugin.loadFile("__qa__.json").readAsString());
                _.each(json.suppress || {}, function(reason, code) {
                    if(!(code in suppress)) { suppress[code] = []; }
                    suppress[code].push(reason);
                });
                _.each(json.information, function(value, key) {
                    if(!(key in qaInformation)) { qaInformation[key] = {}; }
                    _.extend(qaInformation[key], value);
                });
            }
        }
    });
    this.addInformation("qa", "__qa__.json files", qaInformation);
    // Gather more information from providers
    O.serviceMaybe("haplo:qa-audit:gather-information", this);
    // Issue plugins use this information to identify issues
    O.serviceMaybe("haplo:qa-audit:identify-issues", this);
};

Audit.prototype.addInformation = function(key, name, information) {
    if(key in this.information) { throw new Error("already set information for "+key); }
    this.information[key] = {
        name: name,
        information: information
    };
};

Audit.prototype.getInformation = function(key) {
    var information = this.information[key];
    if(!information) { O.stop("Information required: "+key); }
    return information.information;
};

Audit.prototype.issue = function(code, description, explanation) {
    var issue = {
        code: code,
        description: description,
        explanation: explanation
    };
    var suppressReasons = this.suppressedCodes[code];
    if(suppressReasons) {
        issue.suppression = suppressReasons;
        this.issuesSuppressed.push(issue);
    } else {
        this.issues.push(issue);
    }
};

// --------------------------------------------------------------------------

var audit;

var runAudit = function() {
    var a = new Audit();
    a.run();
    audit = a;
    return audit;
};

var ensureAuditRun = function() {
    return audit || runAudit();
};

// --------------------------------------------------------------------------

P.hook('hGetReportsList', function(response) {
    if(O.currentUser.allowed(CanViewQAAudit)) {
        ensureAuditRun();
        response.reports.push(["/do/haplo-qa-audit/menu", "QA Audit: "+audit.issues.length+" issues"]);
    }
});

P.respond("GET", "/do/haplo-qa-audit/menu", [
], function(E) {
    CanViewQAAudit.enforce();
    ensureAuditRun();
    var options = [];
    options.push({
        action: "/do/haplo-qa-audit/issues",
        label: "Issues requiring resolution: "+audit.issues.length,
        highlight: true,
        indicator: (audit.issues.length === 0) ? "primary" : "terminal"
    });
    options.push({
        action: "/do/haplo-qa-audit/issues/suppressed",
        label: "Suppressed issues: "+audit.issuesSuppressed.length,
        indicator: (audit.issuesSuppressed.length === 0) ? "standard" : "secondary"
    });
    _.each(audit.information, function(x,key) {
        options.push({
            action: "/do/haplo-qa-audit/information/"+key,
            label: "Information: "+x.name,
            indicator: "standard"
        });
    });
    options.push({
        action: "/do/haplo-qa-audit/instructions",
        label: "Instructions: read carefully",
        highlight: true,
        indicator: "forward"
    });

    E.render({
        pageTitle: "QA Audit",
        options: options
    }, "std:ui:choose");
});

P.respond("GET", "/do/haplo-qa-audit/instructions", [
], function(E, key) {
    CanViewQAAudit.enforce();
    E.render({});
});

P.respond("GET", "/do/haplo-qa-audit/information", [
    {pathElement:0, as:"string"}
], function(E, key) {
    CanViewQAAudit.enforce();
    ensureAuditRun();
    var information = audit.information[key];
    if(!information) { O.stop("bad info name"); }
    E.render({
        information: information,
        json: JSON.stringify(information.information, undefined, 2)
    });
});

P.respond("GET", "/do/haplo-qa-audit/issues", [
    {pathElement:0, as:"string", optional:true}
], function(E, suppressedMaybe) {
    var showSuppressed = (suppressedMaybe === "suppressed");
    CanViewQAAudit.enforce();
    ensureAuditRun();
    E.render({
        showSuppressed: showSuppressed,
        issues: audit[showSuppressed ? "issuesSuppressed" : "issues"]
    });
});
